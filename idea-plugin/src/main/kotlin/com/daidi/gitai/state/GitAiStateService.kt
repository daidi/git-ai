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
) {
    val isPolishing get() = currentStatus == "polishing"
    val isPushing get() = currentStatus == "pushing"
    val isIdle get() = currentStatus == "idle"
    val hasPendingPush get() = pendingPush != null
}

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
            showNotification(GitAiBundle.message("notification.polished"), NotificationType.INFORMATION)
        }
        if (prevStatus == "pushing" && newState.isIdle) {
            showNotification(GitAiBundle.message("notification.pushCompleted"), NotificationType.INFORMATION)
        }
    }

    private fun showNotification(content: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup("git-ai.notifications")
            .createNotification(GitAiBundle.message("notification.title"), content, type)
            .notify(project)
    }

    override fun dispose() {
        pollTimer?.cancel()
        pollTimer = null
        listeners.clear()
    }
}
