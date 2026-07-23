/** Extract a plausible hostname from free-text domain_detail. */
export function extractHostname(detail: string): string | null {
    const raw = detail.trim().toLowerCase();
    if (!raw) return null;

    let host = raw
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split(/[\s/,;]+/)[0]
        ?.replace(/\/.*$/, '')
        .replace(/\.$/, '');

    if (!host || !host.includes('.')) return null;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)) {
        return null;
    }
    return host;
}
