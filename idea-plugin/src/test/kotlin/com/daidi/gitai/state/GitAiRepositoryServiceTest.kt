package com.daidi.gitai.state

import kotlin.test.Test
import kotlin.test.assertEquals

class GitAiRepositoryServiceTest {
    @Test
    fun `keeps a valid persisted repository`() {
        assertEquals("/repo/b", preferredRepositoryRoot(listOf("/repo/a", "/repo/b"), "/repo/b", "/repo/a"))
    }

    @Test
    fun `prefers the repository matching the project base path`() {
        assertEquals("/repo/nested", preferredRepositoryRoot(listOf("/repo", "/repo/nested"), null, "/repo/nested"))
    }

    @Test
    fun `falls back to project path before repositories are discovered`() {
        assertEquals("/repo", preferredRepositoryRoot(emptyList(), null, "/repo"))
    }
}
