/** Detects failures that mean the IDE settings protocol is newer than the CLI. */
export function isSettingsProtocolMismatch(error: unknown): boolean {
    const output = (error instanceof Error ? error.message : String(error)).toLowerCase();
    return output.includes('unknown flag: --scope')
        || output.includes('unknown flag: --json')
        || output.includes('unknown config key: smart_skip')
        || /unknown command\s+["']?(replace|reset|schema|models)["']?/.test(output);
}
