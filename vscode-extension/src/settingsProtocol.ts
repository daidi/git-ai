/** CLI settings protocol v1. Parse untrusted output before it reaches UI models. */
export const SETTINGS_PROTOCOL_VERSION = 1;
export class SettingsProtocolError extends Error {
    constructor() { super('settings.cli.incompatible'); }
}

export interface GitAiConfig {
    api_key?: string; model?: string; base_url?: string; provider?: string;
    language?: string; ui_language?: string; push_policy?: string; message_format?: string;
    commit_attribution?: string; prompt_template?: string; smart_skip?: boolean;
    max_diff_tokens?: number; log_level?: string; check_update?: boolean;
    explain?: boolean; api_key_configured?: boolean;
}
export interface ConfigFieldSchema {
    key: string; type: string; default?: string | number | boolean;
    enum?: string[]; minimum?: number; maximum?: number;
}
export interface ConfigSchema {
    version: number; fields: ConfigFieldSchema[];
    providers: Array<{ id: string; label: string; requires_api_key: boolean; default_base_url: string; default_model: string }>;
}
export interface ModelCatalog {
    provider: string; current_model?: string;
    models: Array<{ id: string; display_name?: string }>;
}
const strings = new Set(['api_key', 'model', 'base_url', 'provider', 'language', 'ui_language',
    'push_policy', 'message_format', 'commit_attribution', 'prompt_template', 'log_level']);
const booleans = new Set(['smart_skip', 'check_update', 'explain', 'api_key_configured']);
function object(value: unknown): asserts value is Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new SettingsProtocolError();
}
function requireValue(valid: boolean): asserts valid {
    if (!valid) throw new SettingsProtocolError();
}
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const integer = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
function decode(text: string): Record<string, unknown> {
    try { const value: unknown = JSON.parse(text); object(value); return value; }
    catch { throw new SettingsProtocolError(); } // Never surface response bodies or parser diagnostics.
}
export function parseConfig(text: string): GitAiConfig {
    const value = decode(text);
    for (const [key, member] of Object.entries(value)) {
        if (member === null) { delete value[key]; continue; }
        if (strings.has(key)) requireValue(typeof member === 'string');
        if (booleans.has(key)) requireValue(typeof member === 'boolean');
        if (key === 'max_diff_tokens') requireValue(integer(member));
    }
    return value as GitAiConfig;
}
export function parseSchema(text: string): ConfigSchema {
    const value = decode(text);
    requireValue(value.version === SETTINGS_PROTOCOL_VERSION);
    requireValue(Array.isArray(value.fields) && value.fields.length > 0);
    requireValue(Array.isArray(value.providers) && value.providers.length > 0);
    const fields = new Set<string>();
    for (const field of value.fields) {
        object(field);
        requireValue(nonempty(field.key) && !fields.has(field.key) && typeof field.type === 'string');
        fields.add(field.key);
        if (field.default != null) {
            if (field.type === 'string') requireValue(typeof field.default === 'string');
            if (field.type === 'boolean') requireValue(typeof field.default === 'boolean');
            if (field.type === 'integer') requireValue(integer(field.default));
        }
        if ('enum' in field) requireValue(Array.isArray(field.enum) && field.enum.every(v => typeof v === 'string'));
        for (const key of ['minimum', 'maximum']) if (key in field) requireValue(integer(field[key]));
    }
    const providers = new Set<string>();
    for (const provider of value.providers) {
        object(provider);
        requireValue(nonempty(provider.id) && !providers.has(provider.id));
        providers.add(provider.id);
        for (const key of ['label', 'default_base_url', 'default_model']) requireValue(nonempty(provider[key]));
        requireValue(typeof provider.requires_api_key === 'boolean');
    }
    return value as unknown as ConfigSchema;
}
export function parseModels(text: string): ModelCatalog {
    const value = decode(text);
    requireValue(typeof value.provider === 'string' && Array.isArray(value.models));
    if (value.current_model != null) requireValue(typeof value.current_model === 'string');
    for (const model of value.models) {
        object(model); requireValue(nonempty(model.id));
        if (model.display_name != null) requireValue(typeof model.display_name === 'string');
    }
    return value as unknown as ModelCatalog;
}
