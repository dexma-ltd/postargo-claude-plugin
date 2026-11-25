import { str } from "../args.js";
import { c, eprintln, fmtBytes, fmtDate, fmtDuration, println, printJson, table } from "../format.js";
import { progressBar, uploadFile } from "../upload.js";
/** Upload files one by one with a progress bar (TTY, not --json). */
export async function uploadAll(ctx, files, alt) {
    const out = [];
    for (const f of files) {
        const bar = ctx.json ? { onProgress: () => { }, done: () => { } } : progressBar(f.split("/").pop() ?? f);
        try {
            out.push(await uploadFile(ctx.api, f, { alt, onProgress: bar.onProgress }));
        }
        finally {
            bar.done();
        }
        if (!ctx.json)
            eprintln(`${c.green("✓")} Uploaded ${f} → ${c.bold(out[out.length - 1].id)}`);
    }
    return out;
}
const dims = (m) => (m.width && m.height ? `${m.width}x${m.height}` : "");
function mediaTable(rows) {
    return table([
        { header: "ID" },
        { header: "KIND" },
        { header: "FILENAME", flex: true },
        { header: "SIZE", align: "right" },
        { header: "DIMENSIONS" },
        { header: "LENGTH", align: "right" },
        { header: "ALT", flex: true },
        { header: "CREATED" },
    ], rows.map((m) => [m.id, m.kind, m.filename, fmtBytes(m.size), dims(m), m.kind === "video" ? fmtDuration(m.duration) : "", m.alt ?? "", fmtDate(m.createdAt)]));
}
export const mediaUpload = {
    name: "media upload",
    args: "<files...>",
    summary: "Upload images/videos to the media library (streamed; files over 90MB use multipart, up to 5GB).",
    description: "Width/height (JPEG, PNG, WebP, GIF) and video duration/size (MP4, MOV) are read from the file headers.",
    options: { alt: { type: "string", arg: "<text>", description: "Alt text (applied to every file)" } },
    min: 1,
    examples: ["postargo media upload photo.jpg", "postargo media upload clip.mp4 --alt \"Demo of the new feature\"", "postargo media upload *.jpg --json"],
    async run(ctx, { values, positionals }) {
        const media = await uploadAll(ctx, positionals, str(values.alt));
        if (ctx.json)
            return printJson(media);
        println(mediaTable(media));
    },
};
export const mediaList = {
    name: "media list",
    summary: "List the media library (newest first).",
    options: { limit: { type: "string", arg: "<n>", description: "How many (default 30, max 200)" } },
    max: 0,
    async run(ctx, { values }) {
        const rows = await ctx.api.get("/media", { limit: Number(str(values.limit)) || 30 });
        if (ctx.json)
            return printJson(rows);
        if (!rows.length)
            return println("The media library is empty. Upload with: postargo media upload <files>");
        println(mediaTable(rows));
    },
};
export const mediaAlias = { ...mediaList, name: "media", hidden: true };
export const mediaImport = {
    name: "media import",
    args: "<url>",
    summary: "Import an image or video from a public URL into the media library.",
    options: {
        filename: { type: "string", arg: "<name>", description: "File name to store (default: from the URL)" },
        alt: { type: "string", arg: "<text>", description: "Alt text" },
    },
    min: 1,
    max: 1,
    examples: ["postargo media import https://example.com/launch.jpg --alt \"Launch banner\""],
    async run(ctx, { values, positionals }) {
        const m = await ctx.api.post("/media/from-url", { url: positionals[0], filename: str(values.filename), alt: str(values.alt) });
        if (ctx.json)
            return printJson(m);
        println(`${c.green("✓")} Imported ${c.bold(m.id)}`);
        println(mediaTable([m]));
    },
};
export const mediaRm = {
    name: "media rm",
    args: "<ids...>",
    summary: "Delete media from the library (posts that already use them keep their copies on the platforms).",
    min: 1,
    async run(ctx, { positionals }) {
        for (const id of positionals)
            await ctx.api.delete(`/media/${encodeURIComponent(id)}`);
        if (ctx.json)
            return printJson({ deleted: positionals });
        println(`${c.green("✓")} Deleted ${positionals.join(", ")}`);
    },
};
export const mediaGc = {
    name: "media gc",
    summary: "Delete files whose posts are all published, N days after the last one went out (default: the instance setting, else 3).",
    description: "Files of draft, scheduled, publishing, needs-check or failed posts are never touched, nor files of posts on platforms that link to " +
        "PostArgo's copy (DEV, Hashnode, Medium, webhooks...). The daily job does the same; this runs it now for the current workspace, " +
        "up to 100 files per call.",
    options: {
        "dry-run": { type: "boolean", description: "Only list what would be deleted" },
        days: { type: "string", arg: "<n>", description: "Days after the last publish (default: the instance's \"Delete after publishing\", else 3)" },
    },
    max: 0,
    examples: ["postargo media gc --dry-run", "postargo media gc --days 7"],
    async run(ctx, { values }) {
        const days = str(values.days);
        const r = await ctx.api.post("/media/gc", { dryRun: !!values["dry-run"], ...(days !== undefined ? { days: Number(days) } : {}) });
        if (ctx.json)
            return printJson(r);
        if (!r.count)
            return println(`Nothing to delete (files published more than ${r.days} days ago, all posts published).`);
        println(table([{ header: "ID" }, { header: "FILENAME", flex: true }, { header: "SIZE", align: "right" }], r.items.map((m) => [m.id, m.filename, fmtBytes(m.size)])));
        println(`${r.dryRun ? "Would delete" : `${c.green("✓")} Deleted`} ${r.count} file${r.count === 1 ? "" : "s"} (${fmtBytes(r.bytes)}).`);
    },
};
export const mediaStatus = {
    name: "media status",
    args: "<file|id>",
    summary: "Was this file published? Exit code 0 when every post using it is published, 2 when not (yet), 3 when PostArgo doesn't know the file.",
    description: "Pass a media id (med_…) or a local file: it is matched by file name and, when the file exists, size. Works after PostArgo removed " +
        "the file from storage too. For jobs that delete their local copy: `postargo media status out/clip.mp4 && rm out/clip.mp4`.",
    min: 1,
    max: 1,
    examples: ["postargo media status out/2026-11-04-short.mp4", "postargo media status med_abc123 --json"],
    async run(ctx, { positionals }) {
        const arg = positionals[0];
        let query;
        if (/^med_[\w-]+$/.test(arg))
            query = { id: arg };
        else {
            const { basename } = await import("node:path");
            const { statSync } = await import("node:fs");
            let size;
            try {
                size = statSync(arg).size;
            }
            catch {
                size = undefined;
            }
            query = { filename: basename(arg), ...(size !== undefined ? { size } : {}) };
        }
        const r = await ctx.api.get("/media/status", query);
        process.exitCode = !r.matches.length ? 3 : r.published ? 0 : 2;
        if (ctx.json)
            return printJson(r);
        if (!r.matches.length)
            return println(`PostArgo doesn't know ${arg}.`);
        for (const m of r.matches) {
            const state = m.published ? c.green("published") : m.posts.length ? c.yellow(`${m.pending} post${m.pending === 1 ? "" : "s"} not published yet`) : c.dim("not used by any post");
            println(`${c.bold(m.id)}  ${m.filename}  ${fmtBytes(m.size)}  ${state}${m.inStorage ? "" : c.dim(`  (removed from storage ${fmtDate(m.deletedAt)}, ${m.deletedReason})`)}`);
            for (const p of m.posts) {
                println(`  ${p.id}  ${p.provider ?? "?"}  ${p.accountName ?? ""}  ${p.status}${p.publishedAt ? `  ${fmtDate(p.publishedAt)}` : p.scheduledAt ? `  ${fmtDate(p.scheduledAt)}` : ""}${p.url ? `  ${p.url}` : ""}`);
            }
        }
    },
};
