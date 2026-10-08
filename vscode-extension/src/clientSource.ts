/** Return only a product label; never send an arbitrary host-provided string. */
export function clientSource(appName: string): string {
    const name = appName.toLowerCase();
    if (name.includes('cursor')) { return 'cursor'; }
    if (name.includes('windsurf')) { return 'windsurf'; }
    if (name.startsWith('visual studio code') || name.startsWith('vs code') || name === 'vscode') { return 'vscode'; }
    return 'vscode-family';
}
