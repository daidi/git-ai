/** Keep policy and edge cases aligned with JetBrains GitAiUpdatePolicy. */
export const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
export const FAILURE_BACKOFF_MS = 15 * 60 * 1000;
export interface UpdateCache { identity: string; lastSuccess: number; lastFailure: number; latest: string }
export function emptyCache(identity = ''): UpdateCache { return { identity, lastSuccess: 0, lastFailure: 0, latest: '' }; }
export function stableVersion(value: string): number[] | undefined {
    if (!/^v?\d+\.\d+\.\d+$/.test(value)) return undefined;
    const parts = value.replace(/^v/, '').split('.').map(Number);
    return parts.every(v => Number.isInteger(v) && v <= 2147483647) ? parts : undefined;
}
export function installedVersion(output: string): string | undefined {
    return output.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
        .match(/^.*?Git[- ]AI(?: CLI)?(?: version)?\s+v?(dev|\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)\s*$/im)?.[1];
}
export function isNewer(current: string, latest: string): boolean {
    const c = stableVersion(current), l = stableVersion(latest);
    if (!c || !l) return false;
    for (let i = 0; i < 3; i++) if (l[i] !== c[i]) return l[i] > c[i];
    return false;
}
export function shouldFetch(cache: UpdateCache, identity: string, now: number, manual: boolean): boolean {
    if (manual || cache.identity !== identity) return true;
    const recent = (time: number, ttl: number) => time > 0 && now >= time && now - time < ttl;
    if (cache.lastFailure > 0 && cache.lastFailure >= cache.lastSuccess) return !recent(cache.lastFailure, FAILURE_BACKOFF_MS);
    return !stableVersion(cache.latest) || !recent(cache.lastSuccess, SUCCESS_TTL_MS);
}
