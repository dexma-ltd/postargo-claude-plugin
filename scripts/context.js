import { Api } from "./api.js";
import { serverVersion } from "./compat.js";
import { resolveAuth } from "./config.js";
import { resolveAccounts, usesGroups } from "./resolve.js";
export class Ctx {
    parsed;
    deps;
    json;
    _api;
    _auth;
    _accounts;
    _providers;
    _groups;
    constructor(parsed, deps) {
        this.parsed = parsed;
        this.deps = deps;
        this.json = !!parsed.values.json;
    }
    get env() {
        return this.deps.env ?? process.env;
    }
    get now() {
        return this.deps.now?.() ?? new Date();
    }
    get profileFlag() {
        return typeof this.parsed.values.profile === "string" ? this.parsed.values.profile : undefined;
    }
    get auth() {
        return (this._auth ??= resolveAuth(this.profileFlag, this.env));
    }
    get api() {
        if (!this._api) {
            this._api = new Api(this.auth.url, this.auth.key, this.deps.fetch);
            // Server compatibility check, in parallel with the command (main.ts prints its warning at the end).
            if (!this.env.POSTARGO_NO_VERSION_CHECK)
                void serverVersion(this._api);
        }
        return this._api;
    }
    /** The API client if the command used one (for the compatibility warning). */
    get usedApi() {
        return this._api;
    }
    accounts() {
        return (this._accounts ??= this.api.get("/accounts"));
    }
    groups() {
        return (this._groups ??= this.api.get("/account-groups"));
    }
    /** --account selectors → accounts; loads the account groups only when a `group:<name>` selector is used. */
    async resolveAccounts(selectors) {
        const [accounts, groups] = await Promise.all([this.accounts(), usesGroups(selectors) ? this.groups() : undefined]);
        return resolveAccounts(selectors, accounts, groups);
    }
    providers() {
        return (this._providers ??= this.api.get("/providers"));
    }
    async provider(id) {
        const p = (await this.providers()).find((x) => x.id === id);
        if (!p)
            throw new Error(`Unknown platform ${id}`);
        return p;
    }
}
