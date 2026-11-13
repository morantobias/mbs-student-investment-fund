import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { MBS, fmtNum, fmtPct, fmtRatio } from "../../core/brand.js";
import { dupontTable, peerPercentiles } from "../../core/analytics.js";
import { useApp } from "../App.js";
import { Plot } from "../components/Plot.js";
import { CompanyStrip, PageHead } from "../components/PageHead.js";
import { Card, Empty, ScoreBar, Seg, Spinner } from "../components/ui.js";
import { lineFig } from "../charts.js";
const GROUPS = [
    {
        title: "Profitability",
        rows: [
            { key: "gross_margin", label: "Gross margin", kind: "pct", hint: "Gross profit ÷ revenue" },
            { key: "ebitda_margin", label: "EBITDA margin", kind: "pct", hint: "EBITDA ÷ revenue" },
            { key: "ebit_margin", label: "EBIT margin", kind: "pct", hint: "EBIT ÷ revenue" },
            { key: "net_margin", label: "Net margin", kind: "pct", hint: "Net income ÷ revenue" },
            { key: "fcf_margin", label: "FCF margin", kind: "pct", hint: "Free cash flow ÷ revenue" },
        ],
    },
    {
        title: "Returns",
        rows: [
            { key: "roe", label: "Return on equity", kind: "pct", hint: "Net income ÷ average equity" },
            { key: "roa", label: "Return on assets", kind: "pct", hint: "Net income ÷ average total assets" },
            { key: "roic", label: "Return on invested capital", kind: "pct", hint: "NOPAT ÷ average invested capital" },
            { key: "cash_conversion", label: "Cash conversion", kind: "x", hint: "Operating cash flow ÷ net income" },
        ],
    },
    {
        title: "Leverage & liquidity",
        rows: [
            { key: "equity_assets", label: "Equity / assets", kind: "pct", hint: "Common equity ÷ total assets" },
            { key: "debt_equity", label: "Debt / equity", kind: "x", hint: "Total debt ÷ equity" },
            { key: "net_debt_ebitda", label: "Net debt / EBITDA", kind: "x", hint: "Net debt ÷ EBITDA" },
            { key: "interest_coverage", label: "Interest coverage", kind: "x", hint: "EBIT ÷ net interest expense" },
            { key: "leverage", label: "Equity multiplier", kind: "x", hint: "Average assets ÷ average equity (DuPont)" },
        ],
    },
    {
        title: "Growth (YoY)",
        rows: [
            { key: "revenue_growth", label: "Revenue growth", kind: "pct" },
            { key: "ebitda_growth", label: "EBITDA growth", kind: "pct" },
            { key: "eps_growth", label: "EPS growth", kind: "pct" },
            { key: "dps_growth", label: "DPS growth", kind: "pct" },
            { key: "bvps_growth", label: "BVPS growth", kind: "pct" },
        ],
    },
];
function fmtRatioCell(v, kind) {
    if (v === null)
        return "–";
    return kind === "pct" ? fmtPct(v) : kind === "x" ? fmtRatio(v) : fmtNum(v, 2);
}
export function RatiosPage() {
    const { snapshot, loading } = useApp();
    const [view, setView] = useState("history");
    const fin = snapshot?.fin ?? [];
    const labels = fin.map((f) => f.label);
    const dupont = useMemo(() => dupontTable(fin), [fin]);
    const percentiles = useMemo(() => snapshot?.peers
        ? peerPercentiles(snapshot.peers.table, snapshot.code, [
            "roe",
            "netMargin",
            "roic",
            "peRatio",
            "pbRatio",
            "evEbitda",
            "dividendYield",
            "revenueCagr",
            "epsCagr",
        ])
        : [], [snapshot]);
    if (loading && !snapshot) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Ratios" }), _jsx(Card, { children: _jsx(Spinner, { label: "Computing ratios\u2026" }) })] }));
    }
    if (!snapshot?.ok) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Ratios" }), _jsx(Card, { children: _jsx(Empty, { title: "No ratio data", message: snapshot?.error ?? "Select a company first." }) })] }));
    }
    const returnsFig = lineFig({
        series: [
            { key: "roe", label: "ROE", colour: MBS.primary, points: fin.map((f) => ({ x: f.label, y: f.roe })) },
            { key: "roic", label: "ROIC", colour: "#2a78d6", points: fin.map((f) => ({ x: f.label, y: f.roic })) },
            { key: "roa", label: "ROA", colour: "#1baf7a", points: fin.map((f) => ({ x: f.label, y: f.roa })) },
        ],
        fmt: "pct",
        tickFormat: ".0%",
        legend: true,
    });
    const leverageFig = lineFig({
        series: snapshot.info.family === "bank" || snapshot.info.family === "insurer" || snapshot.info.family === "financial"
            ? [
                { key: "ea", label: "Equity / assets", colour: MBS.primary, points: fin.map((f) => ({ x: f.label, y: f.equity_assets })) },
                { key: "lev", label: "Equity multiplier", colour: "#eda100", points: fin.map((f) => ({ x: f.label, y: f.leverage })) },
            ]
            : [
                { key: "nde", label: "Net debt / EBITDA", colour: MBS.primary, points: fin.map((f) => ({ x: f.label, y: f.net_debt_ebitda })) },
                { key: "ic", label: "Interest cover", colour: "#2a78d6", points: fin.map((f) => ({ x: f.label, y: f.interest_coverage })) },
            ],
        fmt: "x",
        tickFormat: ",.1f",
        legend: true,
    });
    return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Ratio analysis", sub: `${snapshot.code} · ${labels.length} fiscal years · latest ${snapshot.ratios.fyLabel}`, actions: _jsx(Seg, { options: [
                        { value: "history", label: "History" },
                        { value: "dupont", label: "DuPont" },
                        { value: "percentile", label: "vs peers" },
                    ], value: view, onChange: setView }) }), _jsx(CompanyStrip, { compact: true }), _jsxs("div", { className: "grid cols-2", children: [_jsx(Card, { title: "Returns", sub: "ROE, ROIC and ROA", flush: true, children: _jsx("div", { style: { padding: "10px 8px 4px" }, children: _jsx(Plot, { figure: returnsFig, height: 236 }) }) }), _jsx(Card, { title: snapshot.info.family === "bank" ? "Capital intensity" : "Leverage and coverage", sub: "times", flush: true, children: _jsx("div", { style: { padding: "10px 8px 4px" }, children: _jsx(Plot, { figure: leverageFig, height: 236 }) }) })] }), view === "history" && (_jsxs(Card, { title: "Ratio history", sub: "click a column header to sort years", flush: true, className: "", children: [_jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "data compact", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left", minWidth: 230 }, children: "Ratio" }), labels.map((l) => _jsx("th", { children: l }, l)), _jsx("th", { children: "Latest" })] }) }), _jsx("tbody", { children: GROUPS.map((g) => (_jsxs(_Fragment, { children: [_jsx("tr", { className: "group", children: _jsx("td", { colSpan: labels.length + 2, children: g.title }) }, g.title), g.rows.map((row) => {
                                                const values = fin.map((f) => f[row.key]);
                                                const latestVal = values.at(-1) ?? null;
                                                return (_jsxs("tr", { children: [_jsx("td", { style: { textAlign: "left" }, title: row.hint, children: row.label }), values.map((v, i) => (_jsx("td", { className: row.kind === "pct" && v !== null && v < 0 ? "neg" : undefined, children: fmtRatioCell(v, row.kind) }, i))), _jsx("td", { style: { fontWeight: 700 }, children: fmtRatioCell(latestVal, row.kind) })] }, row.key));
                                            })] }))) })] }) }), _jsx("div", { className: "table-note", children: "Hover a ratio name for its definition. Averages use opening and closing balances where both are available." })] })), view === "dupont" && (_jsxs("div", { className: "grid main-side", children: [_jsxs(Card, { title: "DuPont decomposition", sub: "ROE = net margin \u00D7 asset turnover \u00D7 leverage", flush: true, children: [_jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "data compact", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left" }, children: "Year" }), _jsx("th", { children: "Net margin" }), _jsx("th", { children: "Asset turnover" }), _jsx("th", { children: "Equity multiplier" }), _jsx("th", { children: "ROE (DuPont)" }), _jsx("th", { children: "ROE (reported)" })] }) }), _jsx("tbody", { children: dupont.map((d) => (_jsxs("tr", { children: [_jsx("td", { style: { textAlign: "left" }, children: d.label }), _jsx("td", { children: fmtPct(d.netMargin) }), _jsx("td", { children: fmtRatio(d.assetTurnover, 2, "x") }), _jsx("td", { children: fmtRatio(d.leverage, 2, "x") }), _jsx("td", { style: { fontWeight: 700 }, children: fmtPct(d.roeDupont) }), _jsx("td", { children: fmtPct(d.roe) })] }, d.label))) })] }) }), _jsx("div", { className: "table-note", children: "Differences between the two ROE columns come from average-balance timing and non-controlling interests." })] }), _jsx(Card, { title: "Latest decomposition", sub: snapshot.ratios.fyLabel, children: _jsx("div", { className: "stack", style: { gap: 14 }, children: (() => {
                                const d = dupont.at(-1);
                                if (!d)
                                    return null;
                                const items = [
                                    ["Net margin", d.netMargin, fmtPct(d.netMargin)],
                                    ["Asset turnover", d.assetTurnover, fmtRatio(d.assetTurnover, 2, "x")],
                                    ["Equity multiplier", d.leverage, fmtRatio(d.leverage, 2, "x")],
                                ];
                                return items.map(([label, value, display]) => (_jsxs("div", { children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [_jsx("span", { className: "small muted", children: label }), _jsx("strong", { className: "num", children: display })] }), _jsx(ScoreBar, { value: value === null ? null : Math.min(1, Math.abs(value)) })] }, label)));
                            })() }) })] })), view === "percentile" && (_jsx(Card, { title: "Percentile rank vs peer set", sub: `${snapshot.peers?.table.length ?? 0} companies including subject`, children: percentiles.length === 0 ? (_jsx(Empty, { title: "No peer set", message: "Peer data is still loading or unavailable for this company." })) : (_jsx("div", { className: "grid cols-2", style: { gap: 20 }, children: percentiles.map((p) => (_jsxs("div", { children: [_jsxs("div", { className: "row", style: { justifyContent: "space-between", marginBottom: 4 }, children: [_jsx("span", { className: "small", style: { fontWeight: 600 }, children: METRIC_LABELS[p.metric] ?? p.metric }), _jsxs("span", { className: "small num muted", children: [p.value === null ? "–" : p.metric.toLowerCase().includes("ratio") || p.metric === "evEbitda" ? fmtRatio(p.value) : fmtPct(p.value), p.percentile !== null && ` · ${Math.round(p.percentile * 100)}th`] })] }), _jsx(ScoreBar, { value: p.percentile })] }, p.metric))) })) }))] }));
}
const METRIC_LABELS = {
    roe: "Return on equity",
    netMargin: "Net margin",
    roic: "Return on invested capital",
    peRatio: "P/E (lower is cheaper)",
    pbRatio: "P/B (lower is cheaper)",
    evEbitda: "EV/EBITDA (lower is cheaper)",
    dividendYield: "Dividend yield",
    revenueCagr: "Revenue CAGR",
    epsCagr: "EPS CAGR",
};
