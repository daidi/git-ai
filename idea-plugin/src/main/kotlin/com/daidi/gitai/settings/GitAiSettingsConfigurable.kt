package com.daidi.gitai.settings

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiStateService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.options.ConfigurationException
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import java.util.concurrent.atomic.AtomicInteger
import javax.swing.JComponent

/** Settings UI backed exclusively by CLI commands. */
class GitAiSettingsConfigurable(private val project: Project) : Configurable {
    private var component: GitAiSettingsComponent? = null
    private var savedGlobal = GitAiConfigManager.DEFAULTS.copy()
    private var savedProject = GitAiConfig()
    private var savedInitialized = false
    private var loading = false
    private val loadGeneration = AtomicInteger()

    override fun getDisplayName(): String = GitAiBundle.message("settings.title")

    override fun createComponent(): JComponent {
        val settings = GitAiSettingsComponent(project.basePath)
        component = settings
        settings.gTestConfigBtn.addActionListener { testConfiguration() }
        settings.pTestConfigBtn.addActionListener { testConfiguration() }
        reloadFromCli()
        return settings.mainPanel
    }

    override fun isModified(): Boolean {
        val settings = component ?: return false
        if (loading) return false

        val currentGlobal = settings.getGlobalConfig().copy(checkUpdate = null)
        val comparableGlobal = savedGlobal.copy(apiKey = null, checkUpdate = null, apiKeyConfigured = false)
        if (currentGlobal != comparableGlobal) return true

        val currentProject = settings.getProjectConfig().copy(checkUpdate = null)
        val comparableProject = savedProject.copy(apiKey = null, checkUpdate = null, apiKeyConfigured = false)
        return currentProject != comparableProject || settings.pEnabled.isSelected != savedInitialized
    }

    @Throws(ConfigurationException::class)
    override fun apply() {
        val settings = component ?: return
        if (loading) throw ConfigurationException(GitAiBundle.message("settings.loading"))

        val global = settings.getGlobalConfig().copy(checkUpdate = savedGlobal.checkUpdate)
        val local = settings.getProjectConfig().copy(apiKey = null, checkUpdate = savedProject.checkUpdate)
        val shouldInitialize = settings.pEnabled.isSelected
        var failure: String? = null

        ProgressManager.getInstance().run(object : Task.Modal(project, GitAiBundle.message("settings.saving"), true) {
            override fun run(indicator: ProgressIndicator) {
                val globalResult = GitAiConfigManager.replace(project, "global", global)
                if (!globalResult.success) {
                    failure = globalResult.errorText
                    return
                }
                val localResult = GitAiConfigManager.replace(project, "local", local)
                if (!localResult.success) {
                    failure = localResult.errorText
                    return
                }
                val hookResult = when {
                    shouldInitialize && !savedInitialized -> GitAiCli.run(project, "init")
                    !shouldInitialize && savedInitialized -> GitAiCli.run(project, "uninstall")
                    else -> null
                }
                if (hookResult != null && !hookResult.success) failure = hookResult.errorText
            }
        })

        failure?.let { throw ConfigurationException(it) }
        global.apiKey = null // Do not retain a plaintext credential in the Swing model.
        savedGlobal = global.copy()
        savedProject = local.copy()
        savedInitialized = shouldInitialize
        settings.setGlobalConfig(savedGlobal)
        project.service<GitAiStateService>().refreshNow()
    }

    override fun reset() {
        reloadFromCli()
    }

    override fun disposeUIResources() {
        loadGeneration.incrementAndGet()
        component = null
    }

    private fun reloadFromCli() {
        val settings = component ?: return
        val generation = loadGeneration.incrementAndGet()
        loading = true
        settings.mainPanel.isEnabled = false

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("settings.loading"), false) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    val rawGlobal = GitAiConfigManager.load(project, "global")
                    val rawProject = GitAiConfigManager.load(project, "local")
                    val effectiveGlobal = withDefaults(rawGlobal)
                    val initialized = queryInitialized()
                    ApplicationManager.getApplication().invokeLater({
                        if (project.isDisposed || generation != loadGeneration.get()) return@invokeLater
                        savedGlobal = effectiveGlobal
                        savedProject = rawProject
                        savedInitialized = initialized
                        settings.setGlobalConfig(effectiveGlobal)
                        settings.setProjectConfig(rawProject, effectiveGlobal)
                        settings.pEnabled.isSelected = initialized
                        settings.pEnabled.actionListeners.forEach {
                            it.actionPerformed(java.awt.event.ActionEvent(settings.pEnabled, 0, "reload"))
                        }
                        loading = false
                        settings.mainPanel.isEnabled = true
                    }, project.disposed)
                } catch (e: Exception) {
                    ApplicationManager.getApplication().invokeLater({
                        if (project.isDisposed || generation != loadGeneration.get()) return@invokeLater
                        loading = false
                        settings.mainPanel.isEnabled = true
                        Messages.showErrorDialog(project, e.message ?: "Unable to load Git AI settings", GitAiBundle.message("notification.title"))
                    }, project.disposed)
                }
            }
        })
    }

    private fun queryInitialized(): Boolean {
        val result = GitAiCli.runSilently(project, "status", "--json")
        if (!result.success) return project.service<GitAiStateService>().state.initialized
        return Regex("\"initialized\"\\s*:\\s*true").containsMatchIn(result.stdout)
    }

    private fun testConfiguration() {
        if (isModified()) {
            Messages.showWarningDialog(
                project,
                GitAiBundle.message("settings.test.unsaved"),
                GitAiBundle.message("settings.test.unsaved.title"),
            )
            return
        }
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("settings.btn.testConfig"), true) {
            override fun run(indicator: ProgressIndicator) {
                val result = GitAiCli.run(project, "config", "test")
                ApplicationManager.getApplication().invokeLater({
                    if (project.isDisposed) return@invokeLater
                    if (result.success) {
                        Messages.showInfoMessage(
                            project,
                            GitAiBundle.message("settings.test.success", result.stdout),
                            GitAiBundle.message("settings.test.success.title"),
                        )
                    } else {
                        Messages.showErrorDialog(
                            project,
                            GitAiBundle.message("settings.test.failed", result.errorText, result.stdout),
                            GitAiBundle.message("settings.test.failed.title"),
                        )
                    }
                }, project.disposed)
            }
        })
    }

    private fun withDefaults(raw: GitAiConfig): GitAiConfig {
        val defaults = GitAiConfigManager.DEFAULTS
        return GitAiConfig(
            model = raw.model ?: defaults.model,
            baseUrl = raw.baseUrl ?: defaults.baseUrl,
            provider = raw.provider ?: defaults.provider,
            language = raw.language ?: defaults.language,
            uiLanguage = raw.uiLanguage ?: defaults.uiLanguage,
            pushPolicy = raw.pushPolicy ?: defaults.pushPolicy,
            messageFormat = raw.messageFormat ?: defaults.messageFormat,
            promptTemplate = raw.promptTemplate ?: defaults.promptTemplate,
            maxDiffTokens = raw.maxDiffTokens ?: defaults.maxDiffTokens,
            logLevel = raw.logLevel ?: defaults.logLevel,
            checkUpdate = raw.checkUpdate ?: defaults.checkUpdate,
            explain = raw.explain ?: defaults.explain,
            apiKeyConfigured = raw.apiKeyConfigured,
        )
    }
}
