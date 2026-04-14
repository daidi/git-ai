package com.daidi.gitai

import com.daidi.gitai.state.GitAiStateService
import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiInstaller
import com.intellij.ide.util.PropertiesComponent
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.Messages
import com.intellij.util.io.HttpRequests
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.io.File

/**
 * Starts the state watcher when the project opens and checks initialization.
 */
class GitAiStartupActivity : ProjectActivity {
    private val log = Logger.getInstance(GitAiStartupActivity::class.java)

    override suspend fun execute(project: Project) {
        val stateService = project.service<GitAiStateService>()
        stateService.startWatching()

        checkAndPromptInitialization(project)

        // IDE-side update check (works even with old CLI versions)
        checkForCliUpdate(project)
    }

    private fun checkAndPromptInitialization(project: Project) {
        val basePath = project.basePath ?: return
        val gitDir = File(basePath, ".git")
        if (!gitDir.exists() || !gitDir.isDirectory) return

        val hookFile = File(gitDir, "hooks/post-commit")
        val isHooked = hookFile.exists() && hookFile.readText().contains("git-ai hook post-commit")

        if (!isHooked) {
            ApplicationManager.getApplication().invokeLater {
                val result = Messages.showYesNoDialog(
                    project,
                    GitAiBundle.message("startup.prompt.message"),
                    GitAiBundle.message("startup.prompt.title"),
                    GitAiBundle.message("startup.prompt.yes"),
                    GitAiBundle.message("startup.prompt.no"),
                    Messages.getInformationIcon()
                )
                if (result == Messages.YES) {
                    com.daidi.gitai.state.GitAiCli.run(project, "init")
                }
            }
        }
    }

    /**
     * Independently checks for CLI updates by running `git-ai --version`
     * and comparing against the latest GitHub release.
     * This works even if the user has an old CLI that doesn't write
     * update_available to state.json.
     */
    private fun checkForCliUpdate(project: Project) {
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                // Respect 24h cooldown.
                val props = PropertiesComponent.getInstance()
                val lastCheck = props.getLong("git-ai.lastUpdateCheck", 0L)
                val oneDayMs = 24 * 60 * 60 * 1000L
                if (System.currentTimeMillis() - lastCheck < oneDayMs) {
                    return@executeOnPooledThread
                }

                // 1. Get installed version.
                val result = GitAiCli.run(project, "--version")
                if (!result.success) return@executeOnPooledThread

                val versionMatch = Regex("""v?(\d+\.\d+\.\d+)""").find(result.stdout)
                    ?: return@executeOnPooledThread
                val currentVersion = versionMatch.groupValues[1]
                if (currentVersion == "dev" || currentVersion.contains("-")) {
                    return@executeOnPooledThread
                }

                // 2. Fetch latest release.
                val json = HttpRequests.request("https://git-ai.codegg.org/releases/latest")
                    .readString()
                val release = Gson().fromJson(json, ReleaseInfo::class.java)
                val latestVersion = release.tagName.removePrefix("v")

                // 3. Record check time.
                props.setValue("git-ai.lastUpdateCheck", System.currentTimeMillis().toString())

                // 4. Compare.
                if (!isNewer(currentVersion, latestVersion)) return@executeOnPooledThread

                // 5. Show notification on EDT.
                ApplicationManager.getApplication().invokeLater {
                    val notification = NotificationGroupManager.getInstance()
                        .getNotificationGroup("git-ai.notifications")
                        .createNotification(
                            GitAiBundle.message("notification.title"),
                            GitAiBundle.message("notification.updateAvailable", currentVersion, latestVersion),
                            NotificationType.INFORMATION
                        )
                    notification.addAction(NotificationAction.createSimple(GitAiBundle.message("notification.updateNow")) {
                        notification.expire()
                        GitAiInstaller.installCli(project)
                    })
                    notification.addAction(NotificationAction.createSimple(GitAiBundle.message("notification.updateDismiss")) {
                        notification.expire()
                    })
                    notification.notify(project)
                }
            } catch (e: Exception) {
                log.debug("Update check failed: ${e.message}")
            }
        }
    }

    private fun isNewer(current: String, latest: String): Boolean {
        val c = current.split(".").map { it.toIntOrNull() ?: 0 }
        val l = latest.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until 3) {
            val cv = c.getOrElse(i) { 0 }
            val lv = l.getOrElse(i) { 0 }
            if (lv > cv) return true
            if (lv < cv) return false
        }
        return false
    }

    private data class ReleaseInfo(
        @SerializedName("tag_name") val tagName: String = ""
    )
}

