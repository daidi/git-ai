package com.daidi.gitai

import com.daidi.gitai.state.GitAiStateService
import com.daidi.gitai.state.GitAiCli
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.Messages
import java.io.File

/**
 * Starts the state watcher when the project opens and checks initialization.
 */
class GitAiStartupActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        val stateService = project.service<GitAiStateService>()
        stateService.startWatching()

        checkAndPromptInitialization(project)
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
                    "git-ai is not initialized for this repository.\nWould you like to automatically inject the AI commit hook?",
                    "Initialize git-ai",
                    "Enable git-ai",
                    "Not now",
                    Messages.getInformationIcon()
                )
                if (result == Messages.YES) {
                    com.daidi.gitai.state.GitAiCli.run(project, "init")
                }
            }
        }
    }
}
