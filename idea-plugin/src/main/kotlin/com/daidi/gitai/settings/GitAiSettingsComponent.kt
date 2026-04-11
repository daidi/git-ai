package com.daidi.gitai.settings

import com.daidi.gitai.GitAiBundle
import com.intellij.ui.ContextHelpLabel
import com.intellij.ui.IdeBorderFactory
import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import java.awt.BorderLayout
import java.awt.Dimension
import java.awt.FlowLayout
import java.awt.Font
import javax.swing.*
import javax.swing.border.EmptyBorder

/**
 * Swing component for the git-ai settings form.
 * Supports dual-scope editing (Global / Project) with a tab switcher.
 * Uses FormBuilder and GitAiBundle for i18n support.
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
    val pEnabled = JCheckBox(GitAiBundle.message("settings.field.projectEnabled"))

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
        val globalTab = JToggleButton(GitAiBundle.message("settings.tab.global")).apply {
            isSelected = true
            addActionListener {
                isSelected = true
                cardLayout.show(contentPanel, "global")
            }
        }
        val projectTab = JToggleButton(GitAiBundle.message("settings.tab.project")).apply {
            isEnabled = basePath != null
            toolTipText = if (basePath == null) GitAiBundle.message("settings.project.tooltip.disabled") 
                          else GitAiBundle.message("settings.project.tooltip")
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
            val title = JLabel(GitAiBundle.message("settings.title")).apply {
                font = getFont().deriveFont(Font.BOLD, 16f)
            }
            add(title, BorderLayout.NORTH)
            val subtitle = JLabel(GitAiBundle.message("settings.subtitle")).apply {
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
            .addComponent(createSectionLabel(GitAiBundle.message("settings.section.auth")))
            .addLabeledComponent(createLabelWithHelp("settings.field.apiKey", "settings.hint.apiKey"), gApiKey.apply { columns = 40 })
            .addLabeledComponent(GitAiBundle.message("settings.field.provider"), gProvider)
            .addLabeledComponent(GitAiBundle.message("settings.field.baseUrl"), gBaseUrl)
            .addLabeledComponent(GitAiBundle.message("settings.field.model"), gModel)
            
            .addComponent(createSectionLabel(GitAiBundle.message("settings.section.format")))
            .addLabeledComponent(GitAiBundle.message("settings.field.messageFormat"), gMessageFormat)
            .addLabeledComponent(GitAiBundle.message("settings.field.language"), gLanguage)
            .addLabeledComponent(createLabelWithHelp("settings.field.promptTemplate", "settings.hint.promptTemplate"), gPromptTemplate)
            
            .addComponent(createSectionLabel(GitAiBundle.message("settings.section.behavior")))
            .addLabeledComponent(createLabelWithHelp("settings.field.pushPolicy", "settings.hint.pushPolicy"), gPushPolicy)
            .addLabeledComponent(createLabelWithHelp("settings.field.maxDiffTokens", "settings.hint.maxDiffTokens"), gMaxDiffTokens.apply { columns = 10 })
            
            .addComponentFillVertically(JPanel(), 0)
            .panel.apply { border = EmptyBorder(10, 0, 0, 0) }
    }

    private fun buildProjectForm(): JPanel {
        val form = FormBuilder.createFormBuilder()
            .addComponent(pEnabled.apply { font = font.deriveFont(Font.BOLD) })
            .addComponent(Box.createVerticalStrut(16))
            .addComponent(createSectionLabel(GitAiBundle.message("settings.section.auth")))
            .addLabeledComponent(createLabelWithHelp("settings.field.apiKey", "settings.hint.apiKey"), pApiKey.apply { columns = 40 })
            .addLabeledComponent(GitAiBundle.message("settings.field.provider"), pProvider)
            .addLabeledComponent(GitAiBundle.message("settings.field.baseUrl"), pBaseUrl)
            .addLabeledComponent(GitAiBundle.message("settings.field.model"), pModel)
            
            .addComponent(createSectionLabel(GitAiBundle.message("settings.section.format")))
            .addLabeledComponent(GitAiBundle.message("settings.field.messageFormat"), pMessageFormat)
            .addLabeledComponent(GitAiBundle.message("settings.field.language"), pLanguage)
            .addLabeledComponent(createLabelWithHelp("settings.field.promptTemplate", "settings.hint.promptTemplate"), pPromptTemplate)
            
            .addComponent(createSectionLabel(GitAiBundle.message("settings.section.behavior")))
            .addLabeledComponent(createLabelWithHelp("settings.field.pushPolicy", "settings.hint.pushPolicy"), pPushPolicy)
            .addLabeledComponent(createLabelWithHelp("settings.field.maxDiffTokens", "settings.hint.maxDiffTokens"), pMaxDiffTokens.apply { columns = 10 })
            
            .addComponentFillVertically(JPanel(), 0)
            .panel.apply { border = EmptyBorder(10, 0, 0, 0) }
            
        pEnabled.addActionListener { updateProjectFieldsState() }
        return form
    }

    private fun updateProjectFieldsState() {
        val enabled = pEnabled.isSelected
        pApiKey.isEnabled = enabled
        pProvider.isEnabled = enabled
        pBaseUrl.isEnabled = enabled
        pModel.isEnabled = enabled
        pMessageFormat.isEnabled = enabled
        pLanguage.isEnabled = enabled
        pPushPolicy.isEnabled = enabled
        pPromptTemplate.isEnabled = enabled
        pMaxDiffTokens.isEnabled = enabled
    }

    private fun createSectionLabel(text: String): JPanel {
        val panel = JPanel(BorderLayout())
        panel.border = IdeBorderFactory.createTitledBorder(text, true)
        panel.add(Box.createVerticalStrut(10), BorderLayout.CENTER)
        return panel
    }

    private fun createLabelWithHelp(keyLabel: String, keyHint: String): JPanel {
        val panel = JPanel(FlowLayout(FlowLayout.LEFT, 4, 0))
        panel.add(JLabel(GitAiBundle.message(keyLabel)))
        panel.add(ContextHelpLabel.create(GitAiBundle.message(keyHint)))
        return panel
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
        pBaseUrl.emptyText.setText(inheritedVal(inherited.baseUrl ?: ""))
        
        pModel.text = cfg.model ?: ""
        pModel.emptyText.setText(inheritedVal(inherited.model ?: ""))
        
        pMessageFormat.selectedItem = cfg.messageFormat ?: ""
        pLanguage.selectedItem = cfg.language ?: ""
        pPushPolicy.selectedItem = cfg.pushPolicy ?: ""
        
        pPromptTemplate.text = cfg.promptTemplate ?: ""
        pPromptTemplate.emptyText.setText(inheritedVal(inherited.promptTemplate ?: ""))
        
        pMaxDiffTokens.text = cfg.maxDiffTokens?.toString() ?: ""
        pMaxDiffTokens.emptyText.setText(inheritedVal((inherited.maxDiffTokens ?: 4000).toString()))
    }

    private fun inheritedVal(v: String): String {
        if (v.isEmpty()) return GitAiBundle.message("settings.inherit.label")
        return GitAiBundle.message("settings.inherit.value", v)
    }
}
