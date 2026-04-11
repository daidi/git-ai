package com.daidi.gitai.settings

import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.Project
import com.daidi.gitai.GitAiBundle
import javax.swing.JComponent

import java.io.File

/**
 * IntelliJ Configurable for the git-ai settings page.
 * Appears under Settings → Tools → git-ai.
 * Supports both Global and Project scope editing.
 */
class GitAiSettingsConfigurable(private val project: Project) : Configurable {

    private var component: GitAiSettingsComponent? = null

    override fun getDisplayName(): String = GitAiBundle.message("settings.title")

    override fun createComponent(): JComponent {
        component = GitAiSettingsComponent(project.basePath)
        return component!!.mainPanel
    }

    override fun isModified(): Boolean {
        val comp = component ?: return false

        // Global
        val savedGlobal = GitAiConfigManager.load(GitAiConfigManager.globalPath())
        val currentGlobal = comp.getGlobalConfig()
        if (savedGlobal != currentGlobal) return true

        // Project
        val basePath = project.basePath
        if (basePath != null) {
            val savedProject = GitAiConfigManager.load(GitAiConfigManager.projectPath(basePath))
            val currentProject = comp.getProjectConfig()
            if (savedProject != currentProject) return true
            
            // Check hook state
            if (isHookInstalled(basePath) != comp.pEnabled.isSelected) return true
        }

        return false
    }

    override fun apply() {
        val comp = component ?: return

        // Save Global
        GitAiConfigManager.save(GitAiConfigManager.globalPath(), comp.getGlobalConfig())

        // Save Project
        val basePath = project.basePath
        if (basePath != null) {
            val projConfig = comp.getProjectConfig()
            // Only write the project file if there's at least one non-empty field.
            val hasAny = listOfNotNull(
                projConfig.apiKey, projConfig.model, projConfig.baseUrl,
                projConfig.provider, projConfig.language, projConfig.pushPolicy,
                projConfig.messageFormat, projConfig.promptTemplate,
            ).any { it.isNotEmpty() } || (projConfig.maxDiffTokens != null && projConfig.maxDiffTokens!! > 0)

            if (hasAny) {
                GitAiConfigManager.save(GitAiConfigManager.projectPath(basePath), projConfig)
            } else {
                // If all project fields are empty, delete the project config file.
                GitAiConfigManager.delete(GitAiConfigManager.projectPath(basePath))
            }
            
            // Install / Uninstall hook logic
            val installed = isHookInstalled(basePath)
            if (comp.pEnabled.isSelected && !installed) {
                com.daidi.gitai.state.GitAiCli.execute(project, "init")
            } else if (!comp.pEnabled.isSelected && installed) {
                com.daidi.gitai.state.GitAiCli.execute(project, "uninstall")
            }
        }
    }

    override fun reset() {
        val comp = component ?: return

        // Load Global
        val globalCfg = GitAiConfigManager.load(GitAiConfigManager.globalPath())
        comp.setGlobalConfig(globalCfg)

        // Load Project
        val basePath = project.basePath
        if (basePath != null) {
            val projectCfg = GitAiConfigManager.load(GitAiConfigManager.projectPath(basePath))
            val merged = GitAiConfigManager.merged(basePath)
            comp.setProjectConfig(projectCfg, merged)
            
            // Read actual file system state
            val hookState = isHookInstalled(basePath)
            comp.pEnabled.isSelected = hookState
            // Trigger update event to disable/enable project fields properly based on checkbox logic
            comp.pEnabled.actionListeners.forEach { it.actionPerformed(java.awt.event.ActionEvent(comp.pEnabled, 0, "")) }
        }
    }

    override fun disposeUIResources() {
        component = null
    }
    
    private fun isHookInstalled(basePath: String): Boolean {
        val hookFile = File(basePath, ".git/hooks/post-commit")
        return hookFile.exists() && hookFile.readText().contains("git-ai hook post-commit")
    }
}
