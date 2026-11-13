// Orchestration: turn Yahoo payloads into the JSON the client renders.
// Mirrors app/R/data.R::load_company / load_peer_set / load_benchmark_board.
import { HOUR, MINUTE, TtlCache } from "./cache.js";
import { mapLimit, yahooChart, yahooNews, yahooQuote, yahooStatements } from "./yahoo.js";
import { buildFin, computeTechnicals, inferDividends, latestSnapshot, performanceTable, priceMetrics, tidyStatement, } from "../core/normalise.js";
import { BENCHMARKS, FX_PAIRS, SECTOR_INDEX_MAP, codeFromSymbol, industryCodes, lookupCompany, normaliseTicker, sectorCodes, } from "../core/universe.js";
const chartCache = new TtlCache(HOUR * 2);
const statementCache = new TtlCache(HOUR * 12);
const quoteCache = new TtlCache(MINUTE * 5);
const newsCache = new TtlCache(MINUTE * 30);
const snapshotCache = new TtlCache(MINUTE * 10);
const sectorCache = new TtlCache(MINUTE * 20);
const boardCache = new TtlCache(MINUTE * 10);
const chart = (symbol, range) => chartCache.wrap(`${symbol}:${range}`, () => yahooChart(symbol, range));
const statements = (symbol) => statementCache.wrap(symbol, () => yahooStatements(symbol));
const quote = (symbol) => quoteCache.wrap(symbol, () => yahooQuote(symbol));
const news = (symbol) => newsCache.wrap(symbol, () => yahooNews(symbol));
function emptyQuote(symbol) {
    return {
        symbol,
        price: null,
        previousClose: null,
        change: null,
        changePct: null,
        week52High: null,
        week52Low: null,
        volume: null,
        currency: null,
    };
}
/** Ratios for one symbol — the unit of work behind both companies and peers. */
async function ratiosFor(symbol, period = "1y") {
    const [st, q, px] = await Promise.all([
        statements(symbol).catch(() => null),
        quote(symbol).catch(() => null),
        chart(symbol, period).catch(() => null),
    ]);
    if (!st || !q || q.price === null)
        return null;
    const set = {
        income: tidyStatement(st.income),
        balance: tidyStatement(st.balance),
        cashflow: tidyStatement(st.cashflow),
    };
    const fin = buildFin(set);
    if (!fin)
        return null;
    const history = px?.rows ?? [];
    const ratios = latestSnapshot(symbol, fin, q, inferDividends(history), lookupCompany(symbol));
    if (!ratios)
        return null;
    ratios.return1y = history.length > 2 ? history[history.length - 1].adjClose / history[0].adjClose - 1 : null;
    ratios.week52High = q.week52High;
    ratios.week52Low = q.week52Low;
    ratios.changePct = q.changePct;
    return { ratios, history };
}
export async function loadCompany(rawSymbol, period = "2y") {
    const symbol = normaliseTicker(rawSymbol);
    return snapshotCache.wrap(`${symbol}:${period}`, async () => {
        const info = lookupCompany(symbol);
        const sectorIdx = info.sector ? (SECTOR_INDEX_MAP[info.sector] ?? null) : null;
        const [chartRes, q, st, nw] = await Promise.all([
            chart(symbol, period).catch((e) => ({ error: e })),
            quote(symbol).catch(() => null),
            statements(symbol).catch(() => null),
            news(symbol).catch(() => []),
        ]);
        if ("error" in chartRes || !q || q.price === null) {
            return failureSnapshot(symbol, info, period, "Yahoo Finance returned no quote — check the ticker (ASX codes need the .AX suffix).");
        }
        const rows = chartRes.rows;
        if (rows.length < 2) {
            return failureSnapshot(symbol, info, period, "Yahoo Finance returned no usable price history for this ticker.");
        }
        const set = st
            ? {
                income: tidyStatement(st.income),
                balance: tidyStatement(st.balance),
                cashflow: tidyStatement(st.cashflow),
            }
            : { income: [], balance: [], cashflow: [] };
        const fin = buildFin(set);
        if (!fin) {
            return failureSnapshot(symbol, info, period, "No financial statements are available for this ticker.");
        }
        const [benchRes, sectorRes] = await Promise.all([
            chart("^AXJO", period).catch(() => null),
            sectorIdx ? chart(sectorIdx, period).catch(() => null) : Promise.resolve(null),
        ]);
        const dividends = inferDividends(rows);
        const ratios = latestSnapshot(symbol, fin, q, dividends, info);
        const metrics = priceMetrics(rows, benchRes?.rows ?? null);
        const perf = performanceTable(rows, benchRes?.rows ?? null);
        const tech = computeTechnicals(rows);
        // Peers load in the background of the same request so the client gets a
        // complete payload; failures degrade to an empty peer set.
        let peers = null;
        try {
            peers = await loadPeerSet(info.peers, symbol, "1y");
        }
        catch {
            peers = null;
        }
        return {
            ok: true,
            symbol,
            code: info.code,
            info: { ...info, name: chartRes.meta.longName ?? info.name },
            quote: q,
            meta: {
                exchange: chartRes.meta.exchange,
                fullExchangeName: chartRes.meta.fullExchangeName,
                timezone: chartRes.meta.timezone,
                longName: chartRes.meta.longName,
                website: null,
                summary: null,
                employees: null,
            },
            fin,
            ratios,
            history: rows,
            bench: benchRes?.rows ?? [],
            sectorPx: sectorRes?.rows ?? [],
            sectorIndex: sectorIdx,
            dividends,
            metrics,
            perf,
            tech,
            peers,
            news: nw,
            period,
            loadedAt: new Date().toISOString(),
        };
    });
}
function failureSnapshot(symbol, info, period, message) {
    const q = emptyQuote(symbol);
    return {
        ok: false,
        symbol,
        code: codeFromSymbol(symbol),
        info,
        quote: q,
        meta: { exchange: null, fullExchangeName: null, timezone: null, longName: null, website: null, summary: null, employees: null },
        fin: [],
        ratios: {},
        history: [],
        bench: [],
        sectorPx: [],
        sectorIndex: null,
        dividends: [],
        metrics: null,
        perf: [],
        tech: null,
        peers: null,
        news: [],
        period,
        loadedAt: new Date().toISOString(),
        error: message,
    };
}
export async function loadPeerSet(codes, include, period = "1y") {
    const symbols = [...new Set([include, ...codes].filter(Boolean).map((c) => normaliseTicker(c)))];
    if (!symbols.length)
        return null;
    const results = await mapLimit(symbols, 6, async (s) => {
        try {
            return await ratiosFor(s, period);
        }
        catch {
            return null;
        }
    });
    const table = [];
    const history = {};
    results.forEach((r, i) => {
        if (!r)
            return;
        table.push(r.ratios);
        history[symbols[i]] = r.history;
    });
    if (!table.length)
        return null;
    // The subject first, then by market cap.
    table.sort((a, b) => {
        if (a.ticker === include)
            return -1;
        if (b.ticker === include)
            return 1;
        return (b.marketCap ?? 0) - (a.marketCap ?? 0);
    });
    return { table, symbols, history };
}
export async function loadBenchmarks() {
    return boardCache.wrap("board", async () => {
        const symbols = [...BENCHMARKS.map((b) => b.symbol), ...FX_PAIRS.map((f) => f.symbol)];
        const quotes = await mapLimit(symbols, 6, async (s) => {
            try {
                return await quote(s);
            }
            catch {
                return null;
            }
        });
        const board = [];
        quotes.forEach((q, i) => {
            if (!q || q.price === null)
                return;
            const symbol = symbols[i];
            const bench = BENCHMARKS.find((b) => b.symbol === symbol);
            const fx = FX_PAIRS.find((f) => f.symbol === symbol);
            const hi = q.week52High;
            const lo = q.week52Low;
            board.push({
                ...q,
                label: bench?.label ?? fx?.label ?? symbol,
                kind: bench?.kind ?? "FX",
                pos52: hi !== null && lo !== null && hi > lo && q.price !== null ? (q.price - lo) / (hi - lo) : null,
            });
        });
        // Index and FX series for the charts (rebased client-side).
        const indexSymbols = ["^AXJO", "^GSPC", "^IXIC", "URTH", "EEM", "^VIX", "^TNX"];
        const seriesEntries = await mapLimit(indexSymbols, 5, async (s) => {
            try {
                const r = await chart(s, "1y");
                return [s, r.rows];
            }
            catch {
                return [s, []];
            }
        });
        const sectorEntries = await mapLimit(Object.entries(SECTOR_INDEX_MAP), 5, async ([, sym]) => {
            try {
                const r = await chart(sym, "1y");
                return [sym, r.rows];
            }
            catch {
                return [sym, []];
            }
        });
        const fxEntries = await mapLimit(FX_PAIRS.map((f) => f.symbol), 4, async (s) => {
            try {
                const r = await chart(s, "1y");
                return [s, r.rows];
            }
            catch {
                return [s, []];
            }
        });
        return {
            board,
            series: Object.fromEntries([...seriesEntries, ...sectorEntries]),
            fx: Object.fromEntries(fxEntries),
            loadedAt: new Date().toISOString(),
        };
    });
}
export async function loadSector(sector, industry) {
    const key = `${sector}:${industry ?? ""}`;
    return sectorCache.wrap(key, async () => {
        const codes = industry ? industryCodes(industry) : sectorCodes(sector);
        const symbols = codes.map((c) => normaliseTicker(c));
        const results = await mapLimit(symbols, 6, async (s) => {
            try {
                return await ratiosFor(s, "1y");
            }
            catch {
                return null;
            }
        });
        const table = [];
        const history = {};
        results.forEach((r, i) => {
            if (!r)
                return;
            table.push(r.ratios);
            history[symbols[i]] = r.history;
        });
        table.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
        const indexSymbol = SECTOR_INDEX_MAP[sector] ?? null;
        let index = [];
        if (indexSymbol) {
            try {
                index = (await chart(indexSymbol, "1y")).rows;
            }
            catch {
                index = [];
            }
        }
        return { sector, indexSymbol, index, table, loadedAt: new Date().toISOString() };
    });
}
/** Cached technicals for one symbol (used by the watchlist sparklines). */
export async function loadSeries(symbol, period = "1y") {
    try {
        return (await chart(normaliseTicker(symbol), period)).rows;
    }
    catch {
        return [];
    }
}
export function cacheStats() {
    return {
        charts: chartCache.size,
        statements: statementCache.size,
        quotes: quoteCache.size,
        snapshots: snapshotCache.size,
        sectors: sectorCache.size,
    };
}
