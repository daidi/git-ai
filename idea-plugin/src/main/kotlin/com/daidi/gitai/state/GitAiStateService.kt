package com.daidi.gitai.state

import com.daidi.gitai.GitAiBundle
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import java.io.File
import java.util.Timer
import java.util.TimerTask
import java.util.concurrent.CopyOnWriteArrayList

/**
 * Represents the git-ai runtime state from state.json.
 */
data class GitAiState(
    @SerializedName("current_status") val currentStatus: String = "idle",
    @SerializedName("original_msg") val originalMsg: String? = null,
    @SerializedName("last_sha") val lastSha: String? = null,
    @SerializedName("pending_push") val pendingPush: PendingPush? = null,
    @SerializedName("pid") val pid: Int? = null,
    @SerializedName("skip_next") val skipNext: Boolean? = null,
    @SerializedName("last_error") val lastError: ErrorInfo? = null,
) {
    val isPolishing get() = currentStatus == "polishing"
    val isPushing get() = currentStatus == "pushing"
    val isIdle get() = currentStatus == "idle"
    val hasPendingPush get() = pendingPush != null
}

data class ErrorInfo(
    @SerializedName("code") val code: String,
    @SerializedName("message") val message: String,
    @SerializedName("fix_hint") val fixHint: String? = null,
)

data class PendingPush(
    @SerializedName("remote") val remote: String,
    @SerializedName("ref_specs") val refSpecs: List<String>?,
    @SerializedName("timestamp") val timestamp: Long,
)

typealias StateChangeListener = (GitAiState) -> Unit

/**
 * Project-level service that watches .git/git-ai/state.json and emits state changes.
 */
@Service(Service.Level.PROJECT)
class GitAiStateService(private val project: Project) : Disposable {
    private val log = Logger.getInstance(GitAiStateService::class.java)
    private val gson = Gson()
    private val listeners = CopyOnWriteArrayList<StateChangeListener>()
    private var currentState = GitAiState()
    private var pollTimer: Timer? = null

    val state: GitAiState get() = currentState

    /**
     * Returns the path to state.json for the current project.
     */
    fun getStatePath(): String? {
        val basePath = project.basePath ?: return null
        return "$basePath/.git/git-ai/state.json"
    }

    /**
     * Returns the path to the log directory.
     */
    fun getLogDir(): String? {
        val basePath = project.basePath ?: return null
        return "$basePath/.git/git-ai/logs"
    }

    fun addListener(listener: StateChangeListener) {
        listeners.add(listener)
        listener(currentState)
    }

    fun removeListener(listener: StateChangeListener) {
        listeners.remove(listener)
    }

    /**
     * Start watching the state file.
     */
    fun startWatching() {
        // Use VFS listener for file changes.
        project.messageBus.connect(this).subscribe(
            VirtualFileManager.VFS_CHANGES,
            object : BulkFileListener {
                override fun after(events: List<VFileEvent>) {
                    val statePath = getStatePath() ?: return
                    for (event in events) {
                        if (event.path == statePath) {
                            readState()
                            break
                        }
                    }
                }
            }
        )

        // Also poll as a safety net (some file changes might not trigger VFS events).
        pollTimer = Timer("git-ai-poll", true).also {
            it.scheduleAtFixedRate(object : TimerTask() {
                override fun run() {
                    readState()
                    // Refresh the file in VFS so our listener catches external changes.
                    val statePath = getStatePath() ?: return
                    LocalFileSystem.getInstance().refreshAndFindFileByPath(statePath)
                }
            }, 0, 1000)
        }

        // Initial read.
        readState()
    }

    private fun readState() {
        try {
            val statePath = getStatePath() ?: return
            val file = File(statePath)
            if (!file.exists()) {
                updateState(GitAiState())
                return
            }

            val content = file.readText()
            val newState = gson.fromJson(content, GitAiState::class.java) ?: GitAiState()
            updateState(newState)
        } catch (e: Exception) {
            // File may be locked or malformed — ignore.
            log.debug("Failed to read state.json: ${e.message}")
        }
    }

    /**
     * Writes the given state to state.json.
     */
    fun saveState(newState: GitAiState) {
        try {
            val statePath = getStatePath() ?: return
            val file = File(statePath)
            if (!file.parentFile.exists()) {
                file.parentFile.mkdirs()
            }
            val content = gson.toJson(newState)
            file.writeText(content)
            updateState(newState)
        } catch (e: Exception) {
            log.error("Failed to write state.json", e)
        }
    }

    private fun updateState(newState: GitAiState) {
        val prevStatus = currentState.currentStatus
        if (newState == currentState) return

        currentState = newState

        // Notify listeners.
        for (listener in listeners) {
            try {
                listener(newState)
            } catch (e: Exception) {
                log.error("State listener error", e)
            }
        }

        // Show IDE notifications for important transitions.
        if (prevStatus == "polishing" && newState.isIdle) {
            if (newState.lastError != null) {
                showPushErrorNotification(newState.lastError)
            } else {
                showNotification(GitAiBundle.message("notification.polished"), NotificationType.INFORMATION)
            }
            checkForUpdatesInLog()
        }
        if (prevStatus == "pushing" && newState.isIdle) {
            if (newState.lastError != null) {
                showPushErrorNotification(newState.lastError)
            } else {
                showNotification(GitAiBundle.message("notification.pushCompleted"), NotificationType.INFORMATION)
            }
        }
    }

    private fun showPushErrorNotification(error: ErrorInfo) {
        com.intellij.openapi.application.ApplicationManager.getApplication().invokeLater {
            val notification = NotificationGroupManager.getInstance()
                .getNotificationGroup("git-ai.notifications")
                .createNotification(
                    GitAiBundle.message("notification.title"),
                    error.message,
                    NotificationType.WARNING
                )
            if (error.fixHint != null) {
                notification.addAction(
                    com.intellij.notification.NotificationAction.createSimple(
                        GitAiBundle.message("notification.runFix")
                    ) {
                        notification.expire()
                        // Open terminal and run fix command.
                        val terminal = com.intellij.terminal.TerminalToolWindowManager.getInstance(project)
                        terminal.createLocalShellWidget(project.basePath ?: ".", "Git AI Fix")
                            .executeCommand(error.fixHint)
                    }
                )
            }
            notification.addAction(
                com.intellij.notification.NotificationAction.createSimple(
                    GitAiBundle.message("notification.openTerminal")
                ) {
                    notification.expire()
                    val terminal = com.intellij.terminal.TerminalToolWindowManager.getInstance(project)
                    terminal.createLocalShellWidget(project.basePath ?: ".", "Git AI")
                }
            )
            notification.notify(project)
        }
    }

    private fun showNotification(content: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("git-ai.notifications")
            .createNotification(GitAiBundle.message("notification.title"), content, type)
            .notify(project)
    }
    
    private fun checkForUpdatesInLog() {
        try {
            val logDir = getLogDir() ?: return
            val dir = File(logDir)
            if (!dir.exists() || !dir.isDirectory) return

            val latestLog = dir.listFiles()
                ?.filter { it.name.endsWith(".log") }
                ?.maxByOrNull { it.name }
                ?: return

            val content = latestLog.readText().replace(Regex("""\x1b\[[0-9;]*m"""), "")
            val match = Regex("""Update available for git-ai: (v[\d\.]+) → (v[\d\.]+)""").find(content)
            
            if (match != null) {
                val currentVersion = match.groupValues[1]
                val latestVersion = match.groupValues[2]
                
                com.intellij.openapi.application.ApplicationManager.getApplication().invokeLater {
                    val notification = NotificationGroupManager.getInstance()
                        .getNotificationGroup("git-ai.notifications")
                        .createNotification(
                            GitAiBundle.message("notification.title"),
                            GitAiBundle.message("notification.updateAvailable", currentVersion, latestVersion),
                            NotificationType.INFORMATION
                        )
                    notification.addAction(com.intellij.notification.NotificationAction.createSimple(GitAiBundle.message("notification.updateNow")) {
                        notification.expire()
                        com.daidi.gitai.state.GitAiInstaller.installCli(project)
                    })
                    notification.addAction(com.intellij.notification.NotificationAction.createSimple(GitAiBundle.message("notification.updateDismiss")) {
                        notification.expire()
                    })
                    notification.notify(project)
                }
            }
        } catch (e: Exception) {
            log.debug("Failed to check for updates in log", e)
        }
    }

    override fun dispose() {
        pollTimer?.cancel()
        pollTimer = null
        listeners.clear()
    }
}
