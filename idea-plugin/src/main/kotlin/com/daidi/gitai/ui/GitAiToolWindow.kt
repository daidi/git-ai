package com.daidi.gitai.ui

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.state.GitAiState
import com.daidi.gitai.state.GitAiStateService
import com.daidi.gitai.state.GitAiCli
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.intellij.icons.AllIcons
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBList
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.content.ContentFactory
import java.awt.BorderLayout
import java.awt.FlowLayout
import java.awt.Font
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import java.io.File
import java.util.Timer
import java.util.TimerTask
import javax.swing.*
import javax.swing.border.EmptyBorder

class GitAiToolWindowFactory : ToolWindowFactory, DumbAware {
    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = GitAiToolWindowPanel(project)
        val content = ContentFactory.getInstance().createContent(panel.component, GitAiBundle.message("toolwindow.tab.status"), false)
        toolWindow.contentManager.addContent(content)
        
        val historyPanel = GitAiHistoryPanel(project)
        val historyContent = ContentFactory.getInstance().createContent(historyPanel.component, GitAiBundle.message("toolwindow.tab.history"), false)
        toolWindow.contentManager.addContent(historyContent)
        
        val statsPanel = GitAiStatsPanel(project)
        val statsContent = ContentFactory.getInstance().createContent(statsPanel.component, GitAiBundle.message("toolwindow.tab.stats"), false)
        toolWindow.contentManager.addContent(statsContent)

        val logsPanel = GitAiLogPanel(project)
        val logsContent = ContentFactory.getInstance().createContent(logsPanel.component, GitAiBundle.message("toolwindow.tab.logs"), false)
        toolWindow.contentManager.addContent(logsContent)

        Disposer.register(toolWindow.disposable, panel)
        Disposer.register(toolWindow.disposable, logsPanel)
        Disposer.register(toolWindow.disposable, historyPanel)
        Disposer.register(toolWindow.disposable, statsPanel)
    }
}

class GitAiToolWindowPanel(private val project: Project) : Disposable {
    val component: JPanel
    private val statusLabel = JLabel(GitAiBundle.message("status.idle"))
    private val commitLabel = JLabel("")
    private val originalLabel = JLabel("")
    private val pendingLabel = JLabel("")

    init {
        component = JPanel(BorderLayout(0, 8)).apply {
            border = EmptyBorder(12, 12, 12, 12)
        }
        val statusPanel = JPanel(BorderLayout()).apply {
            statusLabel.font = statusLabel.font.deriveFont(Font.BOLD, 14f)
            add(statusLabel, BorderLayout.CENTER)
        }
        val infoPanel = JPanel().apply {
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            add(commitLabel)
            add(Box.createVerticalStrut(4))
            add(originalLabel)
            add(Box.createVerticalStrut(4))
            add(pendingLabel)
        }
        val actionsPanel = JPanel(FlowLayout(FlowLayout.LEFT, 6, 0))
        actionsPanel.add(createButton(GitAiBundle.message("toolwindow.btn.retry"), AllIcons.Actions.Refresh) {
            com.daidi.gitai.actions.RetryAction.execute(project)
        })
        actionsPanel.add(createButton(GitAiBundle.message("toolwindow.btn.undo"), AllIcons.Actions.Undo) {
            com.daidi.gitai.actions.UndoAction.execute(project)
        })
        actionsPanel.add(createButton(GitAiBundle.message("toolwindow.btn.cancel"), AllIcons.Actions.Cancel) {
            com.daidi.gitai.actions.CancelAction.execute(project)
        })
        actionsPanel.add(createButton(GitAiBundle.message("toolwindow.btn.push"), AllIcons.Vcs.Push) {
            com.daidi.gitai.actions.ForcePushAction.execute(project)
        })

        // Tools section
        val toolsPanel = JPanel(FlowLayout(FlowLayout.LEFT, 6, 0))
        toolsPanel.add(createButton(GitAiBundle.message("action.GitAi.SkipNextCommit.text"), AllIcons.Actions.Suspend) {
            val stateService = project.service<GitAiStateService>()
            val newState = stateService.state.copy(skipNext = true)
            Thread { stateService.saveState(newState) }.start()
        })
        toolsPanel.add(createButton(GitAiBundle.message("action.clean.title"), AllIcons.Actions.GC) {
            com.daidi.gitai.actions.CleanCommitsAction.execute(project)
        })
        toolsPanel.add(createButton(GitAiBundle.message("action.GitAi.OpenConfig.text"), AllIcons.General.Settings) {
            com.intellij.openapi.options.ShowSettingsUtil.getInstance().showSettingsDialog(project, "com.daidi.gitai.settings")
        })
        toolsPanel.add(createButton(GitAiBundle.message("action.GitAi.Init.text"), AllIcons.General.GearPlain) {
            val result = GitAiCli.run(project, "init")
            if (result.success) {
                Messages.showInfoMessage(project, GitAiBundle.message("action.init.success", result.stdout), GitAiBundle.message("notification.title"))
            } else {
                Messages.showErrorDialog(project, GitAiBundle.message("action.init.failed", result.stderr), GitAiBundle.message("notification.title"))
            }
        })

        val bottomWrap = JPanel(BorderLayout())
        bottomWrap.add(actionsPanel, BorderLayout.NORTH)
        bottomWrap.add(toolsPanel, BorderLayout.SOUTH)

        component.add(statusPanel, BorderLayout.NORTH)
        component.add(infoPanel, BorderLayout.CENTER)
        component.add(bottomWrap, BorderLayout.SOUTH)

        val stateService = project.service<GitAiStateService>()
        stateService.addListener { state -> updateUI(state) }
    }

    private fun updateUI(state: GitAiState) {
        SwingUtilities.invokeLater {
            when {
                state.isPolishing -> {
                    statusLabel.text = GitAiBundle.message("status.polishing")
                    statusLabel.icon = AllIcons.Actions.Lightning
                }
                state.isPushing -> {
                    statusLabel.text = GitAiBundle.message("status.pushing")
                    statusLabel.icon = AllIcons.Vcs.Push
                }
                state.hasPendingPush -> {
                    statusLabel.text = GitAiBundle.message("status.pendingPush")
                    statusLabel.icon = AllIcons.Actions.Suspend
                }
                else -> {
                    statusLabel.text = GitAiBundle.message("status.idle")
                    statusLabel.icon = AllIcons.Actions.Checked
                }
            }

            commitLabel.text = if (state.lastSha != null) GitAiBundle.message("status.commit", state.lastSha.take(8)) else ""
            originalLabel.text = if (state.originalMsg != null) GitAiBundle.message("status.original", state.originalMsg) else ""
            pendingLabel.text = if (state.pendingPush != null) {
                GitAiBundle.message("status.pending", state.pendingPush.remote)
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

        val toolbar = JPanel(FlowLayout(FlowLayout.LEFT))
        toolbar.add(JButton(GitAiBundle.message("toolwindow.btn.refresh")).apply {
            addActionListener { loadLatestLog() }
        })
        component.add(toolbar, BorderLayout.NORTH)

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

// --------------------------------------------------------
// Feature 3: Telemetry & Stats UI
// --------------------------------------------------------
data class TelemetryRecord(
    val timestamp: String,
    val repo: String,
    val model: String,
    @SerializedName("time_waited_ms") val timeWaitedMs: Long,
    @SerializedName("original_msg_len") val originalMsgLen: Int,
    @SerializedName("new_msg_len") val newMsgLen: Int,
    @SerializedName("estimated_time_saved_s") val estimatedTimeSavedS: Int
)

data class TelemetryStats(
    val records: List<TelemetryRecord>
)

class GitAiStatsPanel(private val project: Project) : Disposable {
    val component: JPanel = JPanel(BorderLayout(0, 10))
    private val htmlViewer = JEditorPane().apply {
        contentType = "text/html"
        isEditable = false
        isOpaque = false // crucial for inheriting the background theme seamlessly
        putClientProperty(JEditorPane.HONOR_DISPLAY_PROPERTIES, true)
        addHyperlinkListener { e ->
            if (e.eventType == javax.swing.event.HyperlinkEvent.EventType.ACTIVATED) {
                com.intellij.ide.BrowserUtil.browse(e.url)
            }
        }
    }
    private var isPolishing = false

    init {
        component.border = com.intellij.util.ui.JBUI.Borders.empty(16)
        
        val centerPanel = JPanel(BorderLayout()).apply {
            isOpaque = false
            add(htmlViewer, BorderLayout.CENTER)
        }
        
        component.add(centerPanel, BorderLayout.CENTER)
        
        val toolbar = JPanel(FlowLayout(FlowLayout.LEFT)).apply { isOpaque = false }
        toolbar.add(JButton(GitAiBundle.message("toolwindow.btn.refresh")).apply {
            addActionListener { refreshData() }
        })
        component.add(toolbar, BorderLayout.NORTH)
        
        project.service<GitAiStateService>().addListener { state ->
            if (isPolishing && state.isIdle) {
                refreshData()
            }
            isPolishing = state.isPolishing
        }
        renderHtml(0.0, 0)
        refreshData()
    }
    
    private fun renderHtml(hours: Double, count: Int) {
        val titleText = GitAiBundle.message("stats.title")
        val hoursSavedText = GitAiBundle.message("stats.hoursSaved")
        val commitsPolishedText = GitAiBundle.message("stats.commitsPolished", count)
        
        // Retrieve dynamic theme colors from UIUtil to seamlessly swap on Dark/Light modes
        val fgColor = String.format("#%06x", com.intellij.util.ui.UIUtil.getLabelForeground().rgb and 0xFFFFFF)
        val subColor = String.format("#%06x", com.intellij.util.ui.UIUtil.getContextHelpForeground().rgb and 0xFFFFFF)
        val accentColor = String.format("#%06x", com.intellij.util.ui.JBUI.CurrentTheme.Link.Foreground.ENABLED.rgb and 0xFFFFFF)
        
        htmlViewer.text = """
            <html>
            <body style="font-family: ${com.intellij.util.ui.UIUtil.getLabelFont().family}; text-align: center; margin: 0; padding: 20px;">
                <div style="font-size: 14px; font-weight: bold; margin-bottom: 24px; color: ' + subColor + ';">$titleText</div>
                
                <div style="font-size: 48px; font-weight: bold; color: $accentColor;">
                    ${String.format("%.1f", hours)}<span style="font-size: 20px; color: $subColor;">h</span>
                </div>
                <div style="font-size: 11px; font-weight: bold; margin-top: 8px; color: $subColor; text-transform: uppercase;">
                    $hoursSavedText
                </div>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px; margin-bottom: 20px;">
                    <tr><td style="border-top: 1px dashed $subColor; height: 1px;"></td></tr>
                </table>
                
                <div style="font-size: 14px; font-weight: bold; color: $fgColor;">
                    ✨ $commitsPolishedText
                </div>
            </body>
            </html>
        """.trimIndent()
    }
    
    private fun refreshData() {
        ApplicationManager.getApplication().executeOnPooledThread {
            val result = com.daidi.gitai.state.GitAiCli.run(project, "stats", "--json")
            if (result.success) {
                try {
                    val gson = Gson()
                    val stats: TelemetryStats = gson.fromJson(result.stdout, TelemetryStats::class.java)
                    var totalTime = 0
                    var count = 0
                    
                    val thirtyDaysAgo = System.currentTimeMillis() - 30L * 24 * 3600 * 1000
                    
                    stats.records.forEach { r ->
                        try {
                            val instant = java.time.Instant.parse(r.timestamp)
                            if (instant.toEpochMilli() > thirtyDaysAgo) {
                                count++
                                totalTime += r.estimatedTimeSavedS
                            }
                        } catch(_:Exception) {}
                    }
                    
                    val hours = totalTime / 3600.0
                    SwingUtilities.invokeLater {
                        renderHtml(hours, count)
                    }
                } catch (_: Exception) {}
            }
        }
    }
    override fun dispose() {}
}

// --------------------------------------------------------
// Feature 4: Git Notes Meta Integration UI
// --------------------------------------------------------
data class AiNote(
    val model: String?,
    @SerializedName("generation_time_ms") val generationTimeMs: Long?,
    @SerializedName("original_message") val originalMessage: String?,
    @SerializedName("estimated_time_saved_s") val estimatedTimeSavedS: Int?
)

data class CommitLog(
    val sha: String,
    val message: String,
    @SerializedName("ai_note") val aiNote: AiNote?
)

class GitAiHistoryPanel(private val project: Project) : Disposable {
    val component: JPanel = JPanel(BorderLayout())
    private val listModel = DefaultListModel<CommitLog>()
    private val jbList = JBList(listModel)
    private var isPolishing = false

    init {
        jbList.cellRenderer = object : DefaultListCellRenderer() {
            override fun getListCellRendererComponent(list: JList<*>, value: Any?, index: Int, isSelected: Boolean, cellHasFocus: Boolean): java.awt.Component {
                val c = super.getListCellRendererComponent(list, value, index, isSelected, cellHasFocus) as JLabel
                if (value is CommitLog) {
                    val shortMsg = value.message.lines().firstOrNull()?.take(60) ?: ""
                    c.text = "<html><code>${value.sha.take(7)}</code> - $shortMsg</html>"
                    c.icon = if (value.aiNote != null) AllIcons.Actions.Lightning else AllIcons.Vcs.CommitNode
                }
                return c
            }
        }
        
        jbList.addMouseListener(object : MouseAdapter() {
            override fun mouseClicked(e: MouseEvent) {
                if (e.clickCount == 2) {
                    val index = jbList.locationToIndex(e.point)
                    if (index >= 0) {
                        val item = listModel[index]
                        if (item.aiNote != null) {
                            showAiNotePopup(item)
                        } else {
                            Messages.showInfoMessage(project, item.message, "Commit Message")
                        }
                    }
                }
            }
        })

        component.add(JBScrollPane(jbList), BorderLayout.CENTER)
        
        val toolbar = JPanel(FlowLayout(FlowLayout.LEFT))
        toolbar.add(JButton(GitAiBundle.message("toolwindow.btn.refresh")).apply {
            addActionListener { refreshData() }
        })
        component.add(toolbar, BorderLayout.NORTH)
        
        project.service<GitAiStateService>().addListener { state ->
            if (isPolishing && state.isIdle) {
                refreshData()
            }
            isPolishing = state.isPolishing
        }
        refreshData()
    }
    
    private fun showAiNotePopup(item: CommitLog) {
        val msg = """
            Model: ${item.aiNote?.model ?: "Unknown"}
            Generation Time: ${item.aiNote?.generationTimeMs ?: 0}ms
            Time Saved: ${item.aiNote?.estimatedTimeSavedS ?: 0}s
            
            Original Draft:
            ${item.aiNote?.originalMessage ?: ""}
            
            -------------------
            Final Message:
            ${item.message}
        """.trimIndent()
        Messages.showInfoMessage(project, msg, "AI Authorship Note")
    }

    private fun refreshData() {
        ApplicationManager.getApplication().executeOnPooledThread {
            val result = com.daidi.gitai.state.GitAiCli.run(project, "log", "--json")
            if (result.success) {
                try {
                    val gson = Gson()
                    val type = object : com.google.gson.reflect.TypeToken<List<CommitLog>>() {}.type
                    val logs: List<CommitLog> = gson.fromJson(result.stdout, type)
                    SwingUtilities.invokeLater {
                        listModel.clear()
                        logs.forEach { listModel.addElement(it) }
                    }
                } catch (_: Exception) {}
            }
        }
    }
    override fun dispose() {}
}
