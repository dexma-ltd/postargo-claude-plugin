// Thin client for the PostArgo REST API (`Authorization: Bearer pf_...`).
import { ApiError } from "./errors.js";
import { VERSION } from "./version.js";
export class Api {
    baseUrl;
    key;
    fetchImpl;
    constructor(baseUrl, key, fetchImpl = (input, init) => fetch(input, init)) {
        this.baseUrl = baseUrl;
        this.key = key;
        this.fetchImpl = fetchImpl;
    }
    url(path, query) {
        const u = new URL(`${this.baseUrl}/api${path}`);
        for (const [k, v] of Object.entries(query ?? {}))
            if (v !== undefined && v !== null && v !== "")
                u.searchParams.set(k, String(v));
        return u.toString();
    }
    async request(method, path, opts = {}) {
        const headers = {
            authorization: `Bearer ${this.key}`,
            accept: "application/json",
            "user-agent": `postargo-cli/${VERSION}`,
            ...(opts.headers ?? {}),
        };
        let body = opts.raw;
        if (opts.body !== undefined) {
            headers["content-type"] = "application/json";
            body = JSON.stringify(opts.body);
        }
        const stream = typeof ReadableStream !== "undefined" && body instanceof ReadableStream;
        let res;
        try {
            res = await this.fetchImpl(this.url(path, opts.query), { method, headers, body, ...(stream ? { duplex: "half" } : {}) });
        }
        catch (err) {
            const cause = err.cause;
            throw new ApiError(`Cannot reach ${this.baseUrl}: ${cause?.code ?? cause?.message ?? err.message}`, 0);
        }
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        }
        catch {
            /* not JSON */
        }
        if (!res.ok) {
            let message = data?.error ?? (text && !text.trimStart().startsWith("<") ? text.slice(0, 300) : `HTTP ${res.status} ${res.statusText}`);
            if (res.status === 401)
                message += " (check your API key: postargo login)";
            // Hosted instances: the workspace's plan does not allow it (limit reached, no API access, or no active plan).
            if (res.status === 402 && data?.code === "plan_limit" && typeof data.upgradeUrl === "string")
                message += ` Manage the plan: ${data.upgradeUrl}`;
            throw new ApiError(message, res.status, data);
        }
        if (data === null && text)
            throw new ApiError(`Unexpected response from ${this.baseUrl} (not JSON). Is the URL right?`, res.status);
        return data;
    }
    get(path, query) {
        return this.request("GET", path, { query });
    }
    post(path, body) {
        return this.request("POST", path, { body: body ?? {} });
    }
    patch(path, body) {
        return this.request("PATCH", path, { body });
    }
    delete(path) {
        return this.request("DELETE", path);
    }
}
