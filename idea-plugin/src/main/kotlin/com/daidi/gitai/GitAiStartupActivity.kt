package com.daidi.gitai

import com.daidi.gitai.state.GitAiStateService
import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiUpdateService
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.ui.Messages
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Starts the state watcher when the project opens and checks initialization.
 */
class GitAiStartupActivity : ProjectActivity {
    private val initializationPrompted = AtomicBoolean(false)

    override suspend fun execute(project: Project) {
        val stateService = project.service<GitAiStateService>()
        stateService.startWatching()
        stateService.addListener(stateService) { state ->
            // statePath is populated only after a successful CLI query, so an
            // ordinary non-Git project or a missing CLI never gets a false prompt.
            if (state.statePath != null && !state.initialized && initializationPrompted.compareAndSet(false, true)) {
                promptInitialization(project)
            }
        }

        // IDE-side update check (works even with old CLI versions)
        GitAiUpdateService.getInstance().checkOnStartup(project)
    }

    private fun promptInitialization(project: Project) {
        ApplicationManager.getApplication().invokeLater({
            if (project.isDisposed) return@invokeLater
                val result = Messages.showYesNoDialog(
                    project,
                    GitAiBundle.message("startup.prompt.message"),
                    GitAiBundle.message("startup.prompt.title"),
                    GitAiBundle.message("startup.prompt.yes"),
                    GitAiBundle.message("startup.prompt.no"),
                    Messages.getInformationIcon()
                )
                if (result == Messages.YES) {
                    ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("action.GitAi.Init.text"), false) {
                        override fun run(indicator: ProgressIndicator) {
                            val initResult = GitAiCli.run(project, "init")
                            if (!initResult.success) {
                                ApplicationManager.getApplication().invokeLater({
                                    if (!project.isDisposed) {
                                        Messages.showErrorDialog(project, GitAiBundle.message("action.init.failed", initResult.errorText), GitAiBundle.message("notification.title"))
                                    }
                                }, project.disposed)
                            }
                            project.service<GitAiStateService>().refreshNow()
                        }
                    })
                }
        }, project.disposed)
    }

}
