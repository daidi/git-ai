package com.daidi.gitai.state

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GitAiCliCompatibilityTest {
    @Test
    fun `detects settings flags missing from an old CLI`() {
        assertTrue(mismatch(stderr = "error: unknown flag: --scope"))
        assertTrue(mismatch(stderr = "Error: unknown flag: --json"))
    }

    @Test
    fun `detects settings commands and smart skip missing from an old CLI`() {
        assertTrue(mismatch(stderr = "Error: unknown command \"replace\" for \"git-ai config\""))
        assertTrue(mismatch(stderr = "unknown command 'reset' for 'git-ai config'"))
        assertTrue(mismatch(stderr = "unknown command 'schema' for 'git-ai config'"))
        assertTrue(mismatch(stderr = "unknown command 'models' for 'git-ai config'"))
        assertTrue(mismatch(stderr = "unknown config key: smart_skip"))
    }

    @Test
    fun `does not classify unrelated failures or successful output as protocol mismatches`() {
        assertFalse(mismatch(stderr = "network request timed out"))
        assertFalse(mismatch(stderr = "unknown config key: model"))
        assertFalse(mismatch(success = true, stdout = "unknown flag: --scope"))
    }

    private fun mismatch(
        success: Boolean = false,
        stdout: String = "",
        stderr: String = "",
    ): Boolean = GitAiCliCompatibility.isSettingsProtocolMismatch(
        GitAiCli.Result(success = success, stdout = stdout, stderr = stderr),
    )
}
