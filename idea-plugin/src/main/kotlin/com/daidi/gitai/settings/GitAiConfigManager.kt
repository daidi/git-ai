package com.daidi.gitai.settings

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiCliCompatibility
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName
import com.intellij.openapi.progress.ProgressIndicator
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
    @SerializedName("commit_attribution") var commitAttribution: String? = null,
    @SerializedName("prompt_template") var promptTemplate: String? = null,
    @SerializedName("smart_skip") var smartSkip: Boolean? = null,
    @SerializedName("max_diff_tokens") var maxDiffTokens: Int? = null,
    @SerializedName("log_level") var logLevel: String? = null,
    @SerializedName("check_update") var checkUpdate: Boolean? = null,
    @SerializedName("explain") var explain: Boolean? = null,
    @Transient var apiKeyConfigured: Boolean = false,
)

data class GitAiConfigFieldSchema(
    val key: String = "",
    val type: String = "",
    val default: JsonElement? = null,
    @SerializedName("enum") val values: List<String> = emptyList(),
    val minimum: Int? = null,
    val maximum: Int? = null,
)

data class GitAiProviderSchema(
    val id: String = "",
    val label: String = "",
    @SerializedName("requires_api_key") val requiresApiKey: Boolean = true,
    @SerializedName("default_base_url") val defaultBaseUrl: String = "",
    @SerializedName("default_model") val defaultModel: String = "",
)

data class GitAiConfigSchema(
    val version: Int = 0,
    val fields: List<GitAiConfigFieldSchema> = emptyList(),
    val providers: List<GitAiProviderSchema> = emptyList(),
)

data class GitAiModelInfo(
    val id: String = "",
    @SerializedName("display_name") val displayName: String? = null,
)

data class GitAiModelCatalog(
    val provider: String = "",
    @SerializedName("current_model") val currentModel: String? = null,
    val models: List<GitAiModelInfo> = emptyList(),
)

internal class GitAiSettingsProtocolException : IllegalStateException(GitAiBundle.message("settings.cli.incompatible"))

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
        commitAttribution = "off",
        smartSkip = true,
        maxDiffTokens = 8000,
        logLevel = "info",
        checkUpdate = true,
        explain = false,
    )

    fun load(project: Project, scope: String, indicator: ProgressIndicator? = null): GitAiConfig {
        val result = runChecked(indicator) {
            GitAiCli.run(project, "config", "list", "--scope", scope, "--json")
        }
        requireSuccess(result)
        return GitAiSettingsProtocol.config(result.stdout) ?: throw GitAiSettingsProtocolException()
    }

    fun loadSchema(project: Project, indicator: ProgressIndicator? = null): GitAiConfigSchema {
        val result = runChecked(indicator) {
            GitAiCli.run(project, "config", "schema")
        }
        requireSuccess(result)
        return GitAiSettingsProtocol.schema(result.stdout) ?: throw GitAiSettingsProtocolException()
    }

    fun loadModels(project: Project, indicator: ProgressIndicator? = null): GitAiModelCatalog? {
        val result = runChecked(indicator) {
            GitAiCli.run(project, "config", "models", "--json")
        }
        if (!result.success) return null
        return GitAiSettingsProtocol.models(result.stdout)
    }

    fun defaultsFrom(schema: GitAiConfigSchema): GitAiConfig {
        val fields = schema.fields.associateBy { it.key }
        fun string(key: String, fallback: String?): String? =
            fields[key]?.default?.takeUnless { it.isJsonNull }?.asString ?: fallback
        fun boolean(key: String, fallback: Boolean?): Boolean? =
            fields[key]?.default?.takeUnless { it.isJsonNull }?.asBoolean ?: fallback
        fun integer(key: String, fallback: Int?): Int? =
            fields[key]?.default?.takeUnless { it.isJsonNull }?.asInt ?: fallback
        return DEFAULTS.copy(
            model = string("model", DEFAULTS.model),
            baseUrl = string("base_url", DEFAULTS.baseUrl),
            provider = string("provider", DEFAULTS.provider),
            language = string("language", DEFAULTS.language),
            uiLanguage = string("ui_language", DEFAULTS.uiLanguage),
            pushPolicy = string("push_policy", DEFAULTS.pushPolicy),
            messageFormat = string("message_format", DEFAULTS.messageFormat),
            commitAttribution = string("commit_attribution", DEFAULTS.commitAttribution),
            promptTemplate = string("prompt_template", DEFAULTS.promptTemplate),
            smartSkip = boolean("smart_skip", DEFAULTS.smartSkip),
            maxDiffTokens = integer("max_diff_tokens", DEFAULTS.maxDiffTokens),
            logLevel = string("log_level", DEFAULTS.logLevel),
            checkUpdate = boolean("check_update", DEFAULTS.checkUpdate),
            explain = boolean("explain", DEFAULTS.explain),
        )
    }

    fun replace(
        project: Project,
        scope: String,
        config: GitAiConfig,
        indicator: ProgressIndicator? = null,
    ): GitAiCli.Result {
        val payload = gson.toJson(config)
        return runChecked(indicator) {
            GitAiCli.runWithInput(project, payload, "config", "replace", "--scope", scope)
        }
    }

    fun reset(project: Project, scope: String, indicator: ProgressIndicator? = null): GitAiCli.Result =
        runChecked(indicator) {
            GitAiCli.run(project, "config", "reset", "--scope", scope)
        }

    private fun runChecked(
        indicator: ProgressIndicator?,
        command: () -> GitAiCli.Result,
    ): GitAiCli.Result {
        indicator?.checkCanceled()
        val result = command()
        indicator?.checkCanceled()
        // Checking compatibility is read-only. Installation is an explicit UI
        // action; a settings read must never silently replace the executable.
        return result
    }

    private fun requireSuccess(result: GitAiCli.Result) {
        if (GitAiCliCompatibility.isSettingsProtocolMismatch(result)) throw GitAiSettingsProtocolException()
        if (!result.success) throw IllegalStateException(GitAiBundle.message("settings.cli.unavailable"))
    }
}
