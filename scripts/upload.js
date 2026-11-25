// Media uploads: one streamed request up to 90MB, R2 multipart (/api/media/multipart) above. Never buffers the file.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { Readable } from "node:stream";
import { ApiError, CliError } from "./errors.js";
import { c, fmtBytes } from "./format.js";
import { fileInfo, mimeFromPath } from "./mediainfo.js";
/** Same limit as the server (Workers cap request bodies at 100MB). */
export const SINGLE_UPLOAD_MAX = 90 * 1024 * 1024;
/** Split a file into parts of `partSize` (R2 needs equal parts except the last one). Part numbers start at 1. */
export function planParts(size, partSize) {
    if (!(partSize > 0))
        throw new Error("Invalid part size");
    const parts = [];
    for (let start = 0, n = 1; start < size; start += partSize, n++)
        parts.push({ partNumber: n, start, end: Math.min(start + partSize, size) });
    return parts;
}
/** A web stream of a byte range of a file that reports progress as it is read. */
function fileStream(path, start, end, onBytes) {
    const rs = end > start ? createReadStream(path, { start, end: end - 1, highWaterMark: 1024 * 1024 }) : Readable.from([]);
    rs.on("data", (chunk) => onBytes(chunk.length));
    return Readable.toWeb(rs);
}
export async function uploadFile(api, path, opts = {}) {
    let st;
    try {
        st = await stat(path);
    }
    catch {
        throw new CliError(`File not found: ${path}`);
    }
    if (!st.isFile())
        throw new CliError(`Not a file: ${path}`);
    if (!st.size)
        throw new CliError(`Empty file: ${path}`);
    const mime = opts.mime ?? mimeFromPath(path);
    if (!mime)
        throw new CliError(`${path}: unsupported file type (images: jpg, png, gif, webp, heic, avif; videos: mp4, mov, webm, m4v, mpeg)`);
    const filename = basename(path);
    const info = await fileInfo(path, mime);
    const size = st.size;
    let sent = 0;
    const report = (n) => {
        sent += n;
        opts.onProgress?.(Math.min(sent, size), size);
    };
    opts.onProgress?.(0, size);
    if (size <= (opts.singleUploadMax ?? SINGLE_UPLOAD_MAX)) {
        const headers = {
            "content-type": mime,
            "content-length": String(size),
            "x-filename": encodeURIComponent(filename),
        };
        if (info.width)
            headers["x-width"] = String(info.width);
        if (info.height)
            headers["x-height"] = String(info.height);
        if (info.duration)
            headers["x-duration"] = String(info.duration);
        let media = await api.request("POST", "/media", { raw: fileStream(path, 0, size, report), headers });
        if (opts.alt)
            media = await api.patch(`/media/${media.id}`, { alt: opts.alt });
        return media;
    }
    const init = await api.post("/media/multipart", {
        filename,
        mime,
        size,
        width: info.width ?? null,
        height: info.height ?? null,
        duration: info.duration ?? null,
        alt: opts.alt ?? null,
    });
    const uploaded = [];
    try {
        for (const part of planParts(size, init.partSize)) {
            const retries = opts.retries ?? 3;
            for (let attempt = 0;; attempt++) {
                const before = sent;
                try {
                    uploaded.push(await api.request("PUT", `/media/multipart/${init.id}/${part.partNumber}`, {
                        raw: fileStream(path, part.start, part.end, report),
                        headers: { "content-type": "application/octet-stream", "content-length": String(part.end - part.start) },
                    }));
                    break;
                }
                catch (err) {
                    const retryable = err instanceof ApiError && (err.status === 0 || err.status >= 500);
                    if (!retryable || attempt >= retries)
                        throw err;
                    sent = before;
                    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
                }
            }
        }
        return await api.post(`/media/multipart/${init.id}/complete`, { parts: uploaded });
    }
    catch (err) {
        // Abort the dangling upload so it does not linger in the library.
        await api.delete(`/media/${init.id}`).catch(() => { });
        throw err;
    }
}
/** A one-line progress bar on stderr (TTY only). Returns the callback and a `done` to end the line. */
export function progressBar(label) {
    if (!process.stderr.isTTY)
        return { onProgress: () => { }, done: () => { } };
    const started = Date.now();
    let last = 0;
    let lastLine = "";
    const draw = (sent, total, force = false) => {
        const t = Date.now();
        if (!force && t - last < 100)
            return;
        last = t;
        const width = 24;
        const frac = total ? sent / total : 0;
        const filled = Math.round(frac * width);
        const speed = sent / Math.max((t - started) / 1000, 0.001);
        const name = label.length > 28 ? label.slice(0, 27) + "…" : label;
        lastLine = `  ${name}  ${c.cyan("█".repeat(filled))}${c.gray("░".repeat(width - filled))} ${String(Math.floor(frac * 100)).padStart(3)}%  ${fmtBytes(sent)}/${fmtBytes(total)}  ${fmtBytes(speed)}/s`;
        process.stderr.write(`\r\x1b[2K${lastLine}`);
    };
    return {
        onProgress: (s, t) => draw(s, t, s === t),
        done: () => {
            if (lastLine)
                process.stderr.write(`\r\x1b[2K`);
        },
    };
}
