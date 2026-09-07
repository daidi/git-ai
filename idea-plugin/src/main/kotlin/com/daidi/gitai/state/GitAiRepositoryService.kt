package com.daidi.gitai.state

import com.intellij.ide.util.PropertiesComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import git4idea.repo.GitRepositoryManager

private const val SELECTED_REPOSITORY_KEY = "git-ai.selectedRepository"

internal fun preferredRepositoryRoot(
    roots: List<String>,
    persisted: String?,
    projectBasePath: String?,
): String? {
    if (persisted != null && persisted in roots) return persisted
    if (projectBasePath != null) {
        roots.firstOrNull { it == projectBasePath }?.let { return it }
        roots.filter { projectBasePath.startsWith("$it/") || projectBasePath.startsWith("$it\\") }
            .maxByOrNull(String::length)
            ?.let { return it }
    }
    return roots.firstOrNull() ?: projectBasePath
}

/** Owns the active repository selection for projects containing multiple Git roots. */
@Service(Service.Level.PROJECT)
class GitAiRepositoryService(private val project: Project) {
    fun repositories(): List<String> = GitRepositoryManager.getInstance(project).repositories
        .map { it.root.path }
        .distinct()
        .sorted()

    fun workingDirectory(): String? = preferredRepositoryRoot(
        repositories(),
        PropertiesComponent.getInstance(project).getValue(SELECTED_REPOSITORY_KEY),
        project.basePath,
    )

    fun select(root: String) {
        require(root in repositories()) { "Repository is not part of this project" }
        PropertiesComponent.getInstance(project).setValue(SELECTED_REPOSITORY_KEY, root)
    }

    companion object {
        fun getInstance(project: Project): GitAiRepositoryService = project.service()
    }
}
