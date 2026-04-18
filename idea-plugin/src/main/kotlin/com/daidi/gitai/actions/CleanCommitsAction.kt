package com.daidi.gitai.actions

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.state.GitAiCli
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages

class CleanCommitsAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        execute(project, force = false)
    }

    companion object {
        fun execute(project: Project, force: Boolean = false) {
            ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("action.clean.progress")) {
                override fun run(indicator: ProgressIndicator) {
                    val args = mutableListOf("clean")
                    if (force) {
                        args.add("--force")
                    }

                    val result = GitAiCli.run(project, *args.toTypedArray())
                    
                    ApplicationManager.getApplication().invokeLater {
                        if (result.success) {
                            Messages.showInfoMessage(project, GitAiBundle.message("action.clean.success", result.stdout), GitAiBundle.message("notification.title"))
                        } else {
                            if (result.stderr.contains("ERR_PUSHED_COMMITS")) {
                                val confirm = Messages.showYesNoDialog(
                                    project,
                                    GitAiBundle.message("action.clean.pushedWarning"),
                                    GitAiBundle.message("action.clean.title"),
                                    Messages.getWarningIcon()
                                )
                                if (confirm == Messages.YES) {
                                    execute(project, force = true)
                                }
                            } else {
                                Messages.showErrorDialog(project, GitAiBundle.message("action.clean.failed", result.stderr.ifEmpty { result.stdout }), GitAiBundle.message("notification.title"))
                            }
                        }
                    }
                }
            })
        }
    }
}
