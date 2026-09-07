package com.daidi.gitai.state

/** Detects failures that mean the IDE settings protocol is newer than the CLI. */
internal object GitAiCliCompatibility {
    private val missingSettingsCommand = Regex("""unknown command\s+[\"']?(replace|reset|schema|models)[\"']?""")

    fun isSettingsProtocolMismatch(result: GitAiCli.Result): Boolean {
        if (result.success) return false
        val output = "${result.stderr}\n${result.stdout}".lowercase()
        return output.contains("unknown flag: --scope") ||
            output.contains("unknown flag: --json") ||
            output.contains("unknown config key: smart_skip") ||
            missingSettingsCommand.containsMatchIn(output)
    }
}
