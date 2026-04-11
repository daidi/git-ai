package com.daidi.gitai.settings

import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.*
import javax.swing.border.EmptyBorder
import java.awt.BorderLayout
import java.awt.Dimension
import java.awt.FlowLayout
import java.awt.Font

/**
 * Swing component for the git-ai settings form.
 * Supports dual-scope editing (Global / Project) with a tab switcher.
 * In Project scope, placeholders show inherited values from Global.
 */
class GitAiSettingsComponent(private val basePath: String?) {

    val mainPanel: JPanel = JPanel(BorderLayout())

    // ── Global fields ──
    private val gApiKey = JBPasswordField()
    private val gProvider = JComboBox(arrayOf("openai", "ollama"))
    private val gBaseUrl = JBTextField()
    private val gModel = JBTextField()
    private val gMessageFormat = JComboBox(arrayOf("conventional", "plain", "gitmoji", "subject-body"))
    private val gLanguage = JComboBox(arrayOf("en", "zh-CN", "ja", "ko", "es", "fr", "de"))
    private val gPushPolicy = JComboBox(arrayOf("queue", "block"))
    private val gPromptTemplate = JBTextField()
    private val gMaxDiffTokens = JBTextField()

    // ── Project fields ──
    private val pApiKey = JBPasswordField()
    private val pProvider = JComboBox(arrayOf("", "openai", "ollama"))
    private val pBaseUrl = JBTextField()
    private val pModel = JBTextField()
    private val pMessageFormat = JComboBox(arrayOf("", "conventional", "plain", "gitmoji", "subject-body"))
    private val pLanguage = JComboBox(arrayOf("", "en", "zh-CN", "ja", "ko", "es", "fr", "de"))
    private val pPushPolicy = JComboBox(arrayOf("", "queue", "block"))
    private val pPromptTemplate = JBTextField()
    private val pMaxDiffTokens = JBTextField()

    private val globalPanel: JPanel
    private val projectPanel: JPanel
    private val cardLayout = java.awt.CardLayout()
    private val contentPanel = JPanel(cardLayout)

    init {
        globalPanel = buildGlobalForm()
        projectPanel = buildProjectForm()

        contentPanel.add(globalPanel, "global")
        contentPanel.add(projectPanel, "project")

        // Tab bar
        val tabBar = JPanel(FlowLayout(FlowLayout.LEFT, 0, 0))
        val globalTab = JToggleButton("🌍 Global").apply {
            isSelected = true
            addActionListener {
                isSelected = true
                cardLayout.show(contentPanel, "global")
            }
        }
        val projectTab = JToggleButton("📁 Project").apply {
            isEnabled = basePath != null
            toolTipText = if (basePath == null) "Open a project first" else "Override settings for this project"
            addActionListener {
                isSelected = true
                cardLayout.show(contentPanel, "project")
            }
        }

        val tabGroup = ButtonGroup()
        tabGroup.add(globalTab)
        tabGroup.add(projectTab)
        tabBar.add(globalTab)
        tabBar.add(projectTab)

        // Header
        val header = JPanel(BorderLayout()).apply {
            border = EmptyBorder(0, 0, 8, 0)
            val title = JLabel("git-ai Settings").apply {
                font = getFont().deriveFont(Font.BOLD, 16f)
            }
            add(title, BorderLayout.NORTH)
            val subtitle = JLabel("Project settings override Global. Leave empty to inherit.").apply {
                font = getFont().deriveFont(Font.PLAIN, 12f)
                foreground = java.awt.Color.GRAY
            }
            add(subtitle, BorderLayout.CENTER)
            add(tabBar, BorderLayout.SOUTH)
        }

        val scrollPane = JBScrollPane(contentPanel).apply {
            border = null
            verticalScrollBar.unitIncrement = 16
        }

        mainPanel.add(header, BorderLayout.NORTH)
        mainPanel.add(scrollPane, BorderLayout.CENTER)
        mainPanel.preferredSize = Dimension(600, 520)
    }

    // ── Build forms ──

    private fun buildGlobalForm(): JPanel {
        return FormBuilder.createFormBuilder()
            .addSeparator()
            .addLabeledComponent("API Key:", gApiKey.apply { columns = 40 }, true)
            .addLabeledComponent("Provider:", gProvider, true)
            .addLabeledComponent("Base URL:", gBaseUrl, true)
            .addLabeledComponent("Model:", gModel, true)
            .addSeparator()
            .addLabeledComponent("Message Format:", gMessageFormat, true)
            .addLabeledComponent("Language:", gLanguage, true)
            .addLabeledComponent("Custom Prompt:", gPromptTemplate, true)
            .addSeparator()
            .addLabeledComponent("Push Policy:", gPushPolicy, true)
            .addLabeledComponent("Max Diff Tokens:", gMaxDiffTokens.apply { columns = 10 }, true)
            .addComponentFillVertically(JPanel(), 0)
            .panel
    }

    private fun buildProjectForm(): JPanel {
        return FormBuilder.createFormBuilder()
            .addSeparator()
            .addLabeledComponent("API Key:", pApiKey.apply { columns = 40 }, true)
            .addLabeledComponent("Provider:", pProvider, true)
            .addLabeledComponent("Base URL:", pBaseUrl, true)
            .addLabeledComponent("Model:", pModel, true)
            .addSeparator()
            .addLabeledComponent("Message Format:", pMessageFormat, true)
            .addLabeledComponent("Language:", pLanguage, true)
            .addLabeledComponent("Custom Prompt:", pPromptTemplate, true)
            .addSeparator()
            .addLabeledComponent("Push Policy:", pPushPolicy, true)
            .addLabeledComponent("Max Diff Tokens:", pMaxDiffTokens.apply { columns = 10 }, true)
            .addComponentFillVertically(JPanel(), 0)
            .panel
    }

    // ── Get / Set ──

    fun getGlobalConfig(): GitAiConfig = GitAiConfig(
        apiKey = String(gApiKey.password).takeIf { it.isNotEmpty() },
        provider = gProvider.selectedItem as? String,
        baseUrl = gBaseUrl.text.takeIf { it.isNotEmpty() },
        model = gModel.text.takeIf { it.isNotEmpty() },
        messageFormat = gMessageFormat.selectedItem as? String,
        language = gLanguage.selectedItem as? String,
        pushPolicy = gPushPolicy.selectedItem as? String,
        promptTemplate = gPromptTemplate.text.takeIf { it.isNotEmpty() },
        maxDiffTokens = gMaxDiffTokens.text.toIntOrNull(),
    )

    fun setGlobalConfig(cfg: GitAiConfig) {
        gApiKey.text = cfg.apiKey ?: ""
        gProvider.selectedItem = cfg.provider ?: "openai"
        gBaseUrl.text = cfg.baseUrl ?: ""
        gModel.text = cfg.model ?: ""
        gMessageFormat.selectedItem = cfg.messageFormat ?: "conventional"
        gLanguage.selectedItem = cfg.language ?: "en"
        gPushPolicy.selectedItem = cfg.pushPolicy ?: "queue"
        gPromptTemplate.text = cfg.promptTemplate ?: ""
        gMaxDiffTokens.text = cfg.maxDiffTokens?.toString() ?: ""
    }

    fun getProjectConfig(): GitAiConfig {
        val selectedProvider = pProvider.selectedItem as? String
        val selectedFormat = pMessageFormat.selectedItem as? String
        val selectedLang = pLanguage.selectedItem as? String
        val selectedPolicy = pPushPolicy.selectedItem as? String

        return GitAiConfig(
            apiKey = String(pApiKey.password).takeIf { it.isNotEmpty() },
            provider = selectedProvider?.takeIf { it.isNotEmpty() },
            baseUrl = pBaseUrl.text.takeIf { it.isNotEmpty() },
            model = pModel.text.takeIf { it.isNotEmpty() },
            messageFormat = selectedFormat?.takeIf { it.isNotEmpty() },
            language = selectedLang?.takeIf { it.isNotEmpty() },
            pushPolicy = selectedPolicy?.takeIf { it.isNotEmpty() },
            promptTemplate = pPromptTemplate.text.takeIf { it.isNotEmpty() },
            maxDiffTokens = pMaxDiffTokens.text.toIntOrNull(),
        )
    }

    fun setProjectConfig(cfg: GitAiConfig, inherited: GitAiConfig) {
        pApiKey.text = cfg.apiKey ?: ""
        pProvider.selectedItem = cfg.provider ?: ""
        pBaseUrl.text = cfg.baseUrl ?: ""
        pBaseUrl.emptyText.setText("← ${inherited.baseUrl ?: ""}")
        pModel.text = cfg.model ?: ""
        pModel.emptyText.setText("← ${inherited.model ?: ""}")
        pMessageFormat.selectedItem = cfg.messageFormat ?: ""
        pLanguage.selectedItem = cfg.language ?: ""
        pPushPolicy.selectedItem = cfg.pushPolicy ?: ""
        pPromptTemplate.text = cfg.promptTemplate ?: ""
        pPromptTemplate.emptyText.setText("← ${inherited.promptTemplate ?: "(default)"}")
        pMaxDiffTokens.text = cfg.maxDiffTokens?.toString() ?: ""
        pMaxDiffTokens.emptyText.setText("← ${inherited.maxDiffTokens ?: 4000}")
    }
}
