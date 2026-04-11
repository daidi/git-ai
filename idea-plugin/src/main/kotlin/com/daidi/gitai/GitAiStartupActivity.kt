package com.daidi.gitai

import com.daidi.gitai.state.GitAiStateService
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

/**
 * Starts the state watcher when the project opens.
 */
class GitAiStartupActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        val stateService = project.service<GitAiStateService>()
        stateService.startWatching()
    }
}
