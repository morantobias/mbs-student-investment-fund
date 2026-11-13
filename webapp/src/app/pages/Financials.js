import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { MBS, fmtNum, fmtPct, fmtRatio } from "../../core/brand.js";
import { commonSize } from "../../core/analytics.js";
import { useApp } from "../App.js";
import { Plot } from "../components/Plot.js";
import { CompanyStrip, PageHead } from "../components/PageHead.js";
import { Card, Empty, Seg, Spinner } from "../components/ui.js";
import { barFig, lineFig } from "../charts.js";
const INCOME = [
    { key: "revenue", label: "Revenue", kind: "money", strong: true },
    { key: "cost_of_revenue", label: "Cost of revenue", kind: "money" },
    { key: "gross_profit", label: "Gross profit", kind: "money", strong: true },
    { key: "operating_expense", label: "Operating expenses", kind: "money" },
    { key: "ebitda", label: "EBITDA", kind: "money", strong: true },
    { key: "da", label: "Depreciation & amortisation", kind: "money" },
    { key: "ebit", label: "EBIT", kind: "money", strong: true },
    { key: "interest_net", label: "Net interest", kind: "money" },
    { key: "pretax_income", label: "Pre-tax income", kind: "money" },
    { key: "tax", label: "Tax expense", kind: "money" },
    { key: "net_income", label: "Net income", kind: "money", strong: true },
    { key: "eps", label: "Diluted EPS ($)", kind: "perShare", strong: true },
    { key: "dps", label: "DPS ($)", kind: "perShare" },
    { key: "shares", label: "Diluted shares (m)", kind: "num" },
];
const BALANCE = [
    { key: "cash_total", label: "Cash & investments", kind: "money" },
    { key: "receivables", label: "Receivables", kind: "money" },
    { key: "net_ppe", label: "Net PP&E", kind: "money" },
    { key: "goodwill_intang", label: "Goodwill & intangibles", kind: "money" },
    { key: "total_assets", label: "Total assets", kind: "money", strong: true },
    { key: "payables", label: "Payables", kind: "money" },
    { key: "total_debt", label: "Total debt", kind: "money" },
    { key: "net_debt", label: "Net debt", kind: "money", strong: true },
    { key: "total_liabilities", label: "Total liabilities", kind: "money" },
    { key: "equity", label: "Shareholders' equity", kind: "money", strong: true },
    { key: "bvps", label: "Book value per share ($)", kind: "perShare" },
    { key: "tbvps", label: "Tangible BVPS ($)", kind: "perShare" },
];
const CASHFLOW = [
    { key: "ocf", label: "Operating cash flow", kind: "money", strong: true },
    { key: "da", label: "D&A (add-back)", kind: "money" },
    { key: "change_nwc", label: "Change in working capital", kind: "money" },
    { key: "capex", label: "Capital expenditure", kind: "money" },
    { key: "fcf", label: "Free cash flow", kind: "money", strong: true },
    { key: "investing_cf", label: "Investing cash flow", kind: "money" },
    { key: "dividends_paid", label: "Dividends paid", kind: "money" },
    { key: "financing_cf", label: "Financing cash flow", kind: "money" },
    { key: "end_cash", label: "Closing cash", kind: "money" },
];
function statementValue(row, key, kind) {
    const raw = row[key];
    if (typeof raw !== "number" || !Number.isFinite(raw))
        return null;
    if (kind === "money")
        return raw / 1e6;
    if (kind === "num" && key === "shares")
        return raw / 1e6;
    return raw;
}
function formatCell(v, kind, mode) {
    if (v === null)
        return "–";
    if (mode === "growth")
        return fmtPct(v);
    if (mode === "common")
        return fmtPct(v);
    switch (kind) {
        case "money":
            return fmtNum(v, 0);
        case "perShare":
            return v.toFixed(2);
        case "pct":
            return fmtPct(v);
        default:
            return fmtNum(v, 0);
    }
}
function buildRows(spec, fin, mode, baseKey) {
    return spec.map((s) => {
        const reported = fin.map((f) => statementValue(f, s.key, s.kind));
        let values = reported;
        if (mode === "common") {
            const base = fin.map((f) => statementValue(f, baseKey, "money"));
            values = reported.map((v, i) => (v !== null && base[i] !== null && base[i] !== 0 ? v / base[i] : null));
        }
        else if (mode === "growth") {
            values = reported.map((v, i) => {
                if (i === 0 || v === null)
                    return null;
                const prev = reported[i - 1];
                if (prev === null || prev <= 0)
                    return null;
                return v / prev - 1;
            });
        }
        return { ...s, values };
    });
}
export function FinancialsPage() {
    const { snapshot, loading } = useApp();
    const [mode, setMode] = useState("reported");
    const fin = snapshot?.fin ?? [];
    const labels = fin.map((f) => f.label);
    const incomeRows = useMemo(() => buildRows(INCOME, fin, mode, "revenue"), [fin, mode]);
    const balanceRows = useMemo(() => buildRows(BALANCE, fin, mode, "total_assets"), [fin, mode]);
    const cashRows = useMemo(() => buildRows(CASHFLOW, fin, mode, "revenue"), [fin, mode]);
    if (loading && !snapshot) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Financials" }), _jsx(Card, { children: _jsx(Spinner, { label: "Loading statements\u2026" }) })] }));
    }
    if (!snapshot?.ok) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Financials" }), _jsx(Card, { children: _jsx(Empty, { title: "No statements", message: snapshot?.error ?? "Select a company first." }) })] }));
    }
    const rev = fin.map((f) => f.revenue);
    const ni = fin.map((f) => f.net_income);
    const ebitda = fin.map((f) => f.ebitda ?? null);
    const growthFig = barFig({
        categories: labels,
        series: [
            { key: "rev", label: "Revenue", colour: "#2a78d6", values: rev.map((x) => (x === null ? null : x / 1e6)) },
            { key: "ebitda", label: "EBITDA", colour: "#1baf7a", values: ebitda.map((x) => (x === null ? null : x / 1e6)) },
            { key: "ni", label: "Net income", colour: MBS.primary, values: ni.map((x) => (x === null ? null : x / 1e6)) },
        ],
        fmt: "money",
        yTitle: "$ million",
    });
    const marginFig = lineFig({
        series: [
            { key: "gm", label: "Gross margin", colour: "#eda100", points: fin.map((f) => ({ x: f.label, y: f.gross_margin })) },
            { key: "em", label: "EBITDA margin", colour: "#1baf7a", points: fin.map((f) => ({ x: f.label, y: f.ebitda_margin })) },
            { key: "nm", label: "Net margin", colour: MBS.primary, points: fin.map((f) => ({ x: f.label, y: f.net_margin })) },
        ],
        fmt: "pct",
        tickFormat: ".0%",
        legend: true,
    });
    const cfFig = barFig({
        categories: labels,
        series: [
            { key: "ocf", label: "Operating CF", colour: "#2a78d6", values: fin.map((f) => (f.ocf === null ? null : f.ocf / 1e6)) },
            { key: "capex", label: "Capex", colour: "#eb6834", values: fin.map((f) => (f.capex === null ? null : -(f.capex / 1e6))) },
            { key: "fcf", label: "Free cash flow", colour: MBS.primary, values: fin.map((f) => (f.fcf === null ? null : f.fcf / 1e6)) },
        ],
        fmt: "money",
        yTitle: "$ million",
    });
    const epsDpsFig = barFig({
        categories: labels,
        series: [
            { key: "eps", label: "EPS", colour: "#2a78d6", values: fin.map((f) => f.eps) },
            { key: "dps", label: "DPS", colour: MBS.primary, values: fin.map((f) => f.dps) },
        ],
        fmt: "price",
        yTitle: "$ per share",
        textLabels: true,
    });
    const payoutFig = lineFig({
        series: [
            { key: "payout", label: "Payout ratio", colour: MBS.primary, points: fin.map((f) => ({ x: f.label, y: f.payout })) },
            { key: "roe", label: "ROE", colour: "#1baf7a", points: fin.map((f) => ({ x: f.label, y: f.roe })) },
        ],
        fmt: "pct",
        tickFormat: ".0%",
        legend: true,
    });
    const cs = commonSize(fin, "balance");
    return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Financial statements", sub: `${snapshot.code} · ${labels.join(" · ")} · source: Yahoo Finance annual reports`, actions: _jsx(Seg, { options: [
                        { value: "reported", label: "Reported" },
                        { value: "common", label: "Common size" },
                        { value: "growth", label: "YoY growth" },
                    ], value: mode, onChange: setMode }) }), _jsx(CompanyStrip, { compact: true }), _jsxs("div", { className: "grid cols-2", children: [_jsx(Card, { title: "Revenue, EBITDA and earnings", sub: "$ million", flush: true, children: _jsx("div", { style: { padding: "10px 8px 4px" }, children: _jsx(Plot, { figure: growthFig, height: 250 }) }) }), _jsx(Card, { title: "Margin structure", sub: "gross / EBITDA / net", flush: true, children: _jsx("div", { style: { padding: "10px 8px 4px" }, children: _jsx(Plot, { figure: marginFig, height: 250 }) }) })] }), _jsxs("div", { className: "stack", style: { marginTop: 16 }, children: [_jsx(StatementCard, { title: mode === "reported" ? "Income statement" : mode === "common" ? "Income statement — % of revenue" : "Income statement — YoY growth", sub: "$ million unless stated", labels: labels, rows: incomeRows, mode: mode }), _jsx(StatementCard, { title: mode === "reported" ? "Balance sheet" : mode === "common" ? "Balance sheet — % of total assets" : "Balance sheet — YoY growth", sub: "$ million unless stated", labels: labels, rows: balanceRows, mode: mode }), _jsx(StatementCard, { title: mode === "reported" ? "Cash flow statement" : mode === "common" ? "Cash flow — % of revenue" : "Cash flow — YoY growth", sub: "$ million", labels: labels, rows: cashRows, mode: mode })] }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsx(Card, { title: "Cash generation", sub: "OCF, capex and free cash flow", flush: true, children: _jsx("div", { style: { padding: "10px 8px 4px" }, children: _jsx(Plot, { figure: cfFig, height: 250 }) }) }), _jsx(Card, { title: "EPS and dividends", sub: "$ per share", flush: true, children: _jsx("div", { style: { padding: "10px 8px 4px" }, children: _jsx(Plot, { figure: epsDpsFig, height: 250 }) }) })] }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsx(Card, { title: "Payout and returns", sub: "distribution cover", flush: true, children: _jsx("div", { style: { padding: "10px 8px 4px" }, children: _jsx(Plot, { figure: payoutFig, height: 230 }) }) }), _jsx(Card, { title: "Balance sheet mix", sub: "% of total assets", children: _jsxs("table", { className: "data compact", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left" }, children: "Item" }), cs.labels.map((l) => _jsx("th", { children: l }, l))] }) }), _jsx("tbody", { children: cs.items.map((item) => (_jsxs("tr", { children: [_jsx("td", { style: { textAlign: "left" }, children: item.line }), item.values.map((v, i) => (_jsx("td", { className: v !== null && v < 0 ? "neg" : undefined, children: fmtPct(v, 0) }, i)))] }, item.line))) })] }) })] }), _jsx(Card, { title: "Key cash-flow ratios", sub: "latest year", children: _jsxs("div", { className: "grid cols-4", style: { gap: 12 }, children: [_jsx(RatioKV, { label: "Cash conversion", value: fmtRatio(snapshot.ratios.cashConversion, 2, "x") }), _jsx(RatioKV, { label: "FCF conversion", value: fmtRatio(snapshot.ratios.fcfConversion, 2, "x") }), _jsx(RatioKV, { label: "Capex / revenue", value: fmtPct(snapshot.ratios.capexRevenue) }), _jsx(RatioKV, { label: "Capex / D&A", value: fmtRatio(snapshot.ratios.capexRevenue !== null && snapshot.ratios.da !== null && snapshot.ratios.revenue !== null && snapshot.ratios.da > 0 ? (snapshot.ratios.capex ?? 0) / snapshot.ratios.da : null, 2, "x") })] }) })] }));
}
function RatioKV({ label, value }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "tile-label", children: label }), _jsx("div", { style: { fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }, children: value })] }));
}
function StatementCard({ title, sub, labels, rows, mode, }) {
    const latest = rows.length ? rows[rows.length - 1] : null;
    return (_jsxs(Card, { title: title, sub: sub, flush: true, children: [_jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "data compact", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left", minWidth: 220 }, children: "Line item" }), labels.map((l) => (_jsx("th", { children: l }, l)))] }) }), _jsx("tbody", { children: rows.map((row) => (_jsxs("tr", { children: [_jsx("td", { style: { textAlign: "left", fontWeight: row.strong ? 700 : 400 }, children: row.label }), row.values.map((v, i) => {
                                        const clean = mode === "reported" ? v : v;
                                        return (_jsx("td", { className: mode === "growth" && clean !== null ? (clean > 0 ? "pos" : clean < 0 ? "neg" : "") : undefined, style: { fontWeight: row.strong ? 700 : 400 }, children: formatCell(clean, row.kind, mode) }, i));
                                    })] }, row.key + row.label))) })] }) }), _jsxs("div", { className: "table-note", children: [mode === "reported"
                        ? "Figures as reported, scaled to $ million. Blank cells are not disclosed by the source."
                        : mode === "common"
                            ? "Each line expressed as a share of revenue (income & cash flow) or total assets (balance sheet)."
                            : "Year-on-year change; percentage change is undefined where the prior year is negative or zero.", latest && mode === "reported" ? "" : ""] })] }));
}
