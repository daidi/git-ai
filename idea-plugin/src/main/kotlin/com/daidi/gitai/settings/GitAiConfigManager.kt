package com.daidi.gitai.settings

import com.daidi.gitai.GitAiBundle
import com.daidi.gitai.state.GitAiCli
import com.daidi.gitai.state.GitAiCliCompatibility
import com.daidi.gitai.state.GitAiInstaller
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonElement
import com.google.gson.JsonParser
import com.google.gson.annotations.SerializedName
import com.intellij.openapi.progress.EmptyProgressIndicator
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProcessCanceledException
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

/**
 * Configuration facade. All persistence is delegated to git-ai: global values
 * use the OS application config directory and repository overrides use
 * `.git/config`; the plugin never creates a worktree file.
 */
object GitAiConfigManager {
    private val gson: Gson = GsonBuilder().create()
    private val compatibilityRepairLock = Any()
    private var compatibilityRepairAttempted = false

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
        val result = runWithCompatibilityRepair(indicator) {
            GitAiCli.run(project, "config", "list", "--scope", scope, "--json")
        }
        if (!result.success) throw IllegalStateException(result.errorText)
        val json = JsonParser.parseString(result.stdout).asJsonObject
        val keyConfigured = json.remove("api_key_configured")?.asBoolean ?: false
        return (gson.fromJson(json, GitAiConfig::class.java) ?: GitAiConfig()).apply {
            apiKeyConfigured = keyConfigured
        }
    }

    fun loadSchema(project: Project, indicator: ProgressIndicator? = null): GitAiConfigSchema {
        val result = runWithCompatibilityRepair(indicator) {
            GitAiCli.run(project, "config", "schema")
        }
        if (!result.success) throw IllegalStateException(result.errorText)
        return gson.fromJson(result.stdout, GitAiConfigSchema::class.java)
            ?: throw IllegalStateException("git-ai returned an empty configuration schema")
    }

    fun loadModels(project: Project, indicator: ProgressIndicator? = null): GitAiModelCatalog? {
        val result = runWithCompatibilityRepair(indicator) {
            GitAiCli.run(project, "config", "models", "--json")
        }
        if (!result.success) return null
        return gson.fromJson(result.stdout, GitAiModelCatalog::class.java)
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
        return runWithCompatibilityRepair(indicator) {
            GitAiCli.runWithInput(project, payload, "config", "replace", "--scope", scope)
        }
    }

    fun reset(project: Project, scope: String, indicator: ProgressIndicator? = null): GitAiCli.Result =
        runWithCompatibilityRepair(indicator) {
            GitAiCli.run(project, "config", "reset", "--scope", scope)
        }

    private fun runWithCompatibilityRepair(
        indicator: ProgressIndicator?,
        command: () -> GitAiCli.Result,
    ): GitAiCli.Result {
        var candidateResult = command()
        if (!GitAiCliCompatibility.isSettingsProtocolMismatch(candidateResult)) return candidateResult

        while (GitAiCli.rejectIncompatibleExecutableAndSelectNext()) {
            candidateResult = command()
            if (!GitAiCliCompatibility.isSettingsProtocolMismatch(candidateResult)) return candidateResult
        }

        // Candidate rejection is only for this negotiation attempt. Keep the
        // original CLI available to status/actions if download is unavailable.
        GitAiCli.invalidateExecutableCache()

        return synchronized(compatibilityRepairLock) {
            if (compatibilityRepairAttempted) {
                return@synchronized compatibleOrFriendly(command())
            }
            compatibilityRepairAttempted = true
            val installation = try {
                GitAiInstaller.installCliNow(indicator ?: EmptyProgressIndicator())
            } catch (error: ProcessCanceledException) {
                compatibilityRepairAttempted = false
                throw error
            }
            if (!installation.success) return@synchronized incompatibleResult()
            compatibleOrFriendly(command())
        }
    }

    private fun compatibleOrFriendly(result: GitAiCli.Result): GitAiCli.Result =
        if (GitAiCliCompatibility.isSettingsProtocolMismatch(result)) incompatibleResult() else result

    private fun incompatibleResult(): GitAiCli.Result = GitAiCli.Result(
        success = false,
        stdout = "",
        stderr = GitAiBundle.message("settings.cli.incompatible"),
    )
}
