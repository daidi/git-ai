package com.daidi.gitai.state

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class GitAiUpdatePolicyTest {
    private val now = 1_800_000_000_000L
    private val identity = "/managed/git-ai|1.4.1|100"

    @Test
    fun `successful checks cache for 24 hours but manual checks bypass it`() {
        val cache = GitAiUpdatePolicy.Cache(identity, lastSuccess = now, latest = "1.4.2")
        assertFalse(GitAiUpdatePolicy.shouldFetch(cache, identity, now + 1, false))
        assertTrue(GitAiUpdatePolicy.shouldFetch(cache, identity, now + GitAiUpdatePolicy.SUCCESS_TTL_MS, false))
        assertTrue(GitAiUpdatePolicy.shouldFetch(cache, identity, now + 1, true))
        // A cache hit must still be able to redisplay the known update.
        assertTrue(GitAiUpdatePolicy.isNewer("1.4.1", cache.latest))
    }

    @Test
    fun `failed checks retry after 15 minutes regardless of old successful cache`() {
        for (success in listOf(0L, now - 100)) {
            val cache = GitAiUpdatePolicy.Cache(identity, lastSuccess = success, lastFailure = now, latest = "1.4.2")
            assertFalse(GitAiUpdatePolicy.shouldFetch(cache, identity, now + 1, false))
            assertTrue(GitAiUpdatePolicy.shouldFetch(cache, identity, now + GitAiUpdatePolicy.FAILURE_BACKOFF_MS, false))
            assertTrue(GitAiUpdatePolicy.shouldFetch(cache, identity, now + 1, true))
        }
    }

    @Test
    fun `new executable old legacy cache and clock rollback never suppress checks`() {
        val cache = GitAiUpdatePolicy.Cache(identity, lastSuccess = now, latest = "1.4.2")
        assertTrue(GitAiUpdatePolicy.shouldFetch(cache, "/other/git-ai|1.3.1|200", now + 1, false))
        assertTrue(GitAiUpdatePolicy.shouldFetch(GitAiUpdatePolicy.Cache(), identity, now, false))
        assertTrue(GitAiUpdatePolicy.shouldFetch(cache, identity, now - 1, false))
        assertTrue(GitAiUpdatePolicy.shouldFetch(cache.copy(latest = "garbage"), identity, now + 1, false))
        assertTrue(GitAiUpdatePolicy.shouldFetch(cache.copy(lastFailure = now + 100), identity, now, false))
    }

    @Test
    fun `parse the installed version not a version from an appended update notice`() {
        assertEquals("1.3.1", GitAiUpdatePolicy.installedVersion("\u001B[1;36m✨ Git-AI CLI v1.3.1\u001B[0m\nUpdate available: v9.0.0"))
        assertEquals("dev", GitAiUpdatePolicy.installedVersion("✨ Git-AI CLI vdev\nUpdate available: v9.0.0"))
        assertEquals("1.5.0-beta.1", GitAiUpdatePolicy.installedVersion("Git-AI CLI v1.5.0-beta.1"))
        assertNull(GitAiUpdatePolicy.installedVersion("Some other tool v1.4.1"))
    }

    @Test
    fun `only compare stable releases numerically`() {
        assertTrue(GitAiUpdatePolicy.isNewer("1.9.9", "v1.10.0"))
        assertFalse(GitAiUpdatePolicy.isNewer("1.4.1", "1.4.1"))
        assertFalse(GitAiUpdatePolicy.isNewer("2.0.0", "1.99.99"))
        assertFalse(GitAiUpdatePolicy.isNewer("dev", "1.4.1"))
        assertFalse(GitAiUpdatePolicy.isNewer("1.5.0-beta", "1.4.1"))
        assertFalse(GitAiUpdatePolicy.isNewer("1.4.1", "1.5.0-beta"))
        assertNull(GitAiUpdatePolicy.stableVersion("99999999999999.0.0"))
    }
}
