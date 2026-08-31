package com.daidi.gitai.state

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.actions.ForcePushAction
import com.daidi.gitai.actions.RetryAction
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.util.Disposer
import com.intellij.util.concurrency.AppExecutorUtil
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** A read-only view returned by `git-ai status --json`. */
data class GitAiState(
    @SerializedName("current_status") val currentStatus: String = "idle",
    @SerializedName("original_msg") val originalMsg: String? = null,
    @SerializedName("last_sha") val lastSha: String? = null,
    @SerializedName("result_sha") val resultSha: String? = null,
    @SerializedName("pending_push") val pendingPush: PendingPush? = null,
    @SerializedName("last_error") val lastError: OperationError? = null,
    @SerializedName("pid") val pid: Int? = null,
    @SerializedName("skip_next") val skipNext: Boolean? = null,
    @SerializedName("state_path") val statePath: String? = null,
    @SerializedName("log_dir") val logDir: String? = null,
    @SerializedName("initialized") val initialized: Boolean = false,
) {
    val isPolishing get() = currentStatus == "polishing"
    val isPushing get() = currentStatus == "pushing"
    val isFailed get() = currentStatus == "failed"
    val isIdle get() = currentStatus == "idle"
    val hasPendingPush get() = pendingPush != null
}

data class OperationError(
    val code: String = "",
    val category: String = "",
    val message: String = "",
    val retryable: Boolean = false,
    @SerializedName("occurred_at") val occurredAt: Long = 0,
)

data class PendingPush(
    val remote: String = "origin",
    @SerializedName("ref_specs") val refSpecs: List<String>? = null,
    val timestamp: Long = 0,
)

typealias StateChangeListener = (GitAiState) -> Unit

/**
 * Polls the CLI's external application state. The plugin never reads or writes
 * repository state files, which keeps project worktrees untouched and leaves
 * locking/migration semantics in one implementation.
 */
@Service(Service.Level.PROJECT)
class GitAiStateService(private val project: Project) : Disposable {
    private val log = Logger.getInstance(GitAiStateService::class.java)
    private val gson = Gson()
    private val listeners = CopyOnWriteArrayList<StateChangeListener>()
    private val started = AtomicBoolean(false)

    @Volatile
    private var currentState = GitAiState()
    private var pollTask: ScheduledFuture<*>? = null
    private var hasLoadedState = false

    val state: GitAiState get() = currentState
    fun getStatePath(): String? = currentState.statePath
    fun getLogDir(): String? = currentState.logDir

    fun addListener(parentDisposable: Disposable, listener: StateChangeListener) {
        listeners.add(listener)
        Disposer.register(parentDisposable) { listeners.remove(listener) }
        dispatch(listener, currentState)
    }

    fun startWatching() {
        if (!started.compareAndSet(false, true)) return
        pollTask = AppExecutorUtil.getAppScheduledExecutorService().scheduleWithFixedDelay(
            { readState() },
            0,
            1,
            TimeUnit.SECONDS,
        )
    }

    fun refreshNow() {
        AppExecutorUtil.getAppExecutorService().execute { readState() }
    }

    private fun readState() {
        if (project.isDisposed) return
        val result = GitAiCli.runSilently(project, "status", "--json")
        if (!result.success) {
            log.debug("Unable to query Git AI state: ${result.errorText}")
            return
        }
        try {
            updateState(gson.fromJson(result.stdout, GitAiState::class.java) ?: GitAiState())
        } catch (e: Exception) {
            log.debug("Unable to parse Git AI status", e)
        }
    }

    @Synchronized
    private fun updateState(newState: GitAiState) {
        val previous = currentState
        if (newState == previous) {
            hasLoadedState = true
            return
        }
        currentState = newState

        listeners.forEach { listener -> dispatch(listener, newState) }

        if (hasLoadedState) {
            when {
                !newState.resultSha.isNullOrBlank() && newState.resultSha != previous.resultSha ->
                    showNotification(GitAiBundle.message("notification.polished"), NotificationType.INFORMATION)

                previous.isPushing && newState.isIdle ->
                    showNotification(GitAiBundle.message("notification.pushCompleted"), NotificationType.INFORMATION)

                newState.isFailed && newState.lastError?.occurredAt != previous.lastError?.occurredAt ->
                    showFailureNotification(newState.lastError)
            }
        }
        hasLoadedState = true
    }

    private fun dispatch(listener: StateChangeListener, value: GitAiState) {
        ApplicationManager.getApplication().invokeLater({
            if (project.isDisposed) return@invokeLater
            try {
                listener(value)
            } catch (e: Exception) {
                log.warn("Git AI state listener failed", e)
            }
        }, project.disposed)
    }

    private fun showNotification(content: String, type: NotificationType) {
        ApplicationManager.getApplication().invokeLater({
            if (project.isDisposed) return@invokeLater
            NotificationGroupManager.getInstance()
                .getNotificationGroup("git-ai.notifications")
                .createNotification(GitAiBundle.message("notification.title"), content, type)
                .notify(project)
        }, project.disposed)
    }

    private fun showFailureNotification(error: OperationError?) {
        ApplicationManager.getApplication().invokeLater({
            if (project.isDisposed) return@invokeLater
            val failure = error ?: OperationError(
                category = "runtime",
                message = "Git AI stopped safely; the commit and workspace were left unchanged.",
            )
            val notification = NotificationGroupManager.getInstance()
                .getNotificationGroup("git-ai.notifications")
                .createNotification(
                    GitAiBundle.message("notification.title"),
                    GitAiBundle.message("notification.failed", failure.message),
                    NotificationType.WARNING,
                )
            when {
                failure.category == "push" -> notification.addAction(
                    NotificationAction.createSimple(GitAiBundle.message("toolwindow.btn.push")) {
                        ForcePushAction.execute(project)
                    },
                )

                failure.category in setOf("authentication", "model", "config") -> notification.addAction(
                    NotificationAction.createSimple(GitAiBundle.message("action.GitAi.OpenConfig.text")) {
                        ShowSettingsUtil.getInstance().showSettingsDialog(project, "com.daidi.gitai.settings")
                    },
                )

                failure.retryable -> notification.addAction(
                    NotificationAction.createSimple(GitAiBundle.message("action.GitAi.Retry.text")) {
                        RetryAction.execute(project)
                    },
                )
            }
            notification.notify(project)
        }, project.disposed)
    }

    override fun dispose() {
        pollTask?.cancel(true)
        pollTask = null
        listeners.clear()
    }
}
