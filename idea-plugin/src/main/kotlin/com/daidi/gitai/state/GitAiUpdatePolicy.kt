package com.daidi.gitai.state

/** Optional release discovery is independent of the mandatory local protocol check. */
internal object GitAiUpdatePolicy {
    const val SUCCESS_TTL_MS = 24 * 60 * 60 * 1000L
    const val FAILURE_BACKOFF_MS = 15 * 60 * 1000L

    data class Cache(
        val identity: String = "",
        val lastSuccess: Long = 0,
        val lastFailure: Long = 0,
        val latest: String = "",
    )

    fun shouldFetch(cache: Cache, identity: String, now: Long, manual: Boolean): Boolean {
        if (manual || identity != cache.identity) return true
        if (cache.lastFailure > 0 && cache.lastFailure >= cache.lastSuccess) {
            return !recent(cache.lastFailure, now, FAILURE_BACKOFF_MS)
        }
        return stableVersion(cache.latest) == null || !recent(cache.lastSuccess, now, SUCCESS_TTL_MS)
    }

    private fun recent(timestamp: Long, now: Long, ttl: Long): Boolean =
        timestamp > 0 && now >= timestamp && now - timestamp < ttl

    fun installedVersion(output: String): String? {
        val plain = output.replace(Regex("\u001B\\[[0-9;]*[A-Za-z]"), "")
        return Regex("""(?im)^.*?Git[- ]AI(?: CLI)?(?: version)?\s+v?(dev|\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)\s*$""")
            .find(plain)?.groupValues?.get(1)
    }

    fun isNewer(current: String, latest: String): Boolean {
        val c = stableVersion(current) ?: return false
        val l = stableVersion(latest) ?: return false
        for (i in 0..2) {
            if (l[i] != c[i]) return l[i] > c[i]
        }
        return false
    }

    fun stableVersion(value: String): List<Int>? {
        val plain = value.removePrefix("v")
        if (!Regex("""\d+\.\d+\.\d+""").matches(plain)) return null
        return plain.split('.').map { it.toIntOrNull() ?: return null }
    }
}
