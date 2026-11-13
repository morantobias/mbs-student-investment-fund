import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { MBS, fmtDate, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { rebaseSeries } from "../../core/normalise.js";
import { seriesColours } from "../../core/brand.js";
import { BENCHMARKS, FX_PAIRS, SECTOR_INDEX_MAP } from "../../core/universe.js";
import { useApp } from "../App.js";
import { useBenchmarks } from "../hooks.js";
import { LegendChips, Plot } from "../components/Plot.js";
import { PageHead } from "../components/PageHead.js";
import { Card, DataTable, Empty, ScoreBar, Spinner } from "../components/ui.js";
import { lineFig } from "../charts.js";
const INDEX_LABELS = Object.fromEntries(BENCHMARKS.map((b) => [b.symbol, b.label]));
export function BenchmarksPage() {
    const { snapshot } = useApp();
    const { data, loading, error } = useBenchmarks(true);
    const [active, setActive] = useState(null);
    const [hidden, setHidden] = useState(new Set());
    const [kind, setKind] = useState("all");
    const indexSeries = useMemo(() => {
        if (!data)
            return [];
        const wanted = ["^AXJO", "^GSPC", "^IXIC", "URTH", "EEM", "^VIX"];
        const entries = wanted
            .map((s) => ({ code: INDEX_LABELS[s] ?? s, rows: data.series[s] ?? [] }))
            .filter((e) => e.rows.length > 2);
        const rebased = rebaseSeries(entries, "close");
        const colours = seriesColours(rebased.map((r) => r.code), null, ["S&P/ASX 200"]);
        return rebased.map((r) => ({
            key: r.code,
            label: r.code,
            colour: colours[r.code] ?? MBS.grey2,
            points: r.points.map((p) => ({ x: p.date, y: p.value })),
        }));
    }, [data]);
    const sectorSeries = useMemo(() => {
        if (!data)
            return [];
        const entries = Object.entries(SECTOR_INDEX_MAP)
            .map(([label, sym]) => ({ code: label, rows: data.series[sym] ?? [] }))
            .filter((e) => e.rows.length > 2);
        const rebased = rebaseSeries(entries, "close");
        const subjectSector = snapshot?.info.sector ?? null;
        const colours = seriesColours(rebased.map((r) => r.code), subjectSector, []);
        return rebased.map((r) => ({
            key: r.code,
            label: r.code,
            colour: colours[r.code] ?? MBS.grey2,
            points: r.points.map((p) => ({ x: p.date, y: p.value })),
            width: r.code === subjectSector ? 2.6 : 1.3,
        }));
    }, [data, snapshot?.info.sector]);
    const fxSeries = useMemo(() => {
        if (!data)
            return [];
        const entries = FX_PAIRS.map((f) => ({ code: f.label, rows: data.fx[f.symbol] ?? [] })).filter((e) => e.rows.length > 2);
        const rebased = rebaseSeries(entries, "close");
        const colours = seriesColours(rebased.map((r) => r.code), null, []);
        return rebased.map((r) => ({
            key: r.code,
            label: r.code,
            colour: colours[r.code] ?? MBS.grey2,
            points: r.points.map((p) => ({ x: p.date, y: p.value })),
        }));
    }, [data]);
    if (error) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Benchmarks" }), _jsx(Card, { children: _jsx(Empty, { title: "Could not load benchmarks", message: error }) })] }));
    }
    if (loading && !data) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Benchmarks" }), _jsx(Card, { children: _jsx(Spinner, { label: "Loading indices, rates, commodities and FX\u2026" }) })] }));
    }
    if (!data)
        return null;
    const kinds = ["all", ...new Set(data.board.map((b) => b.kind))];
    const rows = kind === "all" ? data.board : data.board.filter((b) => b.kind === kind);
    const columns = [
        { key: "label", header: "Instrument", align: "left", render: (b) => _jsx("span", { style: { fontWeight: 600 }, children: b.label }) },
        { key: "kind", header: "Type", align: "left", render: (b) => _jsx("span", { className: "small muted", children: b.kind }) },
        { key: "symbol", header: "Symbol", align: "left", render: (b) => _jsx("span", { className: "mono small", children: b.symbol }) },
        { key: "last", header: "Last", render: (b) => fmtPrice(b.price, b.kind === "Rate (%)" ? 2 : 2) },
        { key: "chg", header: "Change", render: (b) => _jsx("span", { className: (b.change ?? 0) >= 0 ? "pos" : "neg", children: fmtPct(b.changePct, 2, true) }) },
        { key: "lo", header: "52w low", render: (b) => fmtPrice(b.week52Low) },
        { key: "hi", header: "52w high", render: (b) => fmtPrice(b.week52High) },
        {
            key: "pos",
            header: "52w position",
            render: (b) => (_jsx("div", { style: { width: 90, display: "inline-block" }, children: _jsx(ScoreBar, { value: b.pos52 }) })),
        },
    ];
    const asOf = data.board[0]?.symbol ? fmtDate(data.loadedAt) : null;
    return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Benchmarks & rates", sub: _jsxs(_Fragment, { children: ["Indices, sector indices, government yields, commodities and FX \u00B7 refreshed ", asOf] }), actions: _jsx("div", { className: "chart-toolbar", children: kinds.map((k) => (_jsx("button", { className: `pill small${kind === k ? " active" : ""}`, onClick: () => setKind(k), children: k === "all" ? "All" : k }, k))) }) }), _jsxs(Card, { title: "Market board", sub: `${rows.length} instruments`, flush: true, children: [_jsx(DataTable, { columns: columns, rows: rows, rowKey: (b) => b.symbol, maxHeight: 430, compact: true }), _jsx("div", { className: "table-note", children: "Delayed quotes. Yield indices are quoted in percent; commodities in USD." })] }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsxs(Card, { title: "Global equity indices", sub: "rebased to 100, 1 year", flush: true, children: [_jsx(LegendChips, { series: indexSeries, active: active, hidden: hidden, onActive: setActive, onToggle: (k) => setHidden((prev) => {
                                    const next = new Set(prev);
                                    next.has(k) ? next.delete(k) : next.add(k);
                                    return next;
                                }) }), _jsx("div", { style: { padding: "0 8px 8px" }, children: _jsx(Plot, { figure: lineFig({ series: indexSeries, active, hidden, fmt: "num", tickFormat: ",.0f" }), height: 300 }) })] }), _jsxs(Card, { title: "ASX sector indices", sub: `${snapshot?.info.sector ?? "sector"} highlighted`, flush: true, children: [_jsx(LegendChips, { series: sectorSeries, active: active === "__sector" ? null : null, hidden: new Set(), onActive: () => { }, onToggle: () => { } }), _jsx("div", { style: { padding: "0 8px 8px" }, children: _jsx(Plot, { figure: lineFig({ series: sectorSeries, active: null, hidden: new Set(), fmt: "num", tickFormat: ",.0f" }), height: 300 }) })] })] }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsx(Card, { title: "Australian dollar", sub: "rebased, 1 year", flush: true, children: _jsx("div", { style: { padding: "8px 8px 4px" }, children: _jsx(Plot, { figure: lineFig({ series: fxSeries, active: null, hidden: new Set(), fmt: "num", tickFormat: ",.0f" }), height: 260 }) }) }), _jsxs(Card, { title: "Risk-free proxy", sub: "US 10-year Treasury yield", flush: true, children: [_jsx("div", { style: { padding: "8px 8px 4px" }, children: _jsx(Plot, { figure: lineFig({
                                        series: [
                                            {
                                                key: "tnx",
                                                label: "US 10y",
                                                colour: MBS.primary,
                                                points: (data.series["^TNX"] ?? []).map((r) => ({ x: r.date, y: r.close })),
                                                width: 2.2,
                                            },
                                        ],
                                        fmt: "num",
                                        tickFormat: ".2f",
                                    }), height: 260 }) }), _jsxs("div", { className: "chart-note", children: ["Used as the anchor for the risk-free rate in the valuation model (", fmtRatio(4.5, 1, "%"), " default)."] })] })] })] }));
}
