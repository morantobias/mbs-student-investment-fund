const inflight = new Map();
const cache = new Map();
async function getJson(url, ttlMs = 0) {
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now())
        return hit.value;
    const pending = inflight.get(url);
    if (pending)
        return pending;
    const promise = fetch(url, { headers: { Accept: "application/json" } })
        .then(async (res) => {
        const body = await res.json();
        if (!res.ok && body?.error)
            throw new Error(body.error);
        if (ttlMs > 0)
            cache.set(url, { value: body, expires: Date.now() + ttlMs });
        return body;
    })
        .finally(() => inflight.delete(url));
    inflight.set(url, promise);
    return promise;
}
export const getCompany = (symbol, period) => getJson(`/api/company?symbol=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}`, 5 * 60_000);
export const getBenchmarks = () => getJson("/api/benchmarks", 5 * 60_000);
export const getSector = (sector, industry) => getJson(`/api/sector?sector=${encodeURIComponent(sector)}${industry ? `&industry=${encodeURIComponent(industry)}` : ""}`, 10 * 60_000);
export const getUniverse = () => getJson("/api/universe", 24 * 60 * 60_000);
export function clearClientCache() {
    cache.clear();
}
