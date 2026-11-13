import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { MBS, fmtMoney, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { costOfEquity, footballField, reverseDcf, sensitivity1d, sensitivity2d, waccCalc, } from "../../core/valuation.js";
import { useApp } from "../App.js";
import { Plot } from "../components/Plot.js";
import { CompanyStrip, PageHead } from "../components/PageHead.js";
import { Badge, Card, DataTable, Empty, RecBadge, Seg, Spinner, Tile, Tiles } from "../components/ui.js";
import { barFig, bridgeFig, footballFig, heatFig, lineFig } from "../charts.js";
const pctInput = (v) => (v * 100).toFixed(2);
const fromPct = (s) => Number(s) / 100;
export function ValuationPage() {
    const { snapshot, loading, valuation, assumptions, setAssumptions, resetAssumptions, dirty } = useApp();
    const [sensVar, setSensVar] = useState("ke");
    const v = valuation?.valuation;
    const scen = valuation?.scenarios;
    const sens1d = useMemo(() => {
        if (!snapshot?.ok || !assumptions)
            return [];
        return sensitivity1d(snapshot.ratios, snapshot.peers?.table ?? null, assumptions, sensVar);
    }, [snapshot, assumptions, sensVar]);
    const sens2d = useMemo(() => {
        if (!assumptions)
            return null;
        return sensitivity2d(assumptions, { basis: assumptions.headlineBasis });
    }, [assumptions]);
    const reverse = useMemo(() => (assumptions ? reverseDcf(assumptions) : null), [assumptions]);
    if (loading && !snapshot) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Valuation" }), _jsx(Card, { children: _jsx(Spinner, { label: "Building the model\u2026" }) })] }));
    }
    if (!snapshot?.ok || !v || !assumptions) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Valuation" }), _jsx(Card, { children: _jsx(Empty, { title: "Model unavailable", message: snapshot?.error ?? "Select a company with earnings history." }) })] }));
    }
    const set = (patch) => setAssumptions({ ...assumptions, ...patch });
    const ff = footballField(snapshot.quote, v, scen, sens1d);
    const ke = costOfEquity(assumptions.rf, assumptions.beta, assumptions.mrp);
    const wacc = waccCalc(ke, assumptions.costOfDebt, assumptions.taxRate, assumptions.debtWeight);
    const methodCols = [
        { key: "label", header: "Method", align: "left", render: (m) => m.label },
        { key: "value", header: `Value (${v.headlineBasis === "fc" ? "incl. franking" : "ex-franking"})`, render: (m) => fmtPrice(v.headlineBasis === "fc" ? m.valueFc : m.valueEx) },
        { key: "low", header: "Low", render: (m) => (m.low === null ? "–" : fmtPrice(m.low)) },
        { key: "high", header: "High", render: (m) => (m.high === null ? "–" : fmtPrice(m.high)) },
        { key: "upside", header: "Upside", render: (m) => {
                const u = v.headlineBasis === "fc" ? m.upsideFc : m.upsideEx;
                return _jsx("span", { className: u === null ? "muted" : u >= 0 ? "pos" : "neg", children: fmtPct(u, 1, true) });
            } },
        { key: "weight", header: "Weight", render: (m) => _jsx("span", { className: `method-chip${m.inUse ? " used" : ""}`, children: m.inUse ? `${Math.round(m.weightUsed * 100)}%` : "–" }) },
        { key: "note", header: "Note", align: "left", render: (m) => _jsx("span", { className: "small muted", children: m.note }) },
    ];
    const scenCols = [
        { key: "scenario", header: "Scenario", align: "left", render: (s) => s.scenario },
        { key: "weight", header: "Weight", render: (s) => fmtPct(s.weight, 0) },
        { key: "g", header: "Growth Δ", render: (s) => fmtPct(s.growthDelta, 1, true) },
        { key: "ke", header: "Ke", render: (s) => fmtPct(s.ke) },
        { key: "ex", header: "Value (ex)", render: (s) => fmtPrice(s.valueEx) },
        { key: "fc", header: "Value (incl.)", render: (s) => fmtPrice(s.valueFc) },
        { key: "mos", header: "Upside", render: (s) => {
                const m = v.headlineBasis === "fc" ? s.mosFc : s.mosEx;
                return _jsx("span", { className: m === null ? "muted" : m >= 0 ? "pos" : "neg", children: fmtPct(m, 1, true) });
            } },
    ];
    const revenueScene = barFig({
        categories: scen?.filter((s) => s.scenario !== "Probability-weighted").map((s) => s.scenario) ?? [],
        series: [
            {
                key: "val",
                label: "Value per share",
                colour: MBS.primary,
                values: scen?.filter((s) => s.scenario !== "Probability-weighted").map((s) => (v.headlineBasis === "fc" ? s.valueFc : s.valueEx)) ?? [],
            },
        ],
        fmt: "price",
        textLabels: true,
    });
    if (v.price !== null) {
        Object.assign(revenueScene.layout, {
            shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: v.price, y1: v.price, line: { color: MBS.black, width: 1.2, dash: "dot" } }],
        });
    }
    const sensFig = lineFig({
        series: [
            {
                key: "val",
                label: "Value per share",
                colour: MBS.primary,
                points: sens1d.map((s) => ({ x: s.delta, y: v.headlineBasis === "fc" ? s.valueFc : s.valueEx })),
                width: 2.4,
            },
        ],
        fmt: "price",
    });
    Object.assign(sensFig.layout, {
        xaxis: {
            title: { text: SENS_LABELS[sensVar], font: { size: 10.5 } },
            tickformat: sensVar === "ke" || sensVar === "tg" ? "+.1%" : "+.0%",
            gridcolor: "#F3EDF0",
        },
        yaxis: { tickformat: "$,.0f", gridcolor: "#F3EDF0" },
        ...(v.price !== null
            ? {
                shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: v.price, y1: v.price, line: { color: MBS.black, width: 1.2, dash: "dot" } }],
            }
            : {}),
    });
    const schedule = v.dcf?.schedule ?? v.ddm?.schedule ?? v.rim?.schedule ?? [];
    const bridge = v.dcf
        ? bridgeFig([
            { label: "PV of FCFF", value: v.dcf.pvFcffSum, kind: "abs" },
            { label: "PV of terminal", value: v.dcf.pvTerminal, kind: "rel" },
            { label: "Enterprise value", value: v.dcf.enterpriseValue, kind: "total" },
            { label: "Net debt", value: -assumptions.netDebt, kind: "rel" },
            { label: "Equity value", value: v.dcf.equityValue, kind: "total" },
        ])
        : null;
    return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Valuation", sub: _jsxs(_Fragment, { children: [snapshot.code, " \u00B7 ", v.isFinancial ? "dividend / excess-returns framework" : "unlevered FCFF framework", " \u00B7 recomputes instantly"] }), actions: _jsxs(_Fragment, { children: [dirty && _jsx(Badge, { kind: "hold", children: "Edited" }), _jsx("button", { className: "pill", onClick: resetAssumptions, disabled: !dirty, children: "Reset assumptions" }), _jsx(Seg, { options: [
                                { value: "ex", label: "Ex-franking" },
                                { value: "fc", label: "Incl. franking" },
                            ], value: assumptions.headlineBasis, onChange: (basis) => set({ headlineBasis: basis }) })] }) }), _jsx(CompanyStrip, { compact: true }), _jsxs("div", { className: "grid side-main", children: [_jsxs("div", { className: "stack", children: [_jsxs(Card, { title: "Assumptions", sub: "live model inputs", children: [_jsxs("div", { className: "grid cols-2", style: { gap: 10 }, children: [_jsx(NumField, { label: "Risk-free rate", value: pctInput(assumptions.rf), onChange: (s) => set({ rf: fromPct(s) }), suffix: "%" }), _jsx(NumField, { label: "Beta", value: assumptions.beta.toFixed(2), step: 0.05, onChange: (s) => set({ beta: Number(s) }) }), _jsx(NumField, { label: "Market risk premium", value: pctInput(assumptions.mrp), onChange: (s) => set({ mrp: fromPct(s) }), suffix: "%" }), _jsx(NumField, { label: "Terminal growth", value: pctInput(assumptions.terminalGrowth), onChange: (s) => set({ terminalGrowth: fromPct(s) }), suffix: "%" }), _jsx(NumField, { label: "Cost of debt", value: pctInput(assumptions.costOfDebt), onChange: (s) => set({ costOfDebt: fromPct(s) }), suffix: "%" }), _jsx(NumField, { label: "Debt weight", value: pctInput(assumptions.debtWeight), onChange: (s) => set({ debtWeight: fromPct(s) }), suffix: "%" }), _jsx(NumField, { label: "Tax rate", value: pctInput(assumptions.taxRate), onChange: (s) => set({ taxRate: fromPct(s) }), suffix: "%" }), _jsx(NumField, { label: "Horizon (years)", value: String(assumptions.horizon), step: 1, onChange: (s) => set({ horizon: Math.max(3, Math.min(10, Number(s))) }) })] }), _jsx("div", { className: "hr" }), _jsxs("div", { className: "row", style: { justifyContent: "space-between" }, children: [_jsxs("div", { children: [_jsx("div", { className: "tile-label", children: "Cost of equity (CAPM)" }), _jsx("div", { style: { fontSize: 18, fontWeight: 700 }, children: fmtPct(ke) })] }), _jsxs("div", { style: { textAlign: "right" }, children: [_jsx("div", { className: "tile-label", children: "WACC" }), _jsx("div", { style: { fontSize: 18, fontWeight: 700, color: MBS.primary }, children: fmtPct(wacc) })] })] }), _jsx("div", { className: "hr" }), _jsxs("label", { className: "check", children: [_jsx("input", { type: "checkbox", checked: assumptions.midyear, onChange: (e) => set({ midyear: e.target.checked }) }), "Mid-year discounting"] }), _jsx("div", { className: "hr" }), _jsx("div", { className: "tile-label", style: { marginBottom: 8 }, children: "Method weights" }), _jsx("div", { className: "stack", style: { gap: 8 }, children: [
                                            ["dcf", "FCFF DCF"],
                                            ["ddm", "Dividend discount"],
                                            ["rim", "Residual income"],
                                            ["pe", "Peer P/E"],
                                            ["pb", "Peer P/B"],
                                            ["evEbitda", "Peer EV/EBITDA"],
                                        ].map(([key, label]) => (_jsxs("div", { className: "row", style: { gap: 10 }, children: [_jsx("span", { className: "small", style: { flex: 1 }, children: label }), _jsx("input", { type: "range", min: 0, max: 100, step: 5, value: Math.round(assumptions.weights[key] * 100), onChange: (e) => set({ weights: { ...assumptions.weights, [key]: Number(e.target.value) / 100 } }), style: { width: 96 } }), _jsxs("span", { className: "mono", style: { width: 34, textAlign: "right" }, children: [Math.round(assumptions.weights[key] * 100), "%"] })] }, key))) })] }), _jsxs(Card, { title: "Projection grid", sub: v.isFinancial ? "EPS growth and payout" : "revenue growth and EBIT margin", children: [_jsxs("table", { className: "data compact", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left" }, children: "Year" }), _jsx("th", { children: v.isFinancial ? "EPS growth" : "Growth" }), _jsx("th", { children: v.isFinancial ? "Payout" : "EBIT margin" })] }) }), _jsx("tbody", { children: assumptions.grid.map((row, i) => (_jsxs("tr", { children: [_jsx("td", { style: { textAlign: "left" }, children: row.label }), _jsx("td", { children: _jsx("input", { type: "number", step: 0.5, value: pctInput((v.isFinancial ? row.epsGrowth : row.revenueGrowth) ?? 0), onChange: (e) => {
                                                                    const next = [...assumptions.grid];
                                                                    next[i] = v.isFinancial
                                                                        ? { ...row, epsGrowth: fromPct(e.target.value) }
                                                                        : { ...row, revenueGrowth: fromPct(e.target.value) };
                                                                    set({ grid: next });
                                                                }, style: { width: 72, height: 26, padding: "0 6px", border: "1px solid var(--mbs-border)", borderRadius: 5, textAlign: "right" } }) }), _jsx("td", { children: _jsx("input", { type: "number", step: 0.5, value: pctInput((v.isFinancial ? row.payout : row.ebitMargin) ?? 0), onChange: (e) => {
                                                                    const next = [...assumptions.grid];
                                                                    next[i] = v.isFinancial
                                                                        ? { ...row, payout: fromPct(e.target.value) }
                                                                        : { ...row, ebitMargin: fromPct(e.target.value) };
                                                                    set({ grid: next });
                                                                }, style: { width: 72, height: 26, padding: "0 6px", border: "1px solid var(--mbs-border)", borderRadius: 5, textAlign: "right" } }) })] }, row.year))) })] }), _jsx("div", { className: "table-note", children: "Values in percent. Edits flow straight through every method and sensitivity." })] })] }), _jsxs("div", { className: "stack", children: [_jsx(Card, { title: "Verdict", sub: `${Math.round(v.methods.filter((m) => m.inUse).length)} methods`, children: _jsxs("div", { className: "grid", style: { gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }, children: [_jsxs("div", { children: [_jsx("div", { className: "tile-label", children: "Weighted fair value per share" }), _jsx("div", { style: { fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", color: MBS.dark, lineHeight: 1.1 }, children: fmtPrice(v.weightedValue) }), _jsxs("div", { className: "row", style: { gap: 10, marginTop: 6 }, children: [_jsx(RecBadge, { rec: v.recommendation }), _jsxs("span", { className: `delta ${(v.upside ?? 0) >= 0 ? "pos" : "neg"}`, children: [fmtPct(v.upside, 1, true), " vs ", fmtPrice(v.price)] })] })] }), _jsxs("div", { style: { textAlign: "right" }, children: [_jsx("div", { className: "tile-label", children: "Franking factor" }), _jsx("div", { style: { fontSize: 16, fontWeight: 700 }, children: fmtRatio(v.frankingFactor, 3, "x") }), _jsx("div", { className: "tile-label", style: { marginTop: 8 }, children: "TV share of value" }), _jsx("div", { style: { fontSize: 16, fontWeight: 700 }, children: fmtPct(v.dcf?.tvShare ?? v.ddm?.tvShare ?? null, 0) })] })] }) }), _jsx(Card, { title: "Football field", sub: "range of value by method", flush: true, children: _jsx("div", { style: { padding: "8px 8px 4px" }, children: _jsx(Plot, { figure: footballFig(ff, v.price), height: Math.max(230, ff.length * 30) }) }) }), _jsx(Card, { title: "Methods", sub: `${v.methods.filter((m) => m.inUse).length} weighted`, flush: true, children: _jsx(DataTable, { columns: methodCols, rows: v.methods, rowKey: (m) => m.method, compact: true }) })] })] }), _jsxs("div", { className: "grid cols-2", style: { marginTop: 16 }, children: [_jsxs(Card, { title: "Scenarios", sub: "weighted probability case", flush: true, children: [_jsx(DataTable, { columns: scenCols, rows: scen ?? [], rowKey: (s) => s.scenario, compact: true }), _jsx("div", { style: { padding: "6px 8px 4px" }, children: _jsx(Plot, { figure: revenueScene, height: 190 }) })] }), _jsxs(Card, { title: "Sensitivity", sub: SENS_LABELS[sensVar], flush: true, actions: _jsx("div", { className: "chart-toolbar", children: ["ke", "growth", "tg", "margin"].map((k) => (_jsx("button", { className: `pill small${sensVar === k ? " active" : ""}`, onClick: () => setSensVar(k), children: SENS_SHORT[k] }, k))) }), children: [_jsx("div", { style: { padding: "6px 8px 4px" }, children: _jsx(Plot, { figure: sensFig, height: 230 }) }), _jsx("div", { className: "chart-note", children: "Dotted line is the current share price." })] })] }), sens2d && (_jsx(Card, { title: "Two-way sensitivity", sub: `${sens2d.method} · ${sens2d.xLabel} × ${sens2d.yLabel}`, flush: true, className: "", children: _jsx("div", { className: "table-wrap", style: { overflow: "visible" }, children: _jsx("div", { style: { padding: "6px 8px 2px" }, children: _jsx(Plot, { figure: heatFig({
                                x: sens2d.x,
                                y: sens2d.y,
                                matrix: sens2d.matrix,
                                xLabel: sens2d.xLabel,
                                yLabel: sens2d.yLabel,
                                subjectValue: v.price,
                            }), height: 320 }) }) }) })), _jsxs("div", { className: "grid main-side", style: { marginTop: 16 }, children: [_jsxs(Card, { title: v.isFinancial ? "Dividend / earnings schedule" : "FCFF schedule", sub: v.isFinancial ? "EPS, payout, DPS and book value" : "$ million", flush: true, children: [_jsx("div", { className: "table-wrap", style: { maxHeight: 340 }, children: _jsxs("table", { className: "data compact", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left" }, children: "Year" }), v.isFinancial ? (_jsxs(_Fragment, { children: [_jsx("th", { children: "EPS" }), _jsx("th", { children: "Payout" }), _jsx("th", { children: "DPS" }), _jsx("th", { children: "DPS incl. franking" }), _jsx("th", { children: "BVPS" }), _jsx("th", { children: "ROE" })] })) : (_jsxs(_Fragment, { children: [_jsx("th", { children: "Revenue" }), _jsx("th", { children: "EBIT" }), _jsx("th", { children: "NOPAT" }), _jsx("th", { children: "D&A" }), _jsx("th", { children: "Capex" }), _jsx("th", { children: "\u0394 NWC" }), _jsx("th", { children: "FCFF" }), _jsx("th", { children: "PV" })] }))] }) }), _jsx("tbody", { children: schedule.map((row) => {
                                                const fin = row;
                                                return (_jsxs("tr", { children: [_jsx("td", { style: { textAlign: "left" }, children: row.label }), v.isFinancial ? (_jsxs(_Fragment, { children: [_jsx("td", { children: fmtPrice(fin.eps) }), _jsx("td", { children: fmtPct(fin.payout) }), _jsx("td", { children: fmtPrice(fin.dps) }), _jsx("td", { children: fmtPrice(fin.dpsGrossed) }), _jsx("td", { children: fmtPrice(fin.bvps) }), _jsx("td", { children: fmtPct(fin.roe) })] })) : (_jsxs(_Fragment, { children: [_jsx("td", { children: fmtMoney(fin.revenue) }), _jsx("td", { children: fmtMoney(fin.ebit) }), _jsx("td", { children: fmtMoney(fin.nopat) }), _jsx("td", { children: fmtMoney(fin.da) }), _jsx("td", { children: fmtMoney(fin.capex) }), _jsx("td", { children: fmtMoney(fin.deltaNwc) }), _jsx("td", { style: { fontWeight: 700 }, children: fmtMoney(fin.fcff) }), _jsx("td", { children: fmtMoney(fin.pvFcff) })] }))] }, row.year));
                                            }) })] }) }), v.dcf && (_jsxs("div", { className: "table-note", children: ["Terminal value ", fmtMoney(v.dcf.terminalValue), " at ", fmtPct(v.dcf.terminalGrowth), " growth, discounted at ", fmtPct(v.dcf.wacc), " \u2014 ", fmtPct(v.dcf.tvShare, 0), " of enterprise value."] })), v.ddm && (_jsxs("div", { className: "table-note", children: ["Terminal dividend ", fmtPrice(v.ddm.terminalValue), " capitalised at ", fmtPct(v.ddm.ke), " less ", fmtPct(v.ddm.terminalGrowth), "; franking factor ", fmtRatio(v.ddm.frankingFactor, 3, "x"), "."] }))] }), _jsxs("div", { className: "stack", children: [bridge ? (_jsx(Card, { title: "Enterprise to equity bridge", sub: "$ million", flush: true, children: _jsx("div", { style: { padding: "6px 8px" }, children: _jsx(Plot, { figure: bridge, height: 250 }) }) })) : (_jsx(Card, { title: "Excess returns", sub: "justified P/B", children: _jsxs("div", { className: "grid cols-2", style: { gap: 10 }, children: [_jsxs("div", { children: [_jsx("div", { className: "tile-label", children: "Justified P/B" }), _jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: fmtRatio(v.jpb?.justifiedPb) })] }), _jsxs("div", { children: [_jsx("div", { className: "tile-label", children: "Value" }), _jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: fmtPrice(v.jpb?.value) })] }), _jsxs("div", { children: [_jsx("div", { className: "tile-label", children: "ROE \u2212 Ke spread" }), _jsx("div", { className: `delta ${(v.jpb?.spread ?? 0) >= 0 ? "pos" : "neg"}`, children: fmtPct(v.jpb?.spread) })] }), _jsxs("div", { children: [_jsx("div", { className: "tile-label", children: "Upside" }), _jsx("div", { className: `delta ${(v.jpb?.upside ?? 0) >= 0 ? "pos" : "neg"}`, children: fmtPct(v.jpb?.upside, 1, true) })] })] }) })), reverse && !v.isFinancial && (_jsxs(Card, { title: "Reverse DCF", sub: "what the price implies", children: [_jsxs("div", { className: "grid cols-2", style: { gap: 10 }, children: [_jsxs("div", { children: [_jsx("div", { className: "tile-label", children: "Implied revenue growth" }), _jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: fmtPct(reverse.impliedGrowth) })] }), _jsxs("div", { children: [_jsx("div", { className: "tile-label", children: "Implied terminal growth" }), _jsx("div", { style: { fontSize: 20, fontWeight: 700 }, children: fmtPct(reverse.impliedTerminalGrowth) })] })] }), _jsx("div", { className: "table-note", style: { marginTop: 8 }, children: "The uniform growth that would make the DCF equal today's price. Higher than your forecast implies the market is more optimistic than you." })] })), _jsx(Card, { title: "Peer multiples", sub: `${v.rel[0]?.nPeers ?? 0} peers`, flush: true, children: _jsx(DataTable, { columns: [
                                        { key: "label", header: "Method", align: "left", render: (r) => r.label },
                                        { key: "company", header: "Company", render: (r) => fmtRatio(r.companyMultiple) },
                                        { key: "med", header: "Peer median", render: (r) => fmtRatio(r.multiple) },
                                        { key: "val", header: "Implied value", render: (r) => fmtPrice(r.value) },
                                    ], rows: v.rel, rowKey: (r) => r.method, compact: true }) })] })] }), _jsxs(Tiles, { children: [_jsx(Tile, { label: "Ke", value: fmtPct(v.ke), note: `rf ${fmtPct(assumptions.rf)} + β ${assumptions.beta.toFixed(2)} × ${fmtPct(assumptions.mrp)}`, small: true }), _jsx(Tile, { label: "WACC", value: fmtPct(v.wacc), note: `${fmtPct(assumptions.debtWeight, 0)} debt`, small: true }), _jsx(Tile, { label: "Ex-franking value", value: fmtPrice(v.weightedValueEx), note: fmtPct(v.mosEx, 1, true), small: true }), _jsx(Tile, { label: "Incl. franking value", value: fmtPrice(v.weightedValueFc), note: fmtPct(v.mosFc, 1, true), small: true }), _jsx(Tile, { label: "Method spread", value: fmtPct(methodSpread(v)), note: "low to high", small: true }), _jsx(Tile, { label: "Terminal share", value: fmtPct(v.dcf?.tvShare ?? v.ddm?.tvShare ?? null, 0), note: "of total value", small: true })] })] }));
}
function methodSpread(v) {
    const vals = v.methods.filter((m) => m.available && m.valueEx !== null).map((m) => m.valueEx);
    if (vals.length < 2)
        return null;
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    return lo > 0 ? hi / lo - 1 : null;
}
const SENS_LABELS = {
    ke: "Cost of equity shift (bp)",
    growth: "Revenue / EPS growth shift",
    tg: "Terminal growth shift",
    margin: "EBIT margin shift",
};
const SENS_SHORT = { ke: "Ke", growth: "Growth", tg: "Terminal", margin: "Margin" };
function NumField({ label, value, onChange, step = 0.25, suffix, }) {
    return (_jsxs("div", { className: "field", children: [_jsx("label", { children: label }), _jsxs("div", { style: { position: "relative" }, children: [_jsx("input", { type: "number", step: step, value: value, onChange: (e) => onChange(e.target.value), style: { paddingRight: suffix ? 26 : 9 } }), suffix && (_jsx("span", { className: "muted small", style: { position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }, children: suffix }))] })] }));
}
