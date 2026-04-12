package com.daidi.gitai.actions

import com.daidi.gitai.state.GitAiStateService
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.ToggleAction
import com.intellij.openapi.components.service

class SkipNextCommitAction : ToggleAction() {
    override fun isSelected(e: AnActionEvent): Boolean {
        val project = e.project ?: return false
        val stateService = project.service<GitAiStateService>()
        return stateService.state.skipNext == true
    }

    override fun setSelected(e: AnActionEvent, state: Boolean) {
        val project = e.project ?: return
        val stateService = project.service<GitAiStateService>()
        
        val currentState = stateService.state
        val updatedState = currentState.copy(skipNext = state)
        
        Thread {
            stateService.saveState(updatedState)
        }.start()
    }
}
