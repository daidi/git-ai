package com.daidi.gitai.settings

import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/** Validate the wire contract before Gson can coerce values or inject nulls into Kotlin models. */
internal object GitAiSettingsProtocol {
    const val VERSION = 1
    private val gson = Gson()
    private val booleans = setOf("smart_skip", "check_update", "explain", "api_key_configured")
    private val strings = setOf("api_key", "model", "base_url", "provider", "language", "ui_language",
        "push_policy", "message_format", "commit_attribution", "prompt_template", "log_level")

    fun schema(text: String): GitAiConfigSchema? = decode(text) { json ->
        require(json["version"]?.isJsonPrimitive == true && json["version"].asJsonPrimitive.isNumber)
        require(json["version"].asString == VERSION.toString())
        val fields = json["fields"]?.takeIf { it.isJsonArray }?.asJsonArray ?: return@decode null
        val providers = json["providers"]?.takeIf { it.isJsonArray }?.asJsonArray ?: return@decode null
        require(fields.size() > 0 && providers.size() > 0)
        val seenFields = mutableSetOf<String>()
        fields.forEach { element ->
            val field = element.asJsonObject
            require(isString(field["key"]) && field["key"].asString.isNotBlank())
            require(seenFields.add(field["key"].asString))
            require(isString(field["type"]))
            field["default"]?.takeUnless { it.isJsonNull }?.let { value ->
                when (field["type"].asString) {
                    "string" -> require(isString(value))
                    "boolean" -> require(isBoolean(value))
                    "integer" -> require(isInteger(value))
                }
            }
            field["enum"]?.let { values -> require(values.isJsonArray && values.asJsonArray.all(::isString)) }
            for (key in listOf("minimum", "maximum")) field[key]?.let { require(isInteger(it)) }
        }
        val seenProviders = mutableSetOf<String>()
        providers.forEach { element ->
            val provider = element.asJsonObject
            for (key in listOf("id", "label", "default_base_url", "default_model")) {
                require(isString(provider[key]) && provider[key].asString.isNotBlank())
            }
            require(seenProviders.add(provider["id"].asString))
            require(isBoolean(provider["requires_api_key"]))
        }
        gson.fromJson(json, GitAiConfigSchema::class.java)
    }

    fun config(text: String): GitAiConfig? = decode(text) { json ->
        for ((key, value) in json.entrySet()) {
            if (value.isJsonNull) continue
            when (key) {
                in booleans -> require(isBoolean(value))
                in strings -> require(isString(value))
                "max_diff_tokens" -> require(isInteger(value))
            }
        }
        val configured = json.remove("api_key_configured")?.takeUnless { it.isJsonNull }?.asBoolean ?: false
        gson.fromJson(json, GitAiConfig::class.java).apply { apiKeyConfigured = configured }
    }

    fun models(text: String): GitAiModelCatalog? = decode(text) { json ->
        require(isString(json["provider"]))
        json["current_model"]?.takeUnless { it.isJsonNull }?.let { require(isString(it)) }
        val models = json["models"]?.takeIf { it.isJsonArray }?.asJsonArray ?: return@decode null
        models.forEach { element ->
            val model = element.asJsonObject
            require(isString(model["id"]) && model["id"].asString.isNotBlank())
            model["display_name"]?.takeUnless { it.isJsonNull }?.let { require(isString(it)) }
        }
        gson.fromJson(json, GitAiModelCatalog::class.java)
    }

    private fun isString(value: JsonElement?): Boolean = value?.isJsonPrimitive == true && value.asJsonPrimitive.isString
    private fun isBoolean(value: JsonElement?): Boolean = value?.isJsonPrimitive == true && value.asJsonPrimitive.isBoolean
    private fun isInteger(value: JsonElement?): Boolean = value?.isJsonPrimitive == true &&
        value.asJsonPrimitive.isNumber && value.asString.toIntOrNull() != null

    private fun <T> decode(text: String, read: (JsonObject) -> T?): T? = try {
        val root = JsonParser.parseString(text)
        if (root.isJsonObject) read(root.asJsonObject) else null
    } catch (_: RuntimeException) {
        // CLI output can contain configuration or credentials. Never include
        // parser errors or raw output in diagnostics or user-facing messages.
        null
    }
}
