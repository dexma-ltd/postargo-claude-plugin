// Profiles in ~/.config/postargo/config.json (mode 0600). Env overrides: POSTARGO_URL, POSTARGO_API_KEY, POSTARGO_PROFILE.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CliError } from "./errors.js";
export const DEFAULT_PROFILE = "default";
export function configPath(env = process.env) {
    if (env.POSTARGO_CONFIG)
        return env.POSTARGO_CONFIG;
    const base = env.XDG_CONFIG_HOME || join(homedir(), ".config");
    return join(base, "postargo", "config.json");
}
export function readConfig(path = configPath()) {
    if (!existsSync(path))
        return { profiles: {} };
    try {
        const data = JSON.parse(readFileSync(path, "utf8"));
        return { current: data.current, profiles: data.profiles && typeof data.profiles === "object" ? data.profiles : {} };
    }
    catch (err) {
        throw new CliError(`Cannot read ${path}: ${err.message}`);
    }
}
export function writeConfig(cfg, path = configPath()) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const tmp = `${path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, path);
}
/** "https://x.com/", "https://x.com/api", "x.com" → "https://x.com" */
export function normalizeUrl(input) {
    let s = input.trim();
    if (!/^https?:\/\//i.test(s))
        s = `https://${s}`;
    let u;
    try {
        u = new URL(s);
    }
    catch {
        throw new CliError(`Invalid URL: ${input}`);
    }
    const path = u.pathname.replace(/\/+$/, "").replace(/\/(api|mcp)$/, "");
    return `${u.protocol}//${u.host}${path}`;
}
/** Profile name in use: --profile, else POSTARGO_PROFILE, else the config's current profile, else "default". */
export function profileName(flag, cfg, env = process.env) {
    return flag || env.POSTARGO_PROFILE || cfg.current || DEFAULT_PROFILE;
}
export function resolveAuth(flag, env = process.env, path = configPath(env)) {
    const cfg = readConfig(path);
    const name = profileName(flag, cfg, env);
    const p = cfg.profiles[name];
    if (flag && !p && !(env.POSTARGO_URL && env.POSTARGO_API_KEY)) {
        const known = Object.keys(cfg.profiles);
        throw new CliError(`Unknown profile "${name}".${known.length ? ` Profiles: ${known.join(", ")}.` : ""} Run: postargo login --profile ${name} --url <url>`);
    }
    const url = env.POSTARGO_URL || p?.url;
    const key = env.POSTARGO_API_KEY || p?.key;
    if (!url || !key) {
        throw new CliError("Not logged in. Run: postargo login --url https://<your-postargo> (create an API key in PostArgo → Profile),\n" +
            "or set POSTARGO_URL and POSTARGO_API_KEY.");
    }
    const fromEnv = [!!env.POSTARGO_URL, !!env.POSTARGO_API_KEY];
    return {
        url: normalizeUrl(url),
        key,
        profile: name,
        source: fromEnv.every(Boolean) ? "env" : fromEnv.some(Boolean) ? "mixed" : "config",
    };
}
