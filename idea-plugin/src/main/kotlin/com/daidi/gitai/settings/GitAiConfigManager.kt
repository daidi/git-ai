package com.daidi.gitai.settings

import com.daidi.gitai.state.GitAiCli
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonParser
import com.google.gson.annotations.SerializedName
import com.intellij.openapi.project.Project

/** Configuration data exchanged with the CLI. */
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
    @SerializedName("check_update") var checkUpdate: Boolean? = null,
    @SerializedName("explain") var explain: Boolean? = null,
    @Transient var apiKeyConfigured: Boolean = false,
)

/**
 * Configuration facade. All persistence is delegated to git-ai: global values
 * use the OS application config directory and repository overrides use
 * `.git/config`; the plugin never creates a worktree file.
 */
object GitAiConfigManager {
    private val gson: Gson = GsonBuilder().create()

    val DEFAULTS = GitAiConfig(
        model = "deepseek-chat",
        baseUrl = "https://api.deepseek.com/v1",
        provider = "openai",
        language = "en",
        pushPolicy = "queue",
        messageFormat = "conventional",
        maxDiffTokens = 8000,
        logLevel = "info",
        checkUpdate = true,
        explain = false,
    )

    fun load(project: Project, scope: String): GitAiConfig {
        val result = GitAiCli.run(project, "config", "list", "--scope", scope, "--json")
        if (!result.success) throw IllegalStateException(result.errorText)
        val json = JsonParser.parseString(result.stdout).asJsonObject
        val keyConfigured = json.remove("api_key_configured")?.asBoolean ?: false
        return (gson.fromJson(json, GitAiConfig::class.java) ?: GitAiConfig()).apply {
            apiKeyConfigured = keyConfigured
        }
    }

    fun replace(project: Project, scope: String, config: GitAiConfig): GitAiCli.Result {
        val payload = gson.toJson(config)
        return GitAiCli.runWithInput(project, payload, "config", "replace", "--scope", scope)
    }

    fun reset(project: Project, scope: String): GitAiCli.Result =
        GitAiCli.run(project, "config", "reset", "--scope", scope)
}
