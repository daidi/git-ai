package com.daidi.gitai.actions

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiStateService
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages

class RetryAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        execute(project)
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        val stateService = project?.service<GitAiStateService>()
        e.presentation.isEnabled = stateService?.state?.isIdle == true
    }

    companion object {
        fun execute(project: Project) {
            val confirm = Messages.showYesNoDialog(
                project,
                GitAiBundle.message("action.retry.confirm"),
                GitAiBundle.message("action.retry.title"),
                Messages.getQuestionIcon()
            )
            if (confirm != Messages.YES) return

            ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("action.retry.progress")) {
                override fun run(indicator: ProgressIndicator) {
                    val result = GitAiCli.run(project, "retry")
                    ApplicationManager.getApplication().invokeLater {
                        if (result.success) {
                            Messages.showInfoMessage(project, GitAiBundle.message("action.retry.success"), GitAiBundle.message("notification.title"))
                        } else {
                            Messages.showErrorDialog(project, GitAiBundle.message("action.retry.failed", result.stderr), GitAiBundle.message("notification.title"))
                        }
                    }
                }
            })
        }
    }
}

class UndoAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        execute(project)
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        val stateService = project?.service<GitAiStateService>()
        e.presentation.isEnabled = stateService?.state?.isIdle == true &&
                stateService.state.originalMsg != null
    }

    companion object {
        fun execute(project: Project) {
            val confirm = Messages.showYesNoDialog(
                project,
                GitAiBundle.message("action.undo.confirm"),
                GitAiBundle.message("action.undo.title"),
                Messages.getQuestionIcon()
            )
            if (confirm != Messages.YES) return

            val result = GitAiCli.run(project, "undo")
            if (result.success) {
                Messages.showInfoMessage(project, GitAiBundle.message("action.undo.success"), GitAiBundle.message("notification.title"))
            } else {
                Messages.showErrorDialog(project, GitAiBundle.message("action.undo.failed", result.stderr), GitAiBundle.message("notification.title"))
            }
        }
    }
}

class CancelAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        execute(project)
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        val stateService = project?.service<GitAiStateService>()
        e.presentation.isEnabled = stateService?.state?.isPolishing == true
    }

    companion object {
        fun execute(project: Project) {
            val stateService = project.service<GitAiStateService>()
            val state = stateService.state

            if (!state.isPolishing) {
                Messages.showInfoMessage(project, GitAiBundle.message("action.cancel.noPolishing"), GitAiBundle.message("notification.title"))
                return
            }

            val pid = state.pid
            if (pid != null) {
                try {
                    // Kill the daemon process.
                    ProcessBuilder("kill", pid.toString())
                        .directory(java.io.File(project.basePath ?: "."))
                        .start()
                        .waitFor()
                } catch (_: Exception) {}
            }

            // Reset state file.
            val statePath = stateService.getStatePath()
            if (statePath != null) {
                try {
                    val resetJson = """{"current_status":"idle","original_msg":"${state.originalMsg ?: ""}","last_sha":"${state.lastSha ?: ""}"}"""
                    java.io.File(statePath).writeText(resetJson)
                } catch (_: Exception) {}
            }

            Messages.showInfoMessage(project, GitAiBundle.message("action.cancel.success"), GitAiBundle.message("notification.title"))
        }
    }
}

class ForcePushAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        execute(project)
    }

    override fun update(e: AnActionEvent) {
        val project = e.project
        val stateService = project?.service<GitAiStateService>()
        e.presentation.isEnabled = stateService?.state?.isPushing != true
    }

    companion object {
        fun execute(project: Project) {
            val confirm = Messages.showYesNoDialog(
                project,
                GitAiBundle.message("action.push.confirm"),
                GitAiBundle.message("action.push.title"),
                Messages.getWarningIcon()
            )
            if (confirm != Messages.YES) return

            ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("action.push.progress")) {
                override fun run(indicator: ProgressIndicator) {
                    val result = GitAiCli.runGitInternal(project, "push")
                    if (result.success) {
                        // Clear pending push from state.
                        val stateService = project.service<GitAiStateService>()
                        val statePath = stateService.getStatePath()
                        if (statePath != null) {
                            try {
                                val file = java.io.File(statePath)
                                if (file.exists()) {
                                    file.writeText("""{"current_status":"idle"}""")
                                }
                            } catch (_: Exception) {}
                        }
                        ApplicationManager.getApplication().invokeLater {
                            Messages.showInfoMessage(project, GitAiBundle.message("action.push.success"), GitAiBundle.message("notification.title"))
                        }
                    } else {
                        ApplicationManager.getApplication().invokeLater {
                            Messages.showErrorDialog(project, GitAiBundle.message("action.push.failed", result.stderr), GitAiBundle.message("notification.title"))
                        }
                    }
                }
            })
        }
    }
}

class InitAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val result = GitAiCli.run(project, "init")
        if (result.success) {
            Messages.showInfoMessage(project, GitAiBundle.message("action.init.success", result.stdout), GitAiBundle.message("notification.title"))
        } else {
            Messages.showErrorDialog(project, GitAiBundle.message("action.init.failed", result.stderr), GitAiBundle.message("notification.title"))
        }
    }
}

class OpenConfigAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        // Open IDE Settings directly to the git-ai page.
        com.intellij.openapi.options.ShowSettingsUtil.getInstance()
            .showSettingsDialog(project, "com.daidi.gitai.settings")
    }
}
