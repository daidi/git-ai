package com.daidi.gitai.settings

import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.Project
import javax.swing.JComponent

/**
 * IntelliJ Configurable for the git-ai settings page.
 * Appears under Settings → Tools → git-ai.
 * Supports both Global and Project scope editing.
 */
class GitAiSettingsConfigurable(private val project: Project) : Configurable {

    private var component: GitAiSettingsComponent? = null

    override fun getDisplayName(): String = "git-ai"

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
        }
    }

    override fun disposeUIResources() {
        component = null
    }
}
