package com.daidi.gitai.settings

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class GitAiSettingsProtocolTest {
    private val validSchema = """{
        "version":1,
        "fields":[{"key":"provider","type":"string","default":"openai","enum":["openai"]}],
        "providers":[{"id":"openai","label":"OpenAI compatible","requires_api_key":true,
            "default_base_url":"https://example.invalid/v1","default_model":"example"}]
    }"""

    @Test
    fun `old CLI help returned with exit code zero is not a schema`() {
        val oldCliOutput = """
            Manage git-ai configuration

            Usage:
              git-ai config [flags]
              git-ai config [command]

            Available Commands:
              get         Get a merged configuration value
              list        Show configuration values
        """.trimIndent()
        assertNull(GitAiSettingsProtocol.schema(oldCliOutput))
        assertNull(GitAiSettingsProtocol.config(oldCliOutput))
        assertNull(GitAiSettingsProtocol.models(oldCliOutput))
    }

    @Test
    fun `reject non-object roots and malformed output without surfacing parser errors`() {
        for (output in listOf("", "null", "[]", "42", "true", "\"secret-token\"", "<html>error</html>", "{bad", "$validSchema\nUpdate available")) {
            assertNull(GitAiSettingsProtocol.schema(output))
            assertNull(GitAiSettingsProtocol.config(output))
            assertNull(GitAiSettingsProtocol.models(output))
        }
    }

    @Test
    fun `schema must have a supported version and correctly typed members`() {
        assertEquals(1, assertNotNull(GitAiSettingsProtocol.schema(validSchema)).version)
        for (schema in listOf(
            "{}", validSchema.replace("\"version\":1", "\"version\":2"),
            validSchema.replace("\"version\":1", "\"version\":\"1\""),
            validSchema.replace("\"fields\":[{", "\"fields\":[null,{"),
            validSchema.replace("\"type\":\"string\"", "\"type\":\"boolean\""),
            validSchema.replace("\"requires_api_key\":true", "\"requires_api_key\":\"true\""),
            validSchema.replace("\"default_model\":\"example\"", "\"default_model\":null"),
        )) assertNull(GitAiSettingsProtocol.schema(schema))
    }

    @Test
    fun `config allows empty scopes and additive fields but not type coercion`() {
        assertNotNull(GitAiSettingsProtocol.config("{}"))
        val config = assertNotNull(GitAiSettingsProtocol.config("""{"api_key_configured":true,"model":"demo","usage_telemetry":false}"""))
        assertEquals("demo", config.model)
        assertEquals(true, config.apiKeyConfigured)
        for (json in listOf("""{"model":{}}""", """{"smart_skip":"false"}""", """{"api_key_configured":[]} """, """{"max_diff_tokens":1.5}""")) {
            assertNull(GitAiSettingsProtocol.config(json))
        }
    }

    @Test
    fun `model catalogs accept cache metadata but not null list elements`() {
        assertNotNull(GitAiSettingsProtocol.models("""{"provider":"openai","models":[],"source":"cache","fetched_at":"2026-10-09T00:00:00Z"}"""))
        for (json in listOf("{}", """{"provider":"openai","models":null}""", """{"provider":"openai","models":[null]}""",
            """{"provider":"openai","models":[{"id":42}]}""")) assertNull(GitAiSettingsProtocol.models(json))
    }
}
