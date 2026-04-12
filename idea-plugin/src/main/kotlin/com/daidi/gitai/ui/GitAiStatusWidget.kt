package com.daidi.gitai.ui

import com.daidi.gitai.GitAiBundle
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
import com.intellij.openapi.ui.popup.JBPopup
/**
 * Factory for the status bar widget.
 */
class GitAiStatusWidgetFactory : StatusBarWidgetFactory {
    override fun getId(): String = "GitAiStatusWidget"
    override fun getDisplayName(): String = GitAiBundle.message("widget.displayName")
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
            currentState.isPolishing -> GitAiBundle.message("status.polishing")
            currentState.isPushing -> GitAiBundle.message("status.pushing")
            currentState.hasPendingPush -> GitAiBundle.message("status.pendingPush")
            else -> "Git AI"
        }
    }

    override fun getIcon(): Icon? {
        return when {
            currentState.isPolishing -> com.intellij.ui.AnimatedIcon.Default.INSTANCE
            currentState.isPushing -> com.intellij.ui.AnimatedIcon.Default.INSTANCE
            currentState.hasPendingPush -> AllIcons.Actions.Suspend
            else -> AllIcons.Actions.Checked
        }
    }

    override fun getPopup(): JBPopup? = null

    override fun getTooltipText(): String {
        return when {
            currentState.isPolishing -> GitAiBundle.message("widget.tooltip.polishing", currentState.lastSha?.take(8) ?: "")
            currentState.isPushing -> GitAiBundle.message("widget.tooltip.pushing", currentState.pendingPush?.remote ?: "origin")
            currentState.hasPendingPush -> GitAiBundle.message("widget.tooltip.pendingPush", currentState.pendingPush?.remote ?: "origin")
            else -> GitAiBundle.message("widget.tooltip.idle")
        }
    }

    override fun getClickConsumer(): Consumer<MouseEvent>? = null

    override fun dispose() {
        statusBar = null
    }
}
