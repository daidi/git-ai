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
}
