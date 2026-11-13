import type { BenchmarksPayload, CompanySnapshot, SectorPayload, Universe } from "../core/types.js";

const inflight = new Map<string, Promise<unknown>>();
const cache = new Map<string, { value: unknown; expires: number }>();

async function getJson<T>(url: string, ttlMs = 0): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const promise = fetch(url, { headers: { Accept: "application/json" } })
    .then(async (res) => {
      const body = await res.json();
      if (!res.ok && body?.error) throw new Error(body.error);
      if (ttlMs > 0) cache.set(url, { value: body, expires: Date.now() + ttlMs });
      return body as T;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, promise);
  return promise;
}

export const getCompany = (symbol: string, period: string) =>
  getJson<CompanySnapshot>(`/api/company?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}`, 5 * 60_000);

export const getBenchmarks = () => getJson<BenchmarksPayload>("/api/benchmarks", 5 * 60_000);

export const getSector = (sector: string, industry?: string | null) =>
  getJson<SectorPayload>(
    `/api/sector?sector=${encodeURIComponent(sector)}${industry ? `&industry=${encodeURIComponent(industry)}` : ""}`,
    10 * 60_000,
  );

export const getUniverse = () => getJson<Universe>("/api/universe", 24 * 60 * 60_000);

export function clearClientCache() {
  cache.clear();
}
