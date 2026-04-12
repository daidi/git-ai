package com.daidi.gitai.settings

import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.annotations.SerializedName
import java.io.File

/**
 * Configuration data class matching the CLI's config.json structure.
 */
data class GitAiConfig(
    @SerializedName("api_key") var apiKey: String? = null,
    @SerializedName("model") var model: String? = null,
    @SerializedName("base_url") var baseUrl: String? = null,
    @SerializedName("provider") var provider: String? = null,
    @SerializedName("language") var language: String? = null,
    @SerializedName("ui_language") var uiLanguage: String? = null,
    @SerializedName("push_policy") var pushPolicy: String? = null,
    @SerializedName("message_format") var messageFormat: String? = null,
    @SerializedName("prompt_template") var promptTemplate: String? = null,
    @SerializedName("max_diff_tokens") var maxDiffTokens: Int? = null,
    @SerializedName("log_level") var logLevel: String? = null,
) {
    fun copy() = GitAiConfig(
        apiKey, model, baseUrl, provider, language, uiLanguage, pushPolicy, messageFormat, promptTemplate, maxDiffTokens, logLevel,
    )
}

/**
 * Reads and writes git-ai config JSON files.
 */
object GitAiConfigManager {
    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()

    val DEFAULTS = GitAiConfig(
        apiKey = "",
        model = "deepseek-chat",
        baseUrl = "https://api.deepseek.com/v1",
        provider = "openai",
        language = "en",
        uiLanguage = "",
        pushPolicy = "queue",
        messageFormat = "conventional",
        promptTemplate = "",
        maxDiffTokens = 2000,
        logLevel = "info",
    )

    fun globalPath(): String {
        val home = System.getProperty("user.home")
        return "$home/.config/git-ai/config.json"
    }

    fun projectPath(basePath: String): String {
        return "$basePath/.git-ai.json"
    }

    fun load(path: String): GitAiConfig {
        val file = File(path)
        if (!file.exists()) return GitAiConfig()
        return try {
            gson.fromJson(file.readText(), GitAiConfig::class.java) ?: GitAiConfig()
        } catch (_: Exception) {
            GitAiConfig()
        }
    }

    fun save(path: String, config: GitAiConfig) {
        // Only persist non-null, non-empty values so they don't shadow lower layers.
        val map = mutableMapOf<String, Any>()
        config.apiKey?.takeIf { it.isNotEmpty() }?.let { map["api_key"] = it }
        config.model?.takeIf { it.isNotEmpty() }?.let { map["model"] = it }
        config.baseUrl?.takeIf { it.isNotEmpty() }?.let { map["base_url"] = it }
        config.provider?.takeIf { it.isNotEmpty() }?.let { map["provider"] = it }
        config.language?.takeIf { it.isNotEmpty() }?.let { map["language"] = it }
        config.uiLanguage?.takeIf { it.isNotEmpty() }?.let { map["ui_language"] = it }
        config.pushPolicy?.takeIf { it.isNotEmpty() }?.let { map["push_policy"] = it }
        config.messageFormat?.takeIf { it.isNotEmpty() }?.let { map["message_format"] = it }
        config.promptTemplate?.takeIf { it.isNotEmpty() }?.let { map["prompt_template"] = it }
        config.maxDiffTokens?.takeIf { it > 0 }?.let { map["max_diff_tokens"] = it }
        config.logLevel?.takeIf { it.isNotEmpty() }?.let { map["log_level"] = it }

        val file = File(path)
        file.parentFile?.mkdirs()
        file.writeText(gson.toJson(map) + "\n")
    }

    fun delete(path: String) {
        File(path).delete()
    }

    /** Merge: defaults ← global ← project. Returns the effective config. */
    fun merged(basePath: String): GitAiConfig {
        val result = DEFAULTS.copy()
        mergeInto(result, load(globalPath()))
        mergeInto(result, load(projectPath(basePath)))
        return result
    }

    private fun mergeInto(dst: GitAiConfig, src: GitAiConfig) {
        src.apiKey?.takeIf { it.isNotEmpty() }?.let { dst.apiKey = it }
        src.model?.takeIf { it.isNotEmpty() }?.let { dst.model = it }
        src.baseUrl?.takeIf { it.isNotEmpty() }?.let { dst.baseUrl = it }
        src.provider?.takeIf { it.isNotEmpty() }?.let { dst.provider = it }
        src.language?.takeIf { it.isNotEmpty() }?.let { dst.language = it }
        src.uiLanguage?.takeIf { it.isNotEmpty() }?.let { dst.uiLanguage = it }
        src.pushPolicy?.takeIf { it.isNotEmpty() }?.let { dst.pushPolicy = it }
        src.messageFormat?.takeIf { it.isNotEmpty() }?.let { dst.messageFormat = it }
        src.promptTemplate?.takeIf { it.isNotEmpty() }?.let { dst.promptTemplate = it }
        src.maxDiffTokens?.takeIf { it > 0 }?.let { dst.maxDiffTokens = it }
        src.logLevel?.takeIf { it.isNotEmpty() }?.let { dst.logLevel = it }
    }
}
