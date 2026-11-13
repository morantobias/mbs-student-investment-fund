import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { MBS, fmtMoney, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { compositeScores, screenTable } from "../../core/analytics.js";
import { rebaseSeries } from "../../core/normalise.js";
import { SECTORS } from "../../core/universe.js";
import { useApp } from "../App.js";
import { useSector } from "../hooks.js";
import { LegendChips, Plot } from "../components/Plot.js";
import { PageHead } from "../components/PageHead.js";
import { Card, DataTable, Empty, ScoreBar, Spinner, Tile, Tiles } from "../components/ui.js";
import { barFig, lineFig, scatterFig } from "../charts.js";
export function SectorPage() {
    const { snapshot, navigate, setSymbol } = useApp();
    const [sector, setSector] = useState(snapshot?.info.sector && sectorName(snapshot.info.sector) ? snapshot.info.sector : "Financials");
    const [maxPe, setMaxPe] = useState("");
    const [maxPb, setMaxPb] = useState("");
    const [minYield, setMinYield] = useState("");
    const [minRoe, setMinRoe] = useState("");
    const [minMcap, setMinMcap] = useState("");
    const [sort, setSort] = useState({ key: "marketCap", dir: "desc" });
    const [active, setActive] = useState(null);
    const { data, loading, error } = useSector(sector, null, true);
    useEffect(() => {
        if (snapshot?.ok && snapshot.info.sector && sectorName(snapshot.info.sector))
            setSector(snapshot.info.sector);
    }, [snapshot?.info.sector]);
    const filtered = useMemo(() => {
        if (!data)
            return [];
        return screenTable(data.table, {
            peRatio: maxPe === "" ? null : [0, Number(maxPe)],
            pbRatio: maxPb === "" ? null : [0, Number(maxPb)],
            dividendYield: minYield === "" ? null : [Number(minYield) / 100, 1],
            roe: minRoe === "" ? null : [Number(minRoe) / 100, 5],
            marketCap: minMcap === "" ? null : [Number(minMcap) * 1e9, 1e15],
        });
    }, [data, maxPe, maxPb, minYield, minRoe, minMcap]);
    const scored = useMemo(() => compositeScores(filtered), [filtered]);
    const sorted = useMemo(() => {
        if (!sort)
            return scored;
        const dir = sort.dir === "asc" ? 1 : -1;
        return [...scored].sort((a, b) => {
            const va = a[sort.key];
            const vb = b[sort.key];
            if (va === null || va === undefined)
                return 1;
            if (vb === null || vb === undefined)
                return -1;
            return (va - vb) * dir;
        });
    }, [scored, sort]);
    const indexSeries = useMemo(() => {
        if (!data?.index?.length)
            return [];
        const rebased = rebaseSeries([{ code: `${sector} index`, rows: data.index }], "close");
        return rebased.map((r) => ({
            key: r.code,
            label: data.indexSymbol ?? r.code,
            colour: MBS.primary,
            points: r.points.map((p) => ({ x: p.date, y: p.value })),
        }));
    }, [data, sector]);
    const columns = [
        {
            key: "code",
            header: "Company",
            align: "left",
            sortValue: (r) => r.code,
            render: (r) => (_jsx("button", { className: "mono", style: { background: "none", border: 0, padding: 0, fontWeight: 700, color: MBS.primary, cursor: "pointer" }, onClick: () => {
                    setSymbol(r.ticker);
                    navigate("overview");
                }, title: `Open ${r.name}`, children: r.code })),
        },
        { key: "name", header: "Name", align: "left", sortValue: (r) => r.name, render: (r) => _jsx("span", { className: "small", children: shortName(r.name) }), width: "220px" },
        { key: "marketCap", header: "Mkt cap", sortValue: (r) => r.marketCap, render: (r) => fmtMoney(r.marketCap) },
        { key: "price", header: "Price", sortValue: (r) => r.price, render: (r) => fmtPrice(r.price) },
        { key: "peRatio", header: "P/E", sortValue: (r) => r.peRatio, render: (r) => fmtRatio(r.peRatio) },
        { key: "pbRatio", header: "P/B", sortValue: (r) => r.pbRatio, render: (r) => fmtRatio(r.pbRatio) },
        { key: "evEbitda", header: "EV/EBITDA", sortValue: (r) => r.evEbitda, render: (r) => fmtRatio(r.evEbitda) },
        { key: "dividendYield", header: "Yield", sortValue: (r) => r.dividendYield, render: (r) => fmtPct(r.dividendYield) },
        { key: "roe", header: "ROE", sortValue: (r) => r.roe, render: (r) => fmtPct(r.roe) },
        { key: "netMargin", header: "Net margin", sortValue: (r) => r.netMargin, render: (r) => fmtPct(r.netMargin) },
        { key: "revenueCagr", header: "Rev CAGR", sortValue: (r) => r.revenueCagr, render: (r) => fmtPct(r.revenueCagr) },
        {
            key: "return1y",
            header: "1y",
            sortValue: (r) => r.return1y ?? null,
            render: (r) => _jsx("span", { className: (r.return1y ?? 0) >= 0 ? "pos" : "neg", children: fmtPct(r.return1y) }),
        },
        {
            key: "scoreTotal",
            header: "Score",
            sortValue: (r) => r.scoreTotal,
            render: (r) => (_jsx("div", { style: { width: 46 }, children: _jsx(ScoreBar, { value: r.scoreTotal }) })),
        },
    ];
    const scatter = data
        ? scatterFig({
            points: data.table
                .filter((r) => r.roe !== null && r.pbRatio !== null)
                .map((r) => ({
                key: r.code,
                label: r.name,
                x: r.roe,
                y: r.pbRatio,
                isSubject: r.code === snapshot?.code,
            })),
            xLabel: "ROE",
            yLabel: "P/B",
            xFmt: "pct",
            yFmt: "x",
        })
        : null;
    const mcapBars = data
        ? (() => {
            const rows = [...data.table].filter((r) => r.marketCap !== null).slice(0, 15);
            const fig = barFig({
                categories: rows.map((r) => r.code),
                series: [{ key: "mc", label: "Market cap", colour: MBS.primary, values: rows.map((r) => (r.marketCap === null ? null : r.marketCap / 1e9)) }],
                fmt: "num",
                horizontal: true,
                textLabels: true,
            });
            fig.data[0].marker = {
                color: rows.map((r) => (r.code === snapshot?.code ? MBS.primary : "rgba(163,0,70,0.32)")),
            };
            fig.data[0].hovertemplate = "$%{x:,.1f}bn<extra></extra>";
            return fig;
        })()
        : null;
    const returnBars = data
        ? (() => {
            const rows = [...data.table].filter((r) => r.return1y !== null).sort((a, b) => (b.return1y ?? 0) - (a.return1y ?? 0));
            return barFig({
                categories: rows.map((r) => r.code),
                series: [{ key: "r", label: "1y return", colour: MBS.primary, values: rows.map((r) => r.return1y ?? null) }],
                fmt: "pct",
                horizontal: true,
            });
        })()
        : null;
    return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Sector & screener", sub: `Cross-sectional view of the ${sector} sector · ${data?.table.length ?? 0} companies with data`, actions: _jsx("select", { value: sector, onChange: (e) => setSector(e.target.value), style: { height: 32, padding: "0 10px", border: "1px solid var(--mbs-border)", borderRadius: 7, background: "#fff", fontSize: 12.5 }, children: SECTORS.map((s) => (_jsx("option", { value: s, children: s }, s))) }) }), error && _jsx(Card, { children: _jsx(Empty, { title: "Sector data unavailable", message: error }) }), loading && !data && _jsx(Card, { children: _jsx(Spinner, { label: `Loading ${sector} peers from Yahoo Finance — this can take a few seconds…` }) }), data && (_jsxs(_Fragment, { children: [_jsxs(Tiles, { children: [_jsx(Tile, { label: "Companies", value: filtered.length, note: `of ${data.table.length} in sector`, accent: true }), _jsx(Tile, { label: "Median P/E", value: fmtRatio(medianOf(filtered, "peRatio")), note: "positive multiples only" }), _jsx(Tile, { label: "Median P/B", value: fmtRatio(medianOf(filtered, "pbRatio")) }), _jsx(Tile, { label: "Median yield", value: fmtPct(medianOf(filtered, "dividendYield")) }), _jsx(Tile, { label: "Median ROE", value: fmtPct(medianOf(filtered, "roe")) }), _jsx(Tile, { label: "Sector index", value: data.indexSymbol ?? "–", note: `${data.index.length} sessions`, small: true })] }), _jsx(Card, { title: "Screen", sub: "leave a field blank to ignore it", className: "", children: _jsxs("div", { className: "row wrap", style: { gap: 12, alignItems: "flex-end" }, children: [_jsx(FilterField, { label: "Max P/E", value: maxPe, onChange: setMaxPe, suffix: "x" }), _jsx(FilterField, { label: "Max P/B", value: maxPb, onChange: setMaxPb, suffix: "x" }), _jsx(FilterField, { label: "Min yield", value: minYield, onChange: setMinYield, suffix: "%" }), _jsx(FilterField, { label: "Min ROE", value: minRoe, onChange: setMinRoe, suffix: "%" }), _jsx(FilterField, { label: "Min market cap", value: minMcap, onChange: setMinMcap, suffix: "$bn" }), _jsx("button", { className: "pill", onClick: () => {
                                        setMaxPe("");
                                        setMaxPb("");
                                        setMinYield("");
                                        setMinRoe("");
                                        setMinMcap("");
                                    }, children: "Clear" }), _jsx("span", { className: "spacer" }), _jsxs("span", { className: "small muted", children: [sorted.length, " matches"] })] }) }), _jsx(Card, { title: `${sector} companies`, sub: "click a code to open it", flush: true, children: _jsx(DataTable, { columns: columns, rows: sorted, rowKey: (r) => r.ticker, rowClass: (r) => (r.code === snapshot?.code ? "subject" : ""), maxHeight: 520, sort: sort, onSort: (key) => setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" })) }) }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsx(Card, { title: "ROE vs P/B", sub: "sector quality-price map", flush: true, children: _jsx("div", { style: { padding: "8px 6px" }, children: scatter && _jsx(Plot, { figure: scatter, height: 300 }) }) }), _jsxs(Card, { title: `${sector} index`, sub: data.indexSymbol ?? "sector benchmark", flush: true, children: [_jsx(LegendChips, { series: indexSeries, active: active, hidden: new Set(), onActive: setActive, onToggle: () => { } }), _jsx("div", { style: { padding: "0 8px 6px" }, children: indexSeries.length ? (_jsx(Plot, { figure: lineFig({ series: indexSeries, active, hidden: new Set(), fmt: "num", tickFormat: ",.0f" }), height: 286 })) : (_jsx(Empty, { title: "No index series", message: `No price history returned for ${data.indexSymbol ?? "the sector index"}.` })) })] })] }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsx(Card, { title: "Market capitalisation", sub: "top 15 by size, $ billion", flush: true, children: _jsx("div", { style: { padding: "8px 6px" }, children: mcapBars && _jsx(Plot, { figure: mcapBars, height: Math.max(260, (mcapBars.data.length ?? 1) * 20 + 200) }) }) }), _jsx(Card, { title: "One-year total return", sub: "all companies with history", flush: true, children: _jsx("div", { style: { padding: "8px 6px" }, children: returnBars && _jsx(Plot, { figure: returnBars, height: Math.max(260, sorted.length * 18) }) }) })] })] }))] }));
}
function sectorName(sector) {
    return SECTORS.includes(sector);
}
function shortName(name) {
    return name.length > 30 ? `${name.slice(0, 29)}…` : name;
}
function medianOf(rows, key) {
    const vals = rows
        .map((r) => r[key])
        .filter((v) => v !== null && Number.isFinite(v) && v > 0)
        .sort((a, b) => a - b);
    if (!vals.length)
        return null;
    const mid = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}
function FilterField({ label, value, onChange, suffix, }) {
    return (_jsxs("div", { className: "field", style: { width: 130 }, children: [_jsx("label", { children: label }), _jsxs("div", { style: { position: "relative" }, children: [_jsx("input", { type: "number", value: value, placeholder: "any", onChange: (e) => onChange(e.target.value === "" ? "" : Number(e.target.value)), style: { paddingRight: suffix ? 34 : 9 } }), suffix && (_jsx("span", { className: "muted small", style: { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }, children: suffix }))] })] }));
}
