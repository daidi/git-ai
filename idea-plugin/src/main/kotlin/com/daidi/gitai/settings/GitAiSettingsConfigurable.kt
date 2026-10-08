package com.daidi.gitai.settings

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiInstaller
import com.daidi.gitai.state.GitAiStateService
import com.daidi.gitai.state.GitAiUpdateService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.options.ConfigurationException
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.ProcessCanceledException
import com.intellij.openapi.progress.Task
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import java.util.concurrent.atomic.AtomicInteger
import javax.swing.JComponent

/** Settings UI backed exclusively by CLI commands. */
class GitAiSettingsConfigurable(private val project: Project) : Configurable, Configurable.NoScroll {
    private var component: GitAiSettingsComponent? = null
    private var savedGlobal = GitAiConfigManager.DEFAULTS.copy()
    private var savedProject = GitAiConfig()
    private var savedInitialized = false
    private var schemaDefaults = GitAiConfigManager.DEFAULTS.copy()
    private var loading = false
    private var configLoaded = false
    private val loadGeneration = AtomicInteger()

    override fun getDisplayName(): String = GitAiBundle.message("settings.title")

    override fun createComponent(): JComponent {
        val settings = GitAiSettingsComponent(project.basePath)
        component = settings
        settings.setChangeListener { updateTestActions() }
        settings.gTestConfigBtn.addActionListener { testConfiguration() }
        settings.pTestConfigBtn.addActionListener { testConfiguration() }
        settings.cliRetryBtn.addActionListener { if (canReload()) reloadFromCli() }
        settings.cliCheckBtn.addActionListener { checkForUpdates() }
        settings.cliUpdateBtn.addActionListener { installCli() }
        reloadFromCli()
        return settings.mainPanel
    }

    override fun getPreferredFocusedComponent(): JComponent? =
        component?.getPreferredFocusedComponent()

    override fun isModified(): Boolean {
        val settings = component ?: return false
        if (loading || !configLoaded) return false

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
        if (!configLoaded) throw ConfigurationException(GitAiBundle.message("settings.cli.incompatible"))

        val global = settings.getGlobalConfig().copy(checkUpdate = savedGlobal.checkUpdate)
        val local = settings.getProjectConfig().copy(apiKey = null, checkUpdate = savedProject.checkUpdate)
        val shouldInitialize = settings.pEnabled.isSelected
        var failure: String? = null

        ProgressManager.getInstance().run(object : Task.Modal(project, GitAiBundle.message("settings.saving"), true) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    GitAiConfigManager.loadSchema(project, indicator)
                } catch (e: ProcessCanceledException) {
                    throw e
                } catch (_: Exception) {
                    failure = GitAiBundle.message("settings.cli.incompatible")
                    return
                }
                val globalResult = GitAiConfigManager.replace(project, "global", global, indicator)
                if (!globalResult.success) {
                    failure = globalResult.errorText
                    return
                }
                val localResult = GitAiConfigManager.replace(project, "local", local, indicator)
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
        val apiKeyConfigured = global.apiKey != null || savedGlobal.apiKeyConfigured
        global.apiKey = null // Do not retain a plaintext credential in the Swing model.
        global.apiKeyConfigured = apiKeyConfigured
        savedGlobal = global.copy()
        savedProject = local.copy()
        savedInitialized = shouldInitialize
        settings.setGlobalConfig(savedGlobal)
        settings.setProjectConfig(savedProject, savedGlobal)
        settings.pEnabled.isSelected = savedInitialized
        settings.markBaseline()
        updateTestActions()
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
        configLoaded = false
        settings.setLoading(true)
        settings.setCliHealth(GitAiBundle.message("settings.loading"), true)
        settings.setCliUpdateStatus(" ")
        updateTestActions()

        ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("settings.loading"), true) {
            override fun run(indicator: ProgressIndicator) {
                try {
                    GitAiCli.invalidateExecutableCache()
                    val info = GitAiCli.runtimeInfo()
                    indicator.checkCanceled()
                    ApplicationManager.getApplication().invokeLater({
                        if (project.isDisposed || generation != loadGeneration.get()) return@invokeLater
                        settings.setCliDetails(info.version, info.path)
                    }, project.disposed)
                    val schema = GitAiConfigManager.loadSchema(project, indicator)
                    val defaults = GitAiConfigManager.defaultsFrom(schema)
                    val rawGlobal = GitAiConfigManager.load(project, "global", indicator)
                    val rawProject = GitAiConfigManager.load(project, "local", indicator)
                    val effectiveGlobal = withDefaults(rawGlobal, defaults)
                    val initialized = queryInitialized()
                    ApplicationManager.getApplication().invokeLater({
                        if (project.isDisposed || indicator.isCanceled || generation != loadGeneration.get()) return@invokeLater
                        schemaDefaults = defaults
                        savedGlobal = effectiveGlobal
                        savedProject = rawProject
                        savedInitialized = initialized
                        settings.applySchema(schema)
                        settings.setGlobalConfig(effectiveGlobal)
                        settings.setProjectConfig(rawProject, effectiveGlobal)
                        settings.pEnabled.isSelected = initialized
                        loading = false
                        configLoaded = true
                        settings.setLoading(false)
                        settings.setCliHealth(GitAiBundle.message("settings.cli.compatible", schema.version), false)
                        GitAiUpdateService.getInstance().clearCompatibilityNotifications()
                        settings.markBaseline()
                        updateTestActions()
                    }, project.disposed)

                    // Model discovery may require a network request. Let the
                    // editable settings form become usable before it finishes.
                    val models = try {
                        GitAiConfigManager.loadModels(project, indicator)?.models.orEmpty()
                    } catch (e: ProcessCanceledException) {
                        throw e
                    } catch (_: Exception) {
                        emptyList()
                    }
                    ApplicationManager.getApplication().invokeLater({
                        if (project.isDisposed || indicator.isCanceled || generation != loadGeneration.get()) return@invokeLater
                        settings.setModelSuggestions(models)
                    }, project.disposed)
                } catch (e: ProcessCanceledException) {
                    throw e
                } catch (e: Exception) {
                    ApplicationManager.getApplication().invokeLater({
                        if (project.isDisposed || generation != loadGeneration.get()) return@invokeLater
                        loading = false
                        // A failed read must never enable saving defaults over real settings.
                        settings.setLoading(true)
                        settings.setCliHealth(GitAiBundle.message(
                            if (e is GitAiSettingsProtocolException) "settings.cli.incompatible" else "settings.cli.unavailable"
                        ), false)
                        updateTestActions()
                    }, project.disposed)
                }
            }

            override fun onCancel() {
                if (project.isDisposed || generation != loadGeneration.get()) return
                loading = false
                settings.setLoading(!configLoaded)
                settings.setCliHealth(GitAiBundle.message(if (configLoaded) "settings.cli.compatible" else "settings.cli.unavailable",
                    GitAiSettingsProtocol.VERSION), false)
                updateTestActions()
            }
        })
    }

    private fun canReload(): Boolean {
        if (!isModified()) return true
        Messages.showWarningDialog(project, GitAiBundle.message("settings.test.unsaved"), GitAiBundle.message("settings.test.unsaved.title"))
        return false
    }

    private fun checkForUpdates() {
        val settings = component ?: return
        val generation = loadGeneration.get()
        settings.cliCheckBtn.isEnabled = false
        settings.setCliUpdateStatus(GitAiBundle.message("settings.loading"))
        ProgressManager.getInstance().run(object : Task.Backgroundable(project, GitAiBundle.message("settings.cli.check"), true) {
            private var info = GitAiCli.RuntimeInfo(null, null)
            private var result = GitAiUpdateService.Result("settings.cli.checkFailed")

            override fun run(indicator: ProgressIndicator) {
                info = GitAiCli.runtimeInfo()
                result = GitAiUpdateService.getInstance().checkNow(info, indicator, true)
            }

            override fun onSuccess() {
                if (project.isDisposed || generation != loadGeneration.get()) return
                settings.setCliDetails(info.version, info.path)
                val latest = result.latest
                settings.setCliUpdateStatus(if (latest != null)
                    GitAiBundle.message(result.key, info.version ?: "—", latest) else GitAiBundle.message(result.key))
                settings.cliCheckBtn.isEnabled = !loading
            }

            override fun onCancel() {
                if (project.isDisposed || generation != loadGeneration.get()) return
                settings.cliCheckBtn.isEnabled = !loading
                settings.setCliUpdateStatus(" ")
            }

            override fun onThrowable(error: Throwable) {
                if (project.isDisposed || generation != loadGeneration.get()) return
                settings.cliCheckBtn.isEnabled = !loading
                settings.setCliUpdateStatus(GitAiBundle.message("settings.cli.checkFailed"))
            }
        })
    }

    private fun installCli() {
        val settings = component ?: return
        if (!canReload()) return
        val generation = loadGeneration.incrementAndGet()
        loading = true
        settings.setLoading(true)
        settings.setCliHealth(GitAiBundle.message("installer.downloading"), true)
        GitAiInstaller.installCli(project) finished@{ success ->
            if (project.isDisposed || generation != loadGeneration.get()) return@finished
            loading = false
            if (success) reloadFromCli() else {
                settings.setLoading(!configLoaded)
                settings.setCliHealth(GitAiBundle.message("settings.cli.unavailable"), false)
                updateTestActions()
            }
        }
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

    private fun updateTestActions() {
        val settings = component ?: return
        val hasUnsavedChanges = !loading && isModified()
        val canTest = configLoaded && !loading && !hasUnsavedChanges
        settings.setTestActionsEnabled(canTest, canTest)
        val tooltip = if (hasUnsavedChanges) GitAiBundle.message("settings.test.unsaved") else null
        settings.gTestConfigBtn.toolTipText = tooltip
        settings.pTestConfigBtn.toolTipText = tooltip
    }

    private fun withDefaults(raw: GitAiConfig, defaults: GitAiConfig = schemaDefaults): GitAiConfig {
        return GitAiConfig(
            model = raw.model ?: defaults.model,
            baseUrl = raw.baseUrl ?: defaults.baseUrl,
            provider = raw.provider ?: defaults.provider,
            language = raw.language ?: defaults.language,
            uiLanguage = raw.uiLanguage ?: defaults.uiLanguage,
            pushPolicy = raw.pushPolicy ?: defaults.pushPolicy,
            messageFormat = raw.messageFormat ?: defaults.messageFormat,
            commitAttribution = raw.commitAttribution ?: defaults.commitAttribution,
            promptTemplate = raw.promptTemplate ?: defaults.promptTemplate,
            smartSkip = raw.smartSkip ?: defaults.smartSkip,
            maxDiffTokens = raw.maxDiffTokens ?: defaults.maxDiffTokens,
            logLevel = raw.logLevel ?: defaults.logLevel,
            checkUpdate = raw.checkUpdate ?: defaults.checkUpdate,
            explain = raw.explain ?: defaults.explain,
            apiKeyConfigured = raw.apiKeyConfigured,
        )
    }
}
