// CLI ↔ server compatibility. The server reports its REST API contract version at GET /api/version (`apiVersion`,
// bumped on breaking API changes only). Servers older than the endpoint answer 404: they are treated as API 1.
/** Oldest server API version this CLI works with. */
export const MIN_API_VERSION = 1;
/** Newest server API version this CLI knows. */
export const MAX_API_VERSION = 1;
const cache = new Map();
const warned = new Set();
/** The server's version (once per process and server), or null when it is unknown (old server, network error...). */
export function serverVersion(api) {
    let p = cache.get(api.baseUrl);
    if (!p) {
        p = api.get("/version").then((v) => (v && typeof v.apiVersion === "number" ? v : null), () => null);
        cache.set(api.baseUrl, p);
    }
    return p;
}
/** The warning to print for this server, or null when the CLI and the server are compatible (or it is unknown). */
export function compatWarning(server, cliVersion) {
    if (!server)
        return null;
    if (server.apiVersion < MIN_API_VERSION) {
        return (`this PostArgo server (v${server.version}, API ${server.apiVersion}) is older than postargo CLI ${cliVersion} supports ` +
            `(API ${MIN_API_VERSION}+). Update the server, or install an older CLI.`);
    }
    if (server.apiVersion > MAX_API_VERSION) {
        return (`this PostArgo server (v${server.version}, API ${server.apiVersion}) is newer than postargo CLI ${cliVersion} knows ` +
            `(API ${MAX_API_VERSION}). Update the plugin.`);
    }
    return null;
}
/** Waits (at most `timeoutMs`) for the version check and returns its warning, once per server and process. */
export async function pendingWarning(api, cliVersion, timeoutMs = 2000) {
    if (warned.has(api.baseUrl))
        return null;
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
        timer.unref?.();
    });
    const server = await Promise.race([serverVersion(api), timeout]);
    clearTimeout(timer);
    const warning = compatWarning(server, cliVersion);
    if (warning)
        warned.add(api.baseUrl);
    return warning;
}
/** Tests: forget cached versions and warnings. */
export function resetCompatCache() {
    cache.clear();
    warned.clear();
}
