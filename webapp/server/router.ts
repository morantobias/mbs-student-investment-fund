// Framework-agnostic API router. Works behind node:http, Vercel functions and
// any other Node host — no framework dependency.

import { cacheStats, loadBenchmarks, loadCompany, loadSector } from "../src/api/service.js";
import { BENCHMARKS, COMPANIES, FX_PAIRS, SECTOR_INDEX_MAP, SECTORS, FAMILY_LABELS, normaliseTicker } from "../src/core/universe.js";

export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

const json = (body: unknown, status = 200, cacheSeconds = 0): ApiResponse => ({
  status,
  body,
  headers: {
    "content-type": "application/json; charset=utf-8",
    ...(cacheSeconds > 0
      ? { "cache-control": `public, max-age=60, s-maxage=${cacheSeconds}, stale-while-revalidate=300` }
      : { "cache-control": "no-store" }),
  },
});

const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

/**
 * @param method  HTTP method
 * @param path    pathname, e.g. "/api/company"
 * @param query   parsed query string
 */
export async function handleApi(
  method: string,
  path: string,
  query: URLSearchParams,
): Promise<ApiResponse> {
  const route = path.replace(/\/+$/, "") || "/api";

  try {
    if (method === "OPTIONS") return { status: 204, body: null, headers: { "access-control-allow-origin": "*" } };
    if (method !== "GET" && method !== "POST") return fail("Method not allowed", 405);

    switch (route) {
      case "/api/health":
        return json({ ok: true, version: "1.0.0", caches: cacheStats(), time: new Date().toISOString() });

      case "/api/universe":
        return json(
          {
            companies: COMPANIES,
            benchmarks: BENCHMARKS,
            fxPairs: FX_PAIRS,
            sectorIndexMap: SECTOR_INDEX_MAP,
            sectors: SECTORS,
            familyLabels: FAMILY_LABELS,
          },
          200,
          86400,
        );

      case "/api/company": {
        const symbol = query.get("symbol") ?? "";
        if (!symbol.trim()) return fail("Missing ?symbol=");
        const period = query.get("period") ?? "2y";
        const snap = await withTimeout(loadCompany(symbol, period), 90_000, "Company load");
        if (!snap.ok) return json(snap, 200);
        return json(snap, 200, 300);
      }

      case "/api/sector": {
        const sector = query.get("sector");
        if (!sector) return fail("Missing ?sector=");
        const industry = query.get("industry");
        const payload = await withTimeout(loadSector(sector, industry), 120_000, "Sector load");
        return json(payload, 200, 900);
      }

      case "/api/benchmarks": {
        const payload = await withTimeout(loadBenchmarks(), 90_000, "Benchmark load");
        return json(payload, 200, 300);
      }

      case "/api/resolve": {
        const symbol = normaliseTicker(query.get("symbol"));
        if (!symbol) return fail("Missing ?symbol=");
        return json({ symbol }, 200, 86400);
      }

      default:
        return fail(`Unknown endpoint ${route}`, 404);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, 502);
  }
}
