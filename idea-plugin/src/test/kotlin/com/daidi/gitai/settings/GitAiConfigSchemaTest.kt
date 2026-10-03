package com.daidi.gitai.settings

import com.google.gson.JsonParser
import kotlin.test.Test
import kotlin.test.assertEquals

class GitAiConfigSchemaTest {
    @Test
    fun `schema defaults override plugin fallbacks`() {
        val schema = GitAiConfigSchema(
            fields = listOf(
                GitAiConfigFieldSchema("provider", "string", JsonParser.parseString("\"gemini\"")),
                GitAiConfigFieldSchema("model", "string", JsonParser.parseString("\"gemini-test\"")),
                GitAiConfigFieldSchema("commit_attribution", "string", JsonParser.parseString("\"compact\"")),
                GitAiConfigFieldSchema("smart_skip", "boolean", JsonParser.parseString("false")),
                GitAiConfigFieldSchema("max_diff_tokens", "integer", JsonParser.parseString("12000")),
            ),
        )

        val defaults = GitAiConfigManager.defaultsFrom(schema)

        assertEquals("gemini", defaults.provider)
        assertEquals("gemini-test", defaults.model)
        assertEquals("compact", defaults.commitAttribution)
        assertEquals("off", GitAiConfigManager.DEFAULTS.commitAttribution)
        assertEquals(false, defaults.smartSkip)
        assertEquals(12000, defaults.maxDiffTokens)
        assertEquals("queue", defaults.pushPolicy)
    }
}
