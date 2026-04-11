package com.daidi.gitai.actions

import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiStateService
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
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
                "Re-generate AI commit message for the last commit?",
                "git-ai: Retry",
                Messages.getQuestionIcon()
            )
            if (confirm != Messages.YES) return

            ProgressManager.getInstance().run(object : Task.Backgroundable(project, "git-ai: Retrying...") {
                override fun run(indicator: ProgressIndicator) {
                    val result = GitAiCli.run(project, "retry")
                    if (result.success) {
                        Messages.showInfoMessage(project, "Commit message re-generated!", "git-ai")
                    } else {
                        Messages.showErrorDialog(project, "Retry failed: ${result.stderr}", "git-ai")
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
                "Restore the original commit message?",
                "git-ai: Undo",
                Messages.getQuestionIcon()
            )
            if (confirm != Messages.YES) return

            val result = GitAiCli.run(project, "undo")
            if (result.success) {
                Messages.showInfoMessage(project, "Original message restored!", "git-ai")
            } else {
                Messages.showErrorDialog(project, "Undo failed: ${result.stderr}", "git-ai")
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
                Messages.showInfoMessage(project, "No polishing in progress.", "git-ai")
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

            Messages.showInfoMessage(project, "Polishing cancelled.", "git-ai")
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
                "Force push to remote now?",
                "git-ai: Force Push",
                Messages.getWarningIcon()
            )
            if (confirm != Messages.YES) return

            ProgressManager.getInstance().run(object : Task.Backgroundable(project, "git-ai: Pushing...") {
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
                        Messages.showInfoMessage(project, "Push completed!", "git-ai")
                    } else {
                        Messages.showErrorDialog(project, "Push failed: ${result.stderr}", "git-ai")
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
            Messages.showInfoMessage(project, "git-ai initialized!\n\n${result.stdout}", "git-ai")
        } else {
            Messages.showErrorDialog(project, "Init failed: ${result.stderr}", "git-ai")
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
