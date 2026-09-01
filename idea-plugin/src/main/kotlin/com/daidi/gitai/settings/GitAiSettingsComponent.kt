package com.daidi.gitai.settings

import com.daidi.gitai.GitAiBundle
import com.intellij.openapi.ui.ComboBox
import com.intellij.ui.DocumentAdapter
import com.intellij.ui.JBColor
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.components.JBTextField
import com.intellij.ui.dsl.builder.AlignX
import com.intellij.ui.dsl.builder.TopGap
import com.intellij.ui.dsl.builder.panel
import com.intellij.util.ui.JBUI
import com.intellij.util.ui.UIUtil
import java.awt.BorderLayout
import java.awt.CardLayout
import java.awt.Component
import java.awt.Dimension
import java.awt.Font
import java.awt.Graphics
import java.awt.Graphics2D
import java.awt.GridLayout
import java.awt.RenderingHints
import javax.swing.Box
import javax.swing.BoxLayout
import javax.swing.ButtonGroup
import javax.swing.DefaultListCellRenderer
import javax.swing.JButton
import javax.swing.JComponent
import javax.swing.JList
import javax.swing.JPanel
import javax.swing.JToggleButton
import javax.swing.event.DocumentEvent
import javax.swing.text.JTextComponent

/**
 * Native, theme-aware settings surface for global defaults and project overrides.
 * Persistence remains exclusively owned by the CLI; this component only edits a
 * transient Swing model.
 */
class GitAiSettingsComponent(private val basePath: String?) {

    val mainPanel: JPanel = JPanel(BorderLayout()).apply {
        isOpaque = false
        border = JBUI.Borders.empty(4, 12, 0, 12)
        preferredSize = Dimension(JBUI.scale(760), JBUI.scale(640))
    }

    // Global fields.
    private val gApiKey = JBPasswordField().apply { columns = 36 }
    private val gProvider = ComboBox(arrayOf("openai", "ollama", "anthropic", "gemini"))
    private val gBaseUrl = JBTextField().apply { columns = 36 }
    private val gModel = JBTextField().apply { columns = 36 }
    private val gMessageFormat = ComboBox(arrayOf("conventional", "plain", "gitmoji", "subject-body"))
    private val gSmartSkip = JBCheckBox(GitAiBundle.message("settings.field.smartSkip"))
    private val gLanguage = ComboBox(arrayOf("en", "zh-CN", "ja", "ko", "es", "fr", "de"))
    private val gPushPolicy = ComboBox(arrayOf("queue", "block"))
    private val gPromptTemplate = promptArea()
    private val gMaxDiffTokens = JBTextField().apply { columns = 12 }
    private val gLogLevel = ComboBox(arrayOf("error", "info", "debug"))
    private val gUiLanguage = ComboBox(arrayOf("", "en", "zh"))
    private val gExplain = JBCheckBox(GitAiBundle.message("settings.field.explain"))
    val gTestConfigBtn = JButton(GitAiBundle.message("settings.btn.testConfig"))

    // Project fields. Blank values intentionally represent inheritance.
    private val pProvider = inheritedCombo("openai", "ollama", "anthropic", "gemini")
    private val pBaseUrl = JBTextField().apply { columns = 36 }
    private val pModel = JBTextField().apply { columns = 36 }
    private val pMessageFormat = inheritedCombo("conventional", "plain", "gitmoji", "subject-body")
    private val pSmartSkip = inheritedCombo("true", "false")
    private val pLanguage = inheritedCombo("en", "zh-CN", "ja", "ko", "es", "fr", "de")
    private val pPushPolicy = inheritedCombo("queue", "block")
    private val pPromptTemplate = promptArea()
    private val pMaxDiffTokens = JBTextField().apply { columns = 12 }
    private val pLogLevel = inheritedCombo("error", "info", "debug")
    private val pUiLanguage = inheritedCombo("en", "zh")
    private val pExplain = inheritedCombo("true", "false")
    val pTestConfigBtn = JButton(GitAiBundle.message("settings.btn.testConfig"))
    val pEnabled = JBCheckBox(GitAiBundle.message("settings.field.projectEnabled"))

    private val globalTabText = GitAiBundle.message("settings.tab.global")
    private val projectTabText = GitAiBundle.message("settings.tab.project")
    private val globalTab = scopeButton(globalTabText, "first")
    private val projectTab = scopeButton(projectTabText, "last")
    private val cardLayout = CardLayout()
    private val contentPanel = JPanel(cardLayout).apply { isOpaque = false }

    private val globalProviderMetric = MetricCard(GitAiBundle.message("settings.field.provider"))
    private val globalModelMetric = MetricCard(GitAiBundle.message("settings.field.model"))
    private val globalFormatMetric = MetricCard(GitAiBundle.message("settings.field.messageFormat"))
    private val globalKeyMetric = MetricCard(GitAiBundle.message("settings.field.apiKey"))
    private val projectProviderMetric = MetricCard(GitAiBundle.message("settings.field.provider"))
    private val projectModelMetric = MetricCard(GitAiBundle.message("settings.field.model"))
    private val projectFormatMetric = MetricCard(GitAiBundle.message("settings.field.messageFormat"))
    private val projectPushMetric = MetricCard(GitAiBundle.message("settings.field.pushPolicy"))

    private var apiKeyConfigured = false
    private var changeListener: () -> Unit = {}
    private var suppressEvents = false
    private var uiEnabled = true
    private var globalTestAllowed = false
    private var projectTestAllowed = false
    private var baselineGlobal: GitAiConfig? = null
    private var baselineProject: GitAiConfig? = null
    private var baselineProjectEnabled = false

    init {
        configureAccessibility()
        installListeners()

        contentPanel.add(buildScopePanel(buildGlobalOverview(), buildGlobalForm()), GLOBAL_CARD)
        contentPanel.add(buildScopePanel(buildProjectOverview(), buildProjectForm()), PROJECT_CARD)

        ButtonGroup().apply {
            add(globalTab)
            add(projectTab)
        }
        globalTab.isSelected = true
        globalTab.addActionListener { showScope(GLOBAL_CARD) }
        projectTab.apply {
            isEnabled = basePath != null
            toolTipText = if (basePath == null) {
                GitAiBundle.message("settings.project.tooltip.disabled")
            } else {
                GitAiBundle.message("settings.project.tooltip")
            }
            addActionListener { showScope(PROJECT_CARD) }
        }

        val scrollPane = JBScrollPane(contentPanel).apply {
            border = JBUI.Borders.empty()
            horizontalScrollBarPolicy = JBScrollPane.HORIZONTAL_SCROLLBAR_NEVER
            verticalScrollBar.unitIncrement = JBUI.scale(16)
            viewport.isOpaque = false
            isOpaque = false
        }

        mainPanel.add(buildHeader(), BorderLayout.NORTH)
        mainPanel.add(scrollPane, BorderLayout.CENTER)
        updateAllStates()
    }

    fun setChangeListener(listener: () -> Unit) {
        changeListener = listener
    }

    fun getPreferredFocusedComponent(): JComponent =
        if (gProvider.selectedItem == "ollama") gProvider else gApiKey

    /** Marks the current transient model as the last applied state. */
    fun markBaseline() {
        baselineGlobal = getGlobalConfig()
        baselineProject = getProjectConfig()
        baselineProjectEnabled = pEnabled.isSelected
        updateDirtyIndicators()
    }

    fun setLoading(isLoading: Boolean) {
        uiEnabled = !isLoading
        updateAllStates()
    }

    fun setTestActionsEnabled(globalEnabled: Boolean, projectEnabled: Boolean) {
        globalTestAllowed = globalEnabled
        projectTestAllowed = projectEnabled
        updateTestActions()
    }

    private fun buildHeader(): JPanel {
        val title = JBLabel(GitAiBundle.message("settings.title")).apply {
            font = UIUtil.getLabelFont().deriveFont(Font.BOLD, UIUtil.getLabelFont().size2D + 5f)
        }
        val subtitle = JBLabel(GitAiBundle.message("settings.subtitle")).apply {
            foreground = UIUtil.getContextHelpForeground()
            border = JBUI.Borders.emptyTop(4)
        }
        val titleBlock = JPanel().apply {
            isOpaque = false
            layout = BoxLayout(this, BoxLayout.Y_AXIS)
            add(title)
            add(subtitle)
        }

        val tabs = JPanel().apply {
            isOpaque = false
            layout = BoxLayout(this, BoxLayout.X_AXIS)
            border = JBUI.Borders.emptyTop(14)
            add(globalTab)
            add(projectTab)
            add(Box.createHorizontalGlue())
        }

        return JPanel(BorderLayout()).apply {
            isOpaque = false
            border = JBUI.Borders.compound(
                JBUI.Borders.customLineBottom(borderColor()),
                JBUI.Borders.empty(12, 4, 14, 4),
            )
            add(titleBlock, BorderLayout.CENTER)
            add(tabs, BorderLayout.SOUTH)
        }
    }

    private fun buildScopePanel(overview: JPanel, form: JPanel): JPanel = JPanel(BorderLayout()).apply {
        isOpaque = false
        border = JBUI.Borders.empty(16, 4, 24, 4)
        add(overview, BorderLayout.NORTH)
        add(form, BorderLayout.CENTER)
    }

    private fun buildGlobalOverview(): JPanel = overviewPanel(
        globalProviderMetric,
        globalModelMetric,
        globalFormatMetric,
        globalKeyMetric,
    )

    private fun buildProjectOverview(): JPanel = overviewPanel(
        projectProviderMetric,
        projectModelMetric,
        projectFormatMetric,
        projectPushMetric,
    )

    private fun overviewPanel(vararg metrics: MetricCard): JPanel = JPanel(GridLayout(1, metrics.size, 8, 0)).apply {
        isOpaque = false
        border = JBUI.Borders.emptyBottom(18)
        metrics.forEach(::add)
    }

    private fun buildGlobalForm(): JPanel = panel {
        group(GitAiBundle.message("settings.section.auth")) {
            row(GitAiBundle.message("settings.field.provider")) {
                cell(gProvider).align(AlignX.FILL).resizableColumn()
            }
            row(GitAiBundle.message("settings.field.apiKey")) {
                cell(gApiKey)
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.apiKey"))
            }
            row(GitAiBundle.message("settings.field.baseUrl")) {
                cell(gBaseUrl).align(AlignX.FILL).resizableColumn()
            }
            row(GitAiBundle.message("settings.field.model")) {
                cell(gModel).align(AlignX.FILL).resizableColumn()
            }
        }
        group(GitAiBundle.message("settings.section.format")) {
            row(GitAiBundle.message("settings.field.messageFormat")) {
                cell(gMessageFormat).align(AlignX.FILL).resizableColumn()
            }
            row {
                cell(gSmartSkip)
                    .comment(GitAiBundle.message("settings.hint.smartSkip"))
            }
            row(GitAiBundle.message("settings.field.language")) {
                cell(gLanguage).align(AlignX.FILL).resizableColumn()
            }
            row(GitAiBundle.message("settings.field.promptTemplate")) {
                cell(JBScrollPane(gPromptTemplate))
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.promptTemplate"))
            }.resizableRow()
        }
        group(GitAiBundle.message("settings.section.behavior")) {
            row(GitAiBundle.message("settings.field.pushPolicy")) {
                cell(gPushPolicy)
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.pushPolicy"))
            }
            row(GitAiBundle.message("settings.field.maxDiffTokens")) {
                cell(gMaxDiffTokens)
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.maxDiffTokens"))
            }
            row(GitAiBundle.message("settings.field.logLevel")) {
                cell(gLogLevel).align(AlignX.FILL).resizableColumn()
            }
            row(GitAiBundle.message("settings.field.uiLanguage")) {
                cell(gUiLanguage)
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.uiLanguage"))
            }
            row {
                cell(gExplain)
                    .comment(GitAiBundle.message("settings.hint.explain"))
            }
            row {
                cell(gTestConfigBtn)
            }.topGap(TopGap.MEDIUM)
        }
    }.apply {
        isOpaque = false
    }

    private fun buildProjectForm(): JPanel = panel {
        row {
            cell(pEnabled).bold()
        }
        group(GitAiBundle.message("settings.section.auth")) {
            row(GitAiBundle.message("settings.field.provider")) {
                cell(pProvider).align(AlignX.FILL).resizableColumn()
            }
            row(GitAiBundle.message("settings.field.baseUrl")) {
                cell(pBaseUrl).align(AlignX.FILL).resizableColumn()
            }
            row(GitAiBundle.message("settings.field.model")) {
                cell(pModel).align(AlignX.FILL).resizableColumn()
            }
        }
        group(GitAiBundle.message("settings.section.format")) {
            row(GitAiBundle.message("settings.field.messageFormat")) {
                cell(pMessageFormat).align(AlignX.FILL).resizableColumn()
            }
            row(GitAiBundle.message("settings.field.smartSkip")) {
                cell(pSmartSkip)
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.smartSkip"))
            }
            row(GitAiBundle.message("settings.field.language")) {
                cell(pLanguage).align(AlignX.FILL).resizableColumn()
            }
            row(GitAiBundle.message("settings.field.promptTemplate")) {
                cell(JBScrollPane(pPromptTemplate))
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.promptTemplate"))
            }.resizableRow()
        }
        group(GitAiBundle.message("settings.section.behavior")) {
            row(GitAiBundle.message("settings.field.pushPolicy")) {
                cell(pPushPolicy)
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.pushPolicy"))
            }
            row(GitAiBundle.message("settings.field.maxDiffTokens")) {
                cell(pMaxDiffTokens)
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.maxDiffTokens"))
            }
            row(GitAiBundle.message("settings.field.logLevel")) {
                cell(pLogLevel).align(AlignX.FILL).resizableColumn()
            }
            row(GitAiBundle.message("settings.field.uiLanguage")) {
                cell(pUiLanguage)
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.uiLanguage"))
            }
            row(GitAiBundle.message("settings.field.explain")) {
                cell(pExplain)
                    .align(AlignX.FILL)
                    .resizableColumn()
                    .comment(GitAiBundle.message("settings.hint.explain"))
            }
            row {
                cell(pTestConfigBtn)
            }.topGap(TopGap.MEDIUM)
        }
    }.apply {
        isOpaque = false
    }

    private fun installListeners() {
        listOf(
            gApiKey,
            gBaseUrl,
            gModel,
            gPromptTemplate,
            gMaxDiffTokens,
            pBaseUrl,
            pModel,
            pPromptTemplate,
            pMaxDiffTokens,
        ).forEach(::watch)

        listOf(
            gProvider,
            gMessageFormat,
            gLanguage,
            gPushPolicy,
            gLogLevel,
            gUiLanguage,
            pProvider,
            pMessageFormat,
            pSmartSkip,
            pLanguage,
            pPushPolicy,
            pLogLevel,
            pUiLanguage,
            pExplain,
        ).forEach { it.addActionListener { modelChanged() } }

        listOf(gSmartSkip, gExplain, pEnabled).forEach {
            it.addActionListener { modelChanged() }
        }
    }

    private fun watch(component: JTextComponent) {
        component.document.addDocumentListener(object : DocumentAdapter() {
            override fun textChanged(e: DocumentEvent) = modelChanged()
        })
    }

    private fun modelChanged() {
        updateAllStates()
        if (!suppressEvents) changeListener()
    }

    private fun updateAllStates() {
        globalTab.isEnabled = uiEnabled
        projectTab.isEnabled = uiEnabled && basePath != null
        updateGlobalFieldsState()
        updateProjectFieldsState()
        updateOverview()
        updateDirtyIndicators()
        updateTestActions()
    }

    private fun updateGlobalFieldsState() {
        val hasCustomPrompt = gPromptTemplate.text.isNotBlank()
        val localProvider = gProvider.selectedItem != "ollama"

        gProvider.isEnabled = uiEnabled
        gApiKey.isEnabled = uiEnabled && localProvider
        gBaseUrl.isEnabled = uiEnabled
        gModel.isEnabled = uiEnabled
        gMessageFormat.isEnabled = uiEnabled && !hasCustomPrompt
        gSmartSkip.isEnabled = uiEnabled && !hasCustomPrompt
        gLanguage.isEnabled = uiEnabled
        gPushPolicy.isEnabled = uiEnabled
        gPromptTemplate.isEnabled = uiEnabled
        gMaxDiffTokens.isEnabled = uiEnabled
        gLogLevel.isEnabled = uiEnabled
        gUiLanguage.isEnabled = uiEnabled
        gExplain.isEnabled = uiEnabled && !hasCustomPrompt

        val tooltip = if (hasCustomPrompt) GitAiBundle.message("settings.hint.disabledTemplate") else null
        gMessageFormat.toolTipText = tooltip
        gSmartSkip.toolTipText = tooltip
        gExplain.toolTipText = tooltip
        gApiKey.setPasswordIsStored(apiKeyConfigured && !hasTypedApiKey())
    }

    private fun updateProjectFieldsState() {
        val enabled = uiEnabled && pEnabled.isSelected && basePath != null
        val hasCustomPrompt = pPromptTemplate.text.isNotBlank()

        pEnabled.isEnabled = uiEnabled && basePath != null
        pProvider.isEnabled = enabled
        pBaseUrl.isEnabled = enabled
        pModel.isEnabled = enabled
        pMessageFormat.isEnabled = enabled && !hasCustomPrompt
        pSmartSkip.isEnabled = enabled && !hasCustomPrompt
        pLanguage.isEnabled = enabled
        pPushPolicy.isEnabled = enabled
        pPromptTemplate.isEnabled = enabled
        pMaxDiffTokens.isEnabled = enabled
        pLogLevel.isEnabled = enabled
        pUiLanguage.isEnabled = enabled
        pExplain.isEnabled = enabled && !hasCustomPrompt

        val tooltip = if (hasCustomPrompt && enabled) GitAiBundle.message("settings.hint.disabledTemplate") else null
        pMessageFormat.toolTipText = tooltip
        pSmartSkip.toolTipText = tooltip
        pExplain.toolTipText = tooltip
    }

    private fun updateOverview() {
        globalProviderMetric.value = providerName(gProvider.selectedItem as? String)
        globalModelMetric.value = displayValue(gModel.text)
        globalFormatMetric.value = displayValue(gMessageFormat.selectedItem as? String)
        globalKeyMetric.value = if (gProvider.selectedItem == "ollama") {
            EM_DASH
        } else if (apiKeyConfigured || hasTypedApiKey()) {
            STORED_SECRET
        } else {
            EM_DASH
        }

        val global = getGlobalConfig()
        projectProviderMetric.value = providerName(resolve(pProvider, global.provider))
        projectModelMetric.value = displayValue(pModel.text.takeIf { it.isNotBlank() } ?: global.model)
        projectFormatMetric.value = displayValue(resolve(pMessageFormat, global.messageFormat))
        projectPushMetric.value = displayValue(resolve(pPushPolicy, global.pushPolicy))

        updateInheritancePlaceholders(global)
    }

    private fun updateInheritancePlaceholders(global: GitAiConfig) {
        pBaseUrl.emptyText.text = inheritedVal(global.baseUrl.orEmpty())
        pModel.emptyText.text = inheritedVal(global.model.orEmpty())
        pPromptTemplate.emptyText.text = inheritedVal(global.promptTemplate.orEmpty())
        pMaxDiffTokens.emptyText.text = inheritedVal((global.maxDiffTokens ?: 8000).toString())
    }

    private fun updateDirtyIndicators() {
        val globalDirty = baselineGlobal?.let { getGlobalConfig() != it } ?: false
        val projectDirty = baselineProject?.let {
            getProjectConfig() != it || pEnabled.isSelected != baselineProjectEnabled
        } ?: false
        globalTab.text = if (globalDirty) "$DIRTY_MARK $globalTabText" else globalTabText
        projectTab.text = if (projectDirty) "$DIRTY_MARK $projectTabText" else projectTabText
    }

    private fun updateTestActions() {
        gTestConfigBtn.isEnabled = uiEnabled && globalTestAllowed
        pTestConfigBtn.isEnabled = uiEnabled && pEnabled.isSelected && projectTestAllowed
    }

    private fun showScope(card: String) {
        cardLayout.show(contentPanel, card)
        if (card == GLOBAL_CARD) globalTab.requestFocusInWindow() else projectTab.requestFocusInWindow()
    }

    private fun configureAccessibility() {
        fun describe(component: JComponent, nameKey: String, hintKey: String? = null) {
            component.accessibleContext.accessibleName = GitAiBundle.message(nameKey)
            hintKey?.let {
                val hint = GitAiBundle.message(it)
                component.accessibleContext.accessibleDescription = hint
                component.toolTipText = hint
            }
        }

        describe(gApiKey, "settings.field.apiKey", "settings.hint.apiKey")
        describe(gPromptTemplate, "settings.field.promptTemplate", "settings.hint.promptTemplate")
        describe(pPromptTemplate, "settings.field.promptTemplate", "settings.hint.promptTemplate")
        describe(gMaxDiffTokens, "settings.field.maxDiffTokens", "settings.hint.maxDiffTokens")
        describe(pMaxDiffTokens, "settings.field.maxDiffTokens", "settings.hint.maxDiffTokens")
        gTestConfigBtn.accessibleContext.accessibleName = GitAiBundle.message("settings.btn.testConfig")
        pTestConfigBtn.accessibleContext.accessibleName = GitAiBundle.message("settings.btn.testConfig")
    }

    fun getGlobalConfig(): GitAiConfig {
        val password = gApiKey.password
        val typedApiKey = String(password).takeIf { it.isNotEmpty() }
        password.fill('\u0000')
        return GitAiConfig(
            apiKey = typedApiKey,
            provider = gProvider.selectedItem as? String,
            baseUrl = gBaseUrl.text.takeIf { it.isNotBlank() },
            model = gModel.text.takeIf { it.isNotBlank() },
            messageFormat = gMessageFormat.selectedItem as? String,
            smartSkip = gSmartSkip.isSelected,
            language = gLanguage.selectedItem as? String,
            uiLanguage = (gUiLanguage.selectedItem as? String)?.takeIf { it.isNotEmpty() },
            pushPolicy = gPushPolicy.selectedItem as? String,
            promptTemplate = gPromptTemplate.text.takeIf { it.isNotBlank() },
            maxDiffTokens = gMaxDiffTokens.text.toIntOrNull(),
            logLevel = gLogLevel.selectedItem as? String,
            explain = gExplain.isSelected,
        )
    }

    fun setGlobalConfig(cfg: GitAiConfig) = withoutEvents {
        apiKeyConfigured = cfg.apiKeyConfigured
        gApiKey.text = cfg.apiKey.orEmpty()
        gApiKey.emptyText.text = if (cfg.apiKeyConfigured) STORED_SECRET else ""
        gProvider.selectedItem = cfg.provider ?: "openai"
        gBaseUrl.text = cfg.baseUrl.orEmpty()
        gModel.text = cfg.model.orEmpty()
        gMessageFormat.selectedItem = cfg.messageFormat ?: "conventional"
        gSmartSkip.isSelected = cfg.smartSkip ?: true
        gLanguage.selectedItem = cfg.language ?: "en"
        gUiLanguage.selectedItem = cfg.uiLanguage ?: ""
        gPushPolicy.selectedItem = cfg.pushPolicy ?: "queue"
        gPromptTemplate.text = cfg.promptTemplate.orEmpty()
        gMaxDiffTokens.text = cfg.maxDiffTokens?.toString().orEmpty()
        gLogLevel.selectedItem = cfg.logLevel ?: "info"
        gExplain.isSelected = cfg.explain ?: false
    }

    fun getProjectConfig(): GitAiConfig = GitAiConfig(
        provider = selectedOverride(pProvider),
        baseUrl = pBaseUrl.text.takeIf { it.isNotBlank() },
        model = pModel.text.takeIf { it.isNotBlank() },
        messageFormat = selectedOverride(pMessageFormat),
        smartSkip = selectedOverride(pSmartSkip)?.toBooleanStrictOrNull(),
        language = selectedOverride(pLanguage),
        uiLanguage = selectedOverride(pUiLanguage),
        pushPolicy = selectedOverride(pPushPolicy),
        promptTemplate = pPromptTemplate.text.takeIf { it.isNotBlank() },
        maxDiffTokens = pMaxDiffTokens.text.toIntOrNull(),
        logLevel = selectedOverride(pLogLevel),
        explain = selectedOverride(pExplain)?.toBooleanStrictOrNull(),
    )

    fun setProjectConfig(cfg: GitAiConfig, inherited: GitAiConfig) = withoutEvents {
        pProvider.selectedItem = cfg.provider ?: ""
        pBaseUrl.text = cfg.baseUrl.orEmpty()
        pModel.text = cfg.model.orEmpty()
        pMessageFormat.selectedItem = cfg.messageFormat ?: ""
        pSmartSkip.selectedItem = cfg.smartSkip?.toString() ?: ""
        pLanguage.selectedItem = cfg.language ?: ""
        pPushPolicy.selectedItem = cfg.pushPolicy ?: ""
        pPromptTemplate.text = cfg.promptTemplate.orEmpty()
        pMaxDiffTokens.text = cfg.maxDiffTokens?.toString().orEmpty()
        pLogLevel.selectedItem = cfg.logLevel ?: ""
        pUiLanguage.selectedItem = cfg.uiLanguage ?: ""
        pExplain.selectedItem = cfg.explain?.toString() ?: ""
        updateInheritancePlaceholders(inherited)
    }

    private fun withoutEvents(block: () -> Unit) {
        val previous = suppressEvents
        suppressEvents = true
        try {
            block()
        } finally {
            suppressEvents = previous
            updateAllStates()
        }
    }

    private fun selectedOverride(comboBox: ComboBox<String>): String? =
        (comboBox.selectedItem as? String)?.takeIf { it.isNotEmpty() }

    private fun hasTypedApiKey(): Boolean {
        val password = gApiKey.password
        val hasValue = password.isNotEmpty()
        password.fill('\u0000')
        return hasValue
    }

    private fun resolve(comboBox: ComboBox<String>, inherited: String?): String? =
        selectedOverride(comboBox) ?: inherited

    private fun inheritedVal(value: String): String = if (value.isEmpty()) {
        GitAiBundle.message("settings.inherit.label")
    } else {
        GitAiBundle.message("settings.inherit.value", value)
    }

    private fun providerName(provider: String?): String = when (provider) {
        "openai" -> "OpenAI"
        "ollama" -> "Ollama"
        "anthropic" -> "Anthropic"
        "gemini" -> "Gemini"
        else -> displayValue(provider)
    }

    private fun displayValue(value: String?): String = value?.takeIf { it.isNotBlank() } ?: EM_DASH

    private fun scopeButton(text: String, position: String): JToggleButton = JToggleButton(text).apply {
        putClientProperty("JButton.buttonType", "segmented")
        putClientProperty("JButton.segmentPosition", position)
        isFocusable = true
    }

    private fun promptArea(): JBTextArea = JBTextArea(4, 36).apply {
        lineWrap = true
        wrapStyleWord = true
    }

    private fun inheritedCombo(vararg values: String): ComboBox<String> =
        ComboBox(arrayOf("", *values)).apply {
            renderer = InheritedValueRenderer()
        }

    private class InheritedValueRenderer : DefaultListCellRenderer() {
        override fun getListCellRendererComponent(
            list: JList<*>?,
            value: Any?,
            index: Int,
            isSelected: Boolean,
            cellHasFocus: Boolean,
        ): Component {
            val visibleValue = if (value == null || value.toString().isEmpty()) {
                GitAiBundle.message("settings.inherit.label")
            } else {
                value
            }
            return super.getListCellRendererComponent(list, visibleValue, index, isSelected, cellHasFocus)
        }
    }

    private class MetricCard(labelText: String) : JPanel(BorderLayout()) {
        private val valueLabel = JBLabel(EM_DASH).apply {
            font = UIUtil.getLabelFont().deriveFont(Font.BOLD)
        }

        var value: String
            get() = valueLabel.text
            set(newValue) {
                valueLabel.text = newValue
                valueLabel.toolTipText = newValue.takeIf { it != EM_DASH }
            }

        init {
            isOpaque = false
            border = JBUI.Borders.empty(10, 12, 10, 12)
            minimumSize = Dimension(JBUI.scale(120), JBUI.scale(58))
            val label = JBLabel(labelText).apply {
                foreground = UIUtil.getContextHelpForeground()
                font = UIUtil.getLabelFont().deriveFont(UIUtil.getLabelFont().size2D - 1f)
            }
            add(label, BorderLayout.NORTH)
            add(valueLabel, BorderLayout.CENTER)
            accessibleContext.accessibleName = labelText
        }

        override fun paintComponent(graphics: Graphics) {
            val g2 = graphics.create() as Graphics2D
            try {
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
                g2.color = cardBackground()
                g2.fillRoundRect(0, 0, width - 1, height - 1, JBUI.scale(10), JBUI.scale(10))
                g2.color = borderColor()
                g2.drawRoundRect(0, 0, width - 1, height - 1, JBUI.scale(10), JBUI.scale(10))
            } finally {
                g2.dispose()
            }
            super.paintComponent(graphics)
        }
    }

    companion object {
        private const val GLOBAL_CARD = "global"
        private const val PROJECT_CARD = "project"
        private const val DIRTY_MARK = "•"
        private const val EM_DASH = "—"
        private const val STORED_SECRET = "••••••••"

        private fun borderColor() = JBColor.namedColor(
            "Borders.color",
            JBColor(0xD8DADF, 0x484A4F),
        )

        private fun cardBackground() = JBColor.namedColor(
            "GitAi.Settings.cardBackground",
            JBColor(0xF7F8FA, 0x2B2D30),
        )
    }
}
