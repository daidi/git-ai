package com.daidi.gitai.ui

import com.daidi.gitai.state.GitAiState
import com.daidi.gitai.state.GitAiStateService
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.util.Consumer
import java.awt.event.MouseEvent
import javax.swing.Icon
import com.intellij.icons.AllIcons
import com.intellij.openapi.ui.popup.ListPopup

/**
 * Factory for the status bar widget.
 */
class GitAiStatusWidgetFactory : StatusBarWidgetFactory {
    override fun getId(): String = "GitAiStatusWidget"
    override fun getDisplayName(): String = "git-ai Status"
    override fun isAvailable(project: Project): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget {
        return GitAiStatusWidget(project)
    }
}

/**
 * Status bar widget showing the current git-ai state.
 */
class GitAiStatusWidget(private val project: Project) : StatusBarWidget,
    StatusBarWidget.MultipleTextValuesPresentation {

    private var statusBar: StatusBar? = null
    private var currentState = GitAiState()

    override fun ID(): String = "GitAiStatusWidget"

    override fun install(statusBar: StatusBar) {
        this.statusBar = statusBar
        val stateService = project.service<GitAiStateService>()
        stateService.addListener { state ->
            currentState = state
            statusBar.updateWidget(ID())
        }
    }

    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun getSelectedValue(): String {
        return when {
            currentState.isPolishing -> "AI 润色中..."
            currentState.isPushing -> "推送中..."
            currentState.hasPendingPush -> "待推送..."
            else -> "Git AI"
        }
    }

    override fun getIcon(): Icon? {
        return when {
            currentState.isPolishing -> AllIcons.Actions.Lightning
            currentState.isPushing -> AllIcons.Vcs.Push
            currentState.hasPendingPush -> AllIcons.Actions.Delay
            else -> AllIcons.Actions.Checked
        }
    }

    override fun getPopupStep(): ListPopup? = null

    override fun getTooltipText(): String {
        return when {
            currentState.isPolishing -> "git-ai: Polishing commit ${currentState.lastSha?.take(8) ?: ""}"
            currentState.isPushing -> "git-ai: Pushing to ${currentState.pendingPush?.remote ?: "origin"}"
            currentState.hasPendingPush -> "git-ai: Push pending to ${currentState.pendingPush?.remote ?: "origin"}"
            else -> "git-ai: Idle"
        }
    }

    override fun getAlignment(): Float = 0f

    override fun getClickConsumer(): Consumer<MouseEvent>? = null

    override fun dispose() {
        statusBar = null
    }
}
