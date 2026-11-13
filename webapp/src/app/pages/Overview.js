import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { fmtDate, fmtPct, fmtPrice, fmtRatio, fmtMoney, fmtInt, MBS } from "../../core/brand.js";
import { footballField } from "../../core/valuation.js";
import { useApp } from "../App.js";
import { LegendChips, Plot } from "../components/Plot.js";
import { CompanyStrip, PageHead, Pct } from "../components/PageHead.js";
import { Card, DataTable, Empty, KeyValues, RecBadge, Spinner, Tile, Tiles } from "../components/ui.js";
import { lineFig, barFig, footballFig } from "../charts.js";
export function OverviewPage() {
    const { snapshot, loading, valuation, navigate } = useApp();
    const [active, setActive] = useState(null);
    const [hidden, setHidden] = useState(new Set());
    const priceSeries = useMemo(() => [
        { key: "close", label: "Close", colour: MBS.primary },
        { key: "sma50", label: "SMA 50", colour: "#eda100" },
        { key: "sma200", label: "SMA 200", colour: "#2a78d6" },
    ], []);
    if (loading && !snapshot) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Overview", sub: "Loading company\u2026" }), _jsx(Card, { children: _jsx(Spinner, { label: "Pulling quote, statements and peers from Yahoo Finance\u2026" }) })] }));
    }
    if (!snapshot?.ok) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Overview" }), _jsx(Card, { children: _jsx(Empty, { title: "No company loaded", message: snapshot?.error ?? "Search an ASX code above to begin." }) })] }));
    }
    const { ratios: r, tech, perf, info } = snapshot;
    const v = valuation?.valuation;
    const latest = tech?.latest;
    const priceFig = lineFig({
        series: [
            {
                key: "close",
                label: "Close",
                colour: MBS.primary,
                points: (tech?.series ?? []).map((d) => ({ x: d.date, y: d.close })),
                width: 2.2,
            },
            {
                key: "sma50",
                label: "SMA 50",
                colour: "#eda100",
                points: (tech?.series ?? []).map((d) => ({ x: d.date, y: d.sma50 })),
                width: 1.3,
            },
            {
                key: "sma200",
                label: "SMA 200",
                colour: "#2a78d6",
                points: (tech?.series ?? []).map((d) => ({ x: d.date, y: d.sma200 })),
                width: 1.3,
            },
        ],
        active,
        hidden,
        fmt: "price",
        tickFormat: "$,.0f",
    });
    const ff = v ? footballField(snapshot.quote, v, valuation?.scenarios, undefined) : [];
    const revenue = snapshot.fin.map((f) => f.revenue);
    const netIncome = snapshot.fin.map((f) => f.net_income);
    const finFig = barFig({
        categories: snapshot.fin.map((f) => f.label),
        series: [
            { key: "rev", label: "Revenue", colour: "#2a78d6", values: revenue.map((x) => (x === null ? null : x / 1e6)) },
            { key: "ni", label: "Net income", colour: MBS.primary, values: netIncome.map((x) => (x === null ? null : x / 1e6)) },
        ],
        fmt: "money",
        yTitle: "$ million",
    });
    const perfCols = [
        { key: "period", header: "Period", align: "left", render: (row) => row.period },
        { key: "stock", header: info.code, render: (row) => _jsx(Pct, { value: row.stock }) },
        { key: "bench", header: "ASX 200", render: (row) => _jsx(Pct, { value: row.benchmark }) },
        { key: "rel", header: "Relative", render: (row) => _jsx(Pct, { value: row.relative }) },
    ];
    return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Company overview", sub: _jsxs(_Fragment, { children: [info.name, " \u00B7 ", info.industry, " \u00B7 last price ", fmtDate(snapshot.quote.symbol ? snapshot.metrics?.lastDate : null)] }), actions: _jsx("button", { className: "pill", onClick: () => navigate("valuation"), children: "Open valuation \u2192" }) }), _jsx(CompanyStrip, {}), _jsxs(Tiles, { children: [_jsx(Tile, { label: "Market cap", value: fmtMoney(r.marketCap), note: `EV ${fmtMoney(r.enterpriseValue)}`, accent: true }), _jsx(Tile, { label: "P/E", value: fmtRatio(r.peRatio), note: r.eps !== null ? `EPS ${fmtPrice(r.eps)}` : undefined }), _jsx(Tile, { label: "P/B", value: fmtRatio(r.pbRatio), note: r.bvps !== null ? `BVPS ${fmtPrice(r.bvps)}` : undefined }), _jsx(Tile, { label: "Dividend yield", value: fmtPct(r.dividendYield), note: r.grossedYield !== null ? `${fmtPct(r.grossedYield)} franked` : undefined }), _jsx(Tile, { label: "ROE", value: fmtPct(r.roe), note: r.roePrior !== null ? `prior ${fmtPct(r.roePrior)}` : undefined, tone: r.roe !== null && r.roePrior !== null ? (r.roe >= r.roePrior ? "pos" : "neg") : undefined }), _jsx(Tile, { label: v?.isFinancial ? "Equity / assets" : "Net debt / EBITDA", value: v?.isFinancial ? fmtPct(r.equityAssets) : fmtRatio(r.netDebtEbitda), note: v?.isFinancial ? `leverage ${fmtRatio(r.leverage)}` : `cover ${fmtRatio(r.interestCoverage)}` }), _jsx(Tile, { label: "52-week position", value: latest?.pos52 !== null && latest?.pos52 !== undefined ? fmtPct(latest.pos52, 0) : "–", note: snapshot.tech ? `${fmtPrice(latest?.lo52)} – ${fmtPrice(latest?.hi52)}` : undefined })] }), _jsxs("div", { className: "grid main-side", style: { marginTop: 16 }, children: [_jsxs(Card, { title: "Share price", sub: "daily close with moving averages", flush: true, actions: _jsx("span", { className: "small muted", children: "Drag to zoom \u00B7 double-click to reset" }), children: [_jsx(LegendChips, { series: priceSeries, active: active, hidden: hidden, onActive: setActive, onToggle: (k) => setHidden((prev) => {
                                    const next = new Set(prev);
                                    next.has(k) ? next.delete(k) : next.add(k);
                                    return next;
                                }) }), _jsx("div", { style: { padding: "0 10px 10px" }, children: _jsx(Plot, { figure: priceFig, height: 286 }) })] }), _jsx("div", { className: "stack", children: _jsx(Card, { title: "Valuation summary", sub: v ? `${v.methods.filter((m) => m.inUse).length} methods in use` : undefined, children: v ? (_jsxs("div", { className: "stack", style: { gap: 12 }, children: [_jsxs("div", { className: "row", style: { alignItems: "baseline", gap: 12 }, children: [_jsxs("div", { children: [_jsx("div", { className: "tile-label", children: "Weighted fair value" }), _jsx("div", { style: { fontSize: 27, fontWeight: 700, letterSpacing: "-0.02em", color: MBS.dark }, children: fmtPrice(v.weightedValue) })] }), _jsxs("div", { style: { marginLeft: "auto", textAlign: "right" }, children: [_jsx(RecBadge, { rec: v.recommendation }), _jsxs("div", { className: `small ${(v.upside ?? 0) >= 0 ? "pos" : "neg"}`, style: { fontWeight: 700, marginTop: 3 }, children: [fmtPct(v.upside, 1, true), " vs ", fmtPrice(v.price)] })] })] }), _jsx("div", { className: "hr", style: { margin: "2px 0" } }), _jsx("table", { className: "data compact", children: _jsx("tbody", { children: v.methods
                                                .filter((m) => m.available)
                                                .map((m) => (_jsxs("tr", { children: [_jsx("td", { style: { textAlign: "left" }, children: m.label }), _jsx("td", { className: "num", children: fmtPrice(m.valueEx) }), _jsx("td", { style: { width: 56 }, children: _jsx("span", { className: `method-chip${m.inUse ? " used" : ""}`, children: m.inUse ? `${Math.round(m.weightUsed * 100)}%` : "–" }) })] }, m.method))) }) }), _jsx("button", { className: "pill", onClick: () => navigate("valuation"), children: "Adjust assumptions \u2192" })] })) : (_jsx(Empty, { title: "Valuation unavailable", message: "The model needs earnings or dividend data for this company." })) }) })] }), _jsxs("div", { className: "grid main-side", style: { marginTop: 16 }, children: [_jsx(Card, { title: "Football field", sub: "valuation ranges by method", flush: true, children: ff.length > 1 ? (_jsx("div", { style: { padding: "8px 10px 6px" }, children: _jsx(Plot, { figure: footballFig(ff, v?.price ?? snapshot.quote.price), height: 250 }) })) : (_jsx(Empty, { title: "Not enough methods", message: "Peer or intrinsic methods are unavailable for this company." })) }), _jsx(Card, { title: "Performance", sub: "total return vs ASX 200", children: _jsx(DataTable, { columns: perfCols, rows: perf, rowKey: (row) => row.period, compact: true, note: "Adjusted for dividends and splits." }) })] }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsx(Card, { title: "Revenue and earnings", sub: "reported, $ million", flush: true, children: _jsx("div", { style: { padding: "10px 10px 4px" }, children: _jsx(Plot, { figure: finFig, height: 250 }) }) }), _jsxs(Card, { title: "Risk snapshot", sub: `trailing ${snapshot.period}`, children: [_jsxs("div", { className: "grid cols-2", style: { gap: 10 }, children: [_jsx(KeyValues, { rows: [
                                            ["Beta vs ASX 200", fmtRatio(snapshot.metrics?.beta, 2, "")],
                                            ["Annualised vol", fmtPct(snapshot.metrics?.annVol)],
                                            ["Max drawdown", fmtPct(snapshot.metrics?.maxDrawdown)],
                                            ["Sharpe", fmtRatio(snapshot.metrics?.sharpe, 2, "")],
                                        ] }), _jsx(KeyValues, { rows: [
                                            ["Alpha (ann.)", fmtPct(snapshot.metrics?.alpha)],
                                            ["Tracking error", fmtPct(snapshot.metrics?.trackingError)],
                                            ["RSI (14)", latest?.rsi14?.toFixed(1) ?? "–"],
                                            ["Vol vs 20d avg", fmtPct(latest?.volVsAvg)],
                                        ] })] }), _jsx("div", { className: "hr" }), _jsx(KeyValues, { rows: [
                                    ["Shares on issue", fmtInt(r.sharesOut)],
                                    ["Free float value", fmtMoney(r.marketCap)],
                                    ["Net debt", fmtMoney(r.netDebt)],
                                    ["Cash & investments", fmtMoney(r.cash)],
                                ] })] })] })] }));
}
