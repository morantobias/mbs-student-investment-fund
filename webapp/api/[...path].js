// Vercel serverless entry point. One catch-all function handles every /api/*
// route via the same router the Node server uses.
import { handleApi } from "../server/router.js";
export default async function handler(req, res) {
    const url = new URL(req.url ?? "/", `http://${req.headers?.host ?? "localhost"}`);
    const out = await handleApi(req.method ?? "GET", url.pathname, url.searchParams);
    res.statusCode = out.status;
    for (const [k, v] of Object.entries(out.headers ?? {}))
        res.setHeader(k, v);
    res.setHeader("access-control-allow-origin", "*");
    res.end(out.body === null ? "" : JSON.stringify(out.body));
}
export const config = { maxDuration: 120 };
