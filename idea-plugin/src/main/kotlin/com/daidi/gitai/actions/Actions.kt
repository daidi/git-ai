package com.daidi.gitai.actions

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiStateService
import com.daidi.gitai.state.GitAiRepositoryService
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages

class RetryAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.let(::execute)
    }

    override fun update(e: AnActionEvent) {
        val state = e.project?.service<GitAiStateService>()?.state
        e.presentation.isEnabled = state?.let { it.isIdle || it.isFailed } == true
    }

    companion object {
        fun execute(project: Project) {
            val confirmation = Messages.showYesNoDialog(
                project,
                GitAiBundle.message("action.retry.confirm"),
                GitAiBundle.message("action.retry.title"),
                Messages.getQuestionIcon(),
            )
            if (confirmation != Messages.YES) return
            runCliAction(
                project,
                GitAiBundle.message("action.retry.progress"),
                arrayOf("retry"),
                "action.retry.success",
                "action.retry.failed",
            )
        }
    }
}

class UndoAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.let(::execute)
    }

    override fun update(e: AnActionEvent) {
        val state = e.project?.service<GitAiStateService>()?.state
        e.presentation.isEnabled = state?.originalMsg != null && !state.isPolishing && !state.isPushing
    }

    companion object {
        fun execute(project: Project) {
            val confirmation = Messages.showYesNoDialog(
                project,
                GitAiBundle.message("action.undo.confirm"),
                GitAiBundle.message("action.undo.title"),
                Messages.getQuestionIcon(),
            )
            if (confirmation != Messages.YES) return
            runCliAction(
                project,
                GitAiBundle.message("action.undo.title"),
                arrayOf("undo"),
                "action.undo.success",
                "action.undo.failed",
            )
        }
    }
}

class CancelAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.let(::execute)
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project?.service<GitAiStateService>()?.state?.isPolishing == true
    }

    companion object {
        fun execute(project: Project) {
            if (!project.service<GitAiStateService>().state.isPolishing) {
                Messages.showInfoMessage(
                    project,
                    GitAiBundle.message("action.cancel.noPolishing"),
                    GitAiBundle.message("notification.title"),
                )
                return
            }
            runCliAction(
                project,
                GitAiBundle.message("action.GitAi.Cancel.text"),
                arrayOf("cancel"),
                "action.cancel.success",
                "action.cancel.failed",
            )
        }
    }
}

class ForcePushAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.let(::execute)
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project?.service<GitAiStateService>()?.state?.isPushing != true
    }

    companion object {
        fun execute(project: Project) {
            val confirmation = Messages.showYesNoDialog(
                project,
                GitAiBundle.message("action.push.confirm"),
                GitAiBundle.message("action.push.title"),
                Messages.getWarningIcon(),
            )
            if (confirmation != Messages.YES) return
            runCliAction(
                project,
                GitAiBundle.message("action.push.progress"),
                arrayOf("push"),
                "action.push.success",
                "action.push.failed",
            )
        }
    }
}

class InitAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        runCliAction(
            project,
            GitAiBundle.message("action.GitAi.Init.text"),
            arrayOf("init"),
            "action.init.success",
            "action.init.failed",
            includeOutputOnSuccess = true,
        )
    }
}

class OpenConfigAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        com.intellij.openapi.options.ShowSettingsUtil.getInstance()
            .showSettingsDialog(project, "com.daidi.gitai.settings")
    }
}

class SelectRepositoryAction : AnAction() {
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project
            ?.let { GitAiRepositoryService.getInstance(it).repositories().size > 1 } == true
    }

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val service = GitAiRepositoryService.getInstance(project)
        val roots = service.repositories()
        if (roots.size < 2) return
        val selected = Messages.showEditableChooseDialog(
            GitAiBundle.message("action.GitAi.SelectRepository.description"),
            GitAiBundle.message("action.GitAi.SelectRepository.text"),
            Messages.getQuestionIcon(),
            roots.toTypedArray(),
            service.workingDirectory(),
            null,
        ) ?: return
        if (selected !in roots) return
        service.select(selected)
        project.service<GitAiStateService>().refreshNow()
    }
}

private fun runCliAction(
    project: Project,
    progressTitle: String,
    args: Array<String>,
    successKey: String,
    failureKey: String,
    includeOutputOnSuccess: Boolean = false,
) {
    ProgressManager.getInstance().run(object : Task.Backgroundable(project, progressTitle, true) {
        override fun run(indicator: ProgressIndicator) {
            val result = GitAiCli.run(project, *args)
            project.service<GitAiStateService>().refreshNow()
            ApplicationManager.getApplication().invokeLater({
                if (project.isDisposed) return@invokeLater
                if (result.success) {
                    val message = if (includeOutputOnSuccess) {
                        GitAiBundle.message(successKey, result.stdout)
                    } else {
                        GitAiBundle.message(successKey)
                    }
                    Messages.showInfoMessage(project, message, GitAiBundle.message("notification.title"))
                } else {
                    Messages.showErrorDialog(
                        project,
                        GitAiBundle.message(failureKey, result.errorText),
                        GitAiBundle.message("notification.title"),
                    )
                }
            }, project.disposed)
        }
    })
}
