package com.daidi.gitai.ui

import com.daidi.gitai.state.GitAiState
import com.daidi.gitai.state.GitAiStateService
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.service
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import java.awt.FlowLayout
import java.awt.Font
import java.io.File
import java.util.Timer
import java.util.TimerTask
import javax.swing.*
import javax.swing.border.EmptyBorder
import com.intellij.icons.AllIcons

/**
 * Tool window factory for the git-ai panel.
 */
class GitAiToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = GitAiToolWindowPanel(project)
        val content = ContentFactory.getInstance().createContent(panel.component, "Status", false)
        toolWindow.contentManager.addContent(content)

        val logsPanel = GitAiLogPanel(project)
        val logsContent = ContentFactory.getInstance().createContent(logsPanel.component, "Logs", false)
        toolWindow.contentManager.addContent(logsContent)

        Disposer.register(toolWindow.disposable, panel)
        Disposer.register(toolWindow.disposable, logsPanel)
    }
}

/**
 * Main status panel showing state info and action buttons.
 */
class GitAiToolWindowPanel(private val project: Project) : Disposable {
    val component: JPanel
    private val statusLabel = JLabel("✓ Idle")
    private val commitLabel = JLabel("")
    private val originalLabel = JLabel("")
    private val pendingLabel = JLabel("")

    init {
        component = JPanel(BorderLayout(0, 8)).apply {
            border = EmptyBorder(12, 12, 12, 12)
        }

        // Status section.
        val statusPanel = JPanel(BorderLayout()).apply {
            statusLabel.font = statusLabel.font.deriveFont(Font.BOLD, 14f)
            add(statusLabel, BorderLayout.CENTER)
        }

        // Info section.
        val infoPanel = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            add(commitLabel)
            add(Box.createVerticalStrut(4))
            add(originalLabel)
            add(Box.createVerticalStrut(4))
            add(pendingLabel)
        }

        // Actions section.
        val actionsPanel = JPanel(FlowLayout(FlowLayout.LEFT, 6, 0))
        actionsPanel.add(createButton("Retry", AllIcons.Actions.Refresh) {
            com.daidi.gitai.actions.RetryAction.execute(project)
        })
        actionsPanel.add(createButton("Undo", AllIcons.Actions.Undo) {
            com.daidi.gitai.actions.UndoAction.execute(project)
        })
        actionsPanel.add(createButton("Cancel", AllIcons.Actions.Cancel) {
            com.daidi.gitai.actions.CancelAction.execute(project)
        })
        actionsPanel.add(createButton("Push", AllIcons.Vcs.Push) {
            com.daidi.gitai.actions.ForcePushAction.execute(project)
        })

        component.add(statusPanel, BorderLayout.NORTH)
        component.add(infoPanel, BorderLayout.CENTER)
        component.add(actionsPanel, BorderLayout.SOUTH)

        // Listen for state changes.
        val stateService = project.service<GitAiStateService>()
        stateService.addListener { state -> updateUI(state) }
    }

    private fun updateUI(state: GitAiState) {
        SwingUtilities.invokeLater {
            when {
                state.isPolishing -> {
                    statusLabel.text = "AI 润色中..."
                    statusLabel.icon = AllIcons.Actions.Lightning
                }
                state.isPushing -> {
                    statusLabel.text = "推送中..."
                    statusLabel.icon = AllIcons.Vcs.Push
                }
                state.hasPendingPush -> {
                    statusLabel.text = "待推送..."
                    statusLabel.icon = AllIcons.Actions.Delay
                }
                else -> {
                    statusLabel.text = "空闲"
                    statusLabel.icon = AllIcons.Actions.Checked
                }
            }

            commitLabel.text = if (state.lastSha != null) "Commit: ${state.lastSha.take(8)}" else ""
            originalLabel.text = if (state.originalMsg != null) "Original: ${state.originalMsg}" else ""
            pendingLabel.text = if (state.pendingPush != null) {
                "Pending: ${state.pendingPush.remote}"
            } else ""
        }
    }

    private fun createButton(text: String, icon: Icon, action: () -> Unit): JButton {
        return JButton(text, icon).apply {
            addActionListener { action() }
            isFocusPainted = false
        }
    }

    override fun dispose() {}
}

/**
 * Log panel showing the latest daemon log output.
 */
class GitAiLogPanel(private val project: Project) : Disposable {
    val component: JPanel
    private val logArea = JTextArea().apply {
        isEditable = false
        font = Font(Font.MONOSPACED, Font.PLAIN, 12)
    }
    private var pollTimer: Timer? = null

    init {
        component = JPanel(BorderLayout())
        component.add(JBScrollPane(logArea), BorderLayout.CENTER)

        // Refresh button.
        val toolbar = JPanel(FlowLayout(FlowLayout.LEFT))
        toolbar.add(JButton("Refresh").apply {
            addActionListener { loadLatestLog() }
        })
        component.add(toolbar, BorderLayout.NORTH)

        // Start tailing.
        loadLatestLog()
        pollTimer = Timer("git-ai-log-poll", true).also {
            it.scheduleAtFixedRate(object : TimerTask() {
                override fun run() { loadLatestLog() }
            }, 1000, 2000)
        }
    }

    private fun loadLatestLog() {
        val stateService = project.service<GitAiStateService>()
        val logDir = stateService.getLogDir() ?: return
        val dir = File(logDir)
        if (!dir.exists()) return

        val latestLog = dir.listFiles()
            ?.filter { it.extension == "log" }
            ?.maxByOrNull { it.name }
            ?: return

        try {
            val content = latestLog.readText()
            SwingUtilities.invokeLater {
                if (logArea.text != content) {
                    logArea.text = content
                    logArea.caretPosition = logArea.text.length
                }
            }
        } catch (_: Exception) {}
    }

    override fun dispose() {
        pollTimer?.cancel()
        pollTimer = null
    }
}
