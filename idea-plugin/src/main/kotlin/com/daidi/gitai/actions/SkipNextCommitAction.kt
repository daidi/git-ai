package com.daidi.gitai.actions

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiStateService
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.actionSystem.ToggleAction
import com.intellij.openapi.components.service
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.ui.Messages

class SkipNextCommitAction : ToggleAction() {
    override fun getActionUpdateThread() = com.intellij.openapi.actionSystem.ActionUpdateThread.BGT

    override fun isSelected(e: AnActionEvent): Boolean {
        val project = e.project ?: return false
        val stateService = project.service<GitAiStateService>()
        return stateService.state.skipNext == true
    }

    override fun setSelected(e: AnActionEvent, state: Boolean) {
        val project = e.project ?: return
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("action.GitAi.SkipNextCommit.text"), false) {
            override fun run(indicator: ProgressIndicator) {
                val args = if (state) arrayOf("skip-next") else arrayOf("skip-next", "--clear")
                val result = GitAiCli.run(project, *args)
                project.service<GitAiStateService>().refreshNow()
                if (!result.success) {
                    ApplicationManager.getApplication().invokeLater({
                        if (!project.isDisposed) {
                            Messages.showErrorDialog(project, GitAiBundle.message("action.skip.failed", result.errorText), GitAiBundle.message("notification.title"))
                        }
                    }, project.disposed)
                }
            }
        })
    }
}
