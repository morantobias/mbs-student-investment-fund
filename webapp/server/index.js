// Node HTTP server: serves the API and, in production, the built SPA.
// Runs locally (`npm run dev:api` / `npm start`) and on any Node host
// (Render, Railway, Fly, a VPS). Vercel uses api/[...path].ts instead.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./router.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 8787);
const PROD = process.argv.includes("--prod") || process.env.NODE_ENV === "production";
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
    ".map": "application/json",
};
function serveStatic(reqUrl, res) {
    if (!fs.existsSync(DIST))
        return false;
    const pathname = decodeURIComponent(new URL(reqUrl, "http://localhost").pathname);
    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const file = path.join(DIST, rel);
    // Never escape the dist directory.
    if (!file.startsWith(DIST))
        return false;
    const target = fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(DIST, "index.html");
    if (!fs.existsSync(target))
        return false;
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": target.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    });
    fs.createReadStream(target).pipe(res);
    return true;
}
const server = http.createServer(async (req, res) => {
    const url = req.url ?? "/";
    const { pathname, searchParams } = new URL(url, `http://${req.headers.host ?? "localhost"}`);
    if (pathname.startsWith("/api")) {
        try {
            const out = await handleApi(req.method ?? "GET", pathname, searchParams);
            res.writeHead(out.status, { ...out.headers, "access-control-allow-origin": "*" });
            if (out.body === null)
                return res.end();
            res.end(JSON.stringify(out.body));
        }
        catch (err) {
            res.writeHead(500, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
        }
        return;
    }
    if (PROD && serveStatic(url, res))
        return;
    res.writeHead(404, { "content-type": "text/plain" });
    res.end(PROD
        ? "Not found"
        : "API is running. Start the UI with `npm run dev:web` (Vite proxies /api here).");
});
server.listen(PORT, () => {
    console.log(`[mbs-sif] API listening on http://127.0.0.1:${PORT}${PROD ? " (serving dist/)" : ""}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        server.close(() => process.exit(0));
    });
}
