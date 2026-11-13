import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { MBS, fmtMoney, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { compositeScores } from "../../core/analytics.js";
import { rebaseSeries } from "../../core/normalise.js";
import { seriesColours as palette } from "../../core/brand.js";
import { useApp } from "../App.js";
import { LegendChips, Plot } from "../components/Plot.js";
import { CompanyStrip, PageHead } from "../components/PageHead.js";
import { Card, DataTable, Empty, ScoreBar, Spinner, Tile, Tiles } from "../components/ui.js";
import { barFig, lineFig, scatterFig } from "../charts.js";
export function PeersPage() {
    const { snapshot, loading } = useApp();
    const [metric, setMetric] = useState("peRatio");
    const [relActive, setRelActive] = useState(null);
    const [relHidden, setRelHidden] = useState(new Set());
    const table = snapshot?.peers?.table ?? [];
    const scored = useMemo(() => compositeScores(table), [table]);
    const relSeries = useMemo(() => {
        if (!snapshot?.peers)
            return [];
        const entries = Object.entries(snapshot.peers.history)
            .map(([symbol, rows]) => ({ code: symbol.replace(/\.AX$/, ""), rows }))
            .filter((e) => e.rows.length > 2);
        const rebased = rebaseSeries(entries, "adjClose");
        const colours = palette(rebased.map((r) => r.code), snapshot.code, []);
        return rebased.map((r) => ({
            key: r.code,
            label: r.code,
            colour: colours[r.code] ?? MBS.grey2,
            points: r.points.map((p) => ({ x: p.date, y: p.value })),
            width: r.code === snapshot.code ? 2.8 : 1.4,
        }));
    }, [snapshot]);
    if (loading && !snapshot) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Peer comparison" }), _jsx(Card, { children: _jsx(Spinner, { label: "Loading peer set\u2026" }) })] }));
    }
    if (!snapshot?.ok) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Peer comparison" }), _jsx(Card, { children: _jsx(Empty, { title: "No company", message: snapshot?.error ?? "Select a company first." }) })] }));
    }
    if (!table.length) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Peer comparison", sub: snapshot.info.name }), _jsx(CompanyStrip, { compact: true }), _jsx(Card, { children: _jsx(Empty, { title: "No peer data", message: "Yahoo Finance did not return statements for this peer set." }) })] }));
    }
    const subject = table.find((r) => r.code === snapshot.code);
    const peersOnly = table.filter((r) => r.code !== snapshot.code);
    const metricLabels = {
        peRatio: "P/E",
        pbRatio: "P/B",
        evEbitda: "EV/EBITDA",
        dividendYield: "Dividend yield",
    };
    const metricFmt = metric === "dividendYield" ? "pct" : "x";
    const barData = [...table]
        .filter((r) => r[metric] !== null)
        .sort((a, b) => (a[metric] ?? 0) - (b[metric] ?? 0));
    const barFig1 = barFig({
        categories: barData.map((r) => r.code),
        series: [
            {
                key: "m",
                label: metricLabels[metric],
                colour: MBS.primary,
                values: barData.map((r) => r[metric] ?? null),
            },
        ],
        fmt: metricFmt,
        horizontal: true,
        textLabels: true,
    });
    // Recolour: subject in magenta, peers in a muted tone, plus a median line.
    const values = barData.map((r) => r[metric] ?? null).filter((v) => v !== null);
    const med = values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : null;
    barFig1.data[0].marker = {
        color: barData.map((r) => (r.code === snapshot.code ? MBS.primary : "rgba(140,140,140,0.55)")),
        line: { width: 0 },
    };
    if (med !== null) {
        Object.assign(barFig1.layout, {
            shapes: [
                {
                    type: "line",
                    xref: "x",
                    yref: "paper",
                    x0: med,
                    x1: med,
                    y0: 0,
                    y1: 1,
                    line: { color: MBS.grey, width: 1, dash: "dot" },
                },
            ],
            annotations: [
                {
                    x: med,
                    y: 1,
                    xref: "x",
                    yref: "paper",
                    text: `Median ${metricFmt === "pct" ? fmtPct(med) : fmtRatio(med)}`,
                    showarrow: false,
                    xanchor: "left",
                    yanchor: "bottom",
                    font: { size: 10, color: MBS.grey },
                },
            ],
        });
    }
    const scatter = scatterFig({
        points: table
            .filter((r) => r.roe !== null && r.pbRatio !== null)
            .map((r) => ({ key: r.code, label: r.name, x: r.roe, y: r.pbRatio, isSubject: r.code === snapshot.code })),
        xLabel: "ROE",
        yLabel: "P/B",
        xFmt: "pct",
        yFmt: "x",
    });
    const scatter2 = scatterFig({
        points: table
            .filter((r) => r.revenueCagr !== null && r.evEbitda !== null)
            .map((r) => ({ key: r.code, label: r.name, x: r.revenueCagr, y: r.evEbitda, isSubject: r.code === snapshot.code })),
        xLabel: "Revenue CAGR",
        yLabel: "EV/EBITDA",
        xFmt: "pct",
        yFmt: "x",
    });
    const columns = [
        {
            key: "code",
            header: "Company",
            align: "left",
            sortValue: (r) => r.code,
            render: (r) => (_jsxs("div", { style: { display: "flex", flexDirection: "column" }, children: [_jsx("span", { className: "mono", style: { fontWeight: 700, color: MBS.dark }, children: r.code }), _jsx("span", { className: "small muted", style: { fontSize: 10.5 }, children: r.name })] })),
        },
        { key: "mcap", header: "Mkt cap", sortValue: (r) => r.marketCap, render: (r) => fmtMoney(r.marketCap) },
        { key: "price", header: "Price", sortValue: (r) => r.price, render: (r) => fmtPrice(r.price) },
        { key: "pe", header: "P/E", sortValue: (r) => r.peRatio, render: (r) => fmtRatio(r.peRatio) },
        { key: "pb", header: "P/B", sortValue: (r) => r.pbRatio, render: (r) => fmtRatio(r.pbRatio) },
        { key: "ev", header: "EV/EBITDA", sortValue: (r) => r.evEbitda, render: (r) => fmtRatio(r.evEbitda) },
        { key: "dy", header: "Div yield", sortValue: (r) => r.dividendYield, render: (r) => fmtPct(r.dividendYield) },
        { key: "roe", header: "ROE", sortValue: (r) => r.roe, render: (r) => fmtPct(r.roe) },
        { key: "nm", header: "Net margin", sortValue: (r) => r.netMargin, render: (r) => fmtPct(r.netMargin) },
        { key: "revcagr", header: "Rev CAGR", sortValue: (r) => r.revenueCagr, render: (r) => fmtPct(r.revenueCagr) },
        { key: "ret", header: "1y return", sortValue: (r) => r.return1y ?? null, render: (r) => _jsx("span", { className: (r.return1y ?? 0) >= 0 ? "pos" : "neg", children: fmtPct(r.return1y) }) },
        {
            key: "score",
            header: "Composite",
            sortValue: (r) => r.scoreTotal ?? null,
            render: (r) => {
                const s = (scored.find((x) => x.code === r.code)?.scoreTotal ?? null);
                return (_jsx("div", { style: { width: 54 }, children: _jsx(ScoreBar, { value: s }) }));
            },
        },
    ];
    const [sort, setSort] = useState({ key: "mcap", dir: "desc" });
    const sorted = useMemo(() => {
        if (!sort)
            return table;
        const col = columns.find((c) => c.key === sort.key);
        if (!col?.sortValue)
            return table;
        const copy = [...table];
        copy.sort((a, b) => {
            const va = col.sortValue(a);
            const vb = col.sortValue(b);
            if (va === null)
                return 1;
            if (vb === null)
                return -1;
            if (typeof va === "number" && typeof vb === "number")
                return sort.dir === "asc" ? va - vb : vb - va;
            return sort.dir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
        // Keep the subject pinned to the top.
        const idx = copy.findIndex((r) => r.code === snapshot.code);
        if (idx > 0)
            copy.unshift(copy.splice(idx, 1)[0]);
        return copy;
    }, [table, sort, snapshot.code, columns]);
    const medians = (key) => {
        const vals = peersOnly.map((r) => r[key]).filter((v) => v !== null);
        if (!vals.length)
            return null;
        const sortedVals = [...vals].sort((a, b) => a - b);
        const mid = Math.floor(sortedVals.length / 2);
        return sortedVals.length % 2 ? sortedVals[mid] : (sortedVals[mid - 1] + sortedVals[mid]) / 2;
    };
    return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Peer comparison", sub: `${snapshot.info.industry} · ${table.length} companies · subject highlighted` }), _jsx(CompanyStrip, { compact: true }), _jsxs(Tiles, { children: [_jsx(Tile, { label: "Peer median P/E", value: fmtRatio(medians("peRatio")), note: `subject ${fmtRatio(subject?.peRatio ?? null)}`, accent: true }), _jsx(Tile, { label: "Peer median P/B", value: fmtRatio(medians("pbRatio")), note: `subject ${fmtRatio(subject?.pbRatio ?? null)}` }), _jsx(Tile, { label: "Peer median EV/EBITDA", value: fmtRatio(medians("evEbitda")), note: `subject ${fmtRatio(subject?.evEbitda ?? null)}` }), _jsx(Tile, { label: "Peer median yield", value: fmtPct(medians("dividendYield")), note: `subject ${fmtPct(subject?.dividendYield ?? null)}` }), _jsx(Tile, { label: "Peer median ROE", value: fmtPct(medians("roe")), note: `subject ${fmtPct(subject?.roe ?? null)}` }), _jsx(Tile, { label: "Relative 1y", value: fmtPct(subject?.return1y !== null && subject?.return1y !== undefined && medians("return1y") !== null ? subject.return1y - medians("return1y") : null), note: "subject less peer median", tone: subject?.return1y !== null && subject?.return1y !== undefined && medians("return1y") !== null && subject.return1y - medians("return1y") >= 0
                            ? "pos"
                            : "neg" })] }), _jsx(Card, { title: "Peer set", sub: "click headers to sort", flush: true, className: "card", children: _jsx(DataTable, { columns: columns, rows: sorted, rowKey: (r) => r.ticker, rowClass: (r) => (r.code === snapshot.code ? "subject" : ""), maxHeight: 520, sort: sort, onSort: (key) => setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" })), note: "Composite score is an equal-weighted percentile blend of quality, value, growth and momentum within this peer set." }) }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsx(Card, { title: metricLabels[metric], sub: `${barData.length} companies · subject vs peers`, flush: true, actions: _jsx("div", { className: "chart-toolbar", children: ["peRatio", "pbRatio", "evEbitda", "dividendYield"].map((k) => (_jsx("button", { className: `pill small${metric === k ? " active" : ""}`, onClick: () => setMetric(k), children: metricLabels[k] }, k))) }), children: _jsx("div", { style: { padding: "8px 6px 4px" }, children: _jsx(Plot, { figure: barFig1, height: Math.max(220, barData.length * 26) }) }) }), _jsxs(Card, { title: "Relative performance", sub: "rebased to 100, 1 year", flush: true, children: [_jsx(LegendChips, { series: relSeries, active: relActive, hidden: relHidden, onActive: setRelActive, onToggle: (k) => setRelHidden((prev) => {
                                    const next = new Set(prev);
                                    next.has(k) ? next.delete(k) : next.add(k);
                                    return next;
                                }) }), _jsx("div", { style: { padding: "0 8px 6px" }, children: _jsx(Plot, { figure: lineFig({ series: relSeries, active: relActive, hidden: relHidden, fmt: "num", tickFormat: ",.0f" }), height: 300 }) })] })] }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsx(Card, { title: "ROE vs P/B", sub: "quality against price", flush: true, children: _jsx("div", { style: { padding: "8px 6px" }, children: _jsx(Plot, { figure: scatter, height: 268 }) }) }), _jsx(Card, { title: "Growth vs EV/EBITDA", sub: "growth against multiple", flush: true, children: _jsx("div", { style: { padding: "8px 6px" }, children: _jsx(Plot, { figure: scatter2, height: 268 }) }) })] })] }));
}
