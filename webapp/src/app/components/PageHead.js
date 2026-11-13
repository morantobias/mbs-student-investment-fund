import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MBS, fmtPct, fmtPrice } from "../../core/brand.js";
import { useApp } from "../App.js";
import { Badge, RecBadge } from "./ui.js";
export function PageHead({ title, sub, actions, }) {
    return (_jsxs("div", { className: "page-head", children: [_jsxs("div", { children: [_jsx("h1", { className: "page-title", children: title }), sub && _jsx("div", { className: "page-sub", children: sub })] }), actions && _jsx("div", { className: "page-actions", children: actions })] }));
}
/** Company identity + valuation verdict, repeated at the top of every page. */
export function CompanyStrip({ compact }) {
    const { snapshot, valuation } = useApp();
    if (!snapshot?.ok)
        return null;
    const { info, quote, ratios } = snapshot;
    const v = valuation?.valuation;
    return (_jsxs("div", { className: "card pad", style: {
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
            marginBottom: 16,
            background: "linear-gradient(120deg, #fff 0%, var(--mbs-tint-2) 100%)",
            borderColor: MBS.border,
        }, children: [_jsxs("div", { style: { minWidth: 240, flex: "1 1 260px" }, children: [_jsxs("div", { className: "row", style: { gap: 8 }, children: [_jsx("span", { className: "mono", style: { fontWeight: 700, color: MBS.primary, fontSize: 12.5 }, children: info.code }), _jsxs("span", { className: "mono muted", style: { fontSize: 10.5 }, children: [info.sector, " \u00B7 ", info.industry] })] }), _jsx("div", { style: { fontSize: 18, fontWeight: 700, color: MBS.dark, letterSpacing: "-0.015em", marginTop: 1 }, children: info.name }), !compact && (_jsxs("div", { className: "small muted", style: { marginTop: 2 }, children: ["FY", String(ratios.fy ?? "").slice(2), " \u00B7 ", ratios.nYears, " years of accounts \u00B7 ", snapshot.meta.exchange ?? "ASX"] }))] }), _jsxs("div", { className: "row", style: { gap: 22, flexWrap: "wrap" }, children: [_jsx(Stat, { label: "Price", value: fmtPrice(quote.price), sub: fmtPct(quote.changePct, 2, true), tone: quote.changePct ?? 0 }), _jsx(Stat, { label: "Fair value", value: fmtPrice(v?.weightedValue ?? null), sub: v ? `${fmtPct(v.upside, 1, true)} ${v.headlineBasis === "fc" ? "incl. franking" : "ex-franking"}` : undefined, tone: v?.upside ?? 0 }), _jsxs("div", { className: "field", style: { minWidth: 92 }, children: [_jsx("span", { className: "tile-label", children: "Recommendation" }), _jsx("div", { style: { marginTop: 4 }, children: _jsx(RecBadge, { rec: v?.recommendation ?? "n/a" }) })] })] }), _jsxs("div", { style: { marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }, children: [v && _jsx(Badge, { kind: "outline", children: v.isFinancial ? "Financial model" : v.family === "reit" ? "REIT model" : "Industrial model" }), snapshot.quote.week52Low !== null && (_jsxs(Badge, { kind: "neutral", children: ["52w ", fmtPrice(snapshot.quote.week52Low), " \u2013 ", fmtPrice(snapshot.quote.week52High)] }))] })] }));
}
function Stat({ label, value, sub, tone }) {
    const cls = tone > 0 ? "pos" : tone < 0 ? "neg" : "muted";
    return (_jsxs("div", { className: "field", children: [_jsx("span", { className: "tile-label", children: label }), _jsx("span", { style: { fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }, children: value }), sub && (_jsx("span", { className: `small ${cls}`, style: { fontWeight: 700 }, children: sub }))] }));
}
export function Pct({ value, digits = 1, signed = true }) {
    const cls = value === null || value === undefined ? "muted" : value > 0 ? "pos" : value < 0 ? "neg" : "";
    return _jsx("span", { className: cls, children: fmtPct(value, digits, signed) });
}
