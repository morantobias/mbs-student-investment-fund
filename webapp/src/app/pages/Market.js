import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { MBS, fmtMoney, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { rebaseSeries } from "../../core/normalise.js";
import { seriesColours } from "../../core/brand.js";
import { useApp } from "../App.js";
import { LegendChips, Plot } from "../components/Plot.js";
import { CompanyStrip, PageHead, Pct } from "../components/PageHead.js";
import { Card, DataTable, Empty, KeyValues, Seg, Spinner, Tile, Tiles } from "../components/ui.js";
import { barFig, candleFig, histFig, lineFig } from "../charts.js";
const OVERLAYS = [
    { key: "sma50", label: "SMA 50", colour: "#eda100", field: "sma50" },
    { key: "sma200", label: "SMA 200", colour: "#2a78d6", field: "sma200" },
];
export function MarketPage() {
    const { snapshot, loading, period } = useApp();
    const [mode, setMode] = useState("line");
    const [hidden, setHidden] = useState(new Set());
    const [active, setActive] = useState(null);
    const [showVolume, setShowVolume] = useState(true);
    const [showRsi, setShowRsi] = useState(true);
    const [logScale, setLogScale] = useState(false);
    const [relActive, setRelActive] = useState(null);
    const [relHidden, setRelHidden] = useState(new Set());
    const tech = snapshot?.tech;
    const rows = tech?.series ?? [];
    const overlaySeries = OVERLAYS.map((o) => ({ key: o.key, label: o.label, colour: o.colour }));
    const priceFig = useMemo(() => {
        if (mode === "candle") {
            return candleFig(rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close })), OVERLAYS.map((o) => ({ key: o.key, label: o.label, colour: o.colour, values: rows.map((r) => r[o.field]) })), hidden);
        }
        return lineFig({
            series: [
                { key: "close", label: "Close", colour: MBS.primary, points: rows.map((r) => ({ x: r.date, y: r.close })), width: 2 },
                ...OVERLAYS.map((o) => ({
                    key: o.key,
                    label: o.label,
                    colour: o.colour,
                    points: rows.map((r) => ({ x: r.date, y: r[o.field] })),
                    width: 1.3,
                })),
            ],
            active,
            hidden,
            fmt: "price",
            tickFormat: "$,.2f",
        });
    }, [mode, rows, active, hidden]);
    const relSeries = useMemo(() => {
        if (!snapshot?.ok)
            return [];
        const set = [
            { code: snapshot.code, rows: snapshot.history },
            { code: "ASX 200", rows: snapshot.bench },
            ...(snapshot.sectorPx.length ? [{ code: `${snapshot.info.sector} index`, rows: snapshot.sectorPx }] : []),
        ].filter((s) => s.rows.length);
        const rebased = rebaseSeries(set, "adjClose");
        const colours = seriesColours(rebased.map((s) => s.code), snapshot.code, ["ASX 200"]);
        return rebased.map((s) => ({
            key: s.code,
            label: s.code,
            colour: colours[s.code] ?? MBS.grey2,
            points: s.points.map((p) => ({ x: p.date, y: p.value })),
        }));
    }, [snapshot]);
    if (loading && !snapshot) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Market & risk" }), _jsx(Card, { children: _jsx(Spinner, { label: "Loading price history\u2026" }) })] }));
    }
    if (!snapshot?.ok) {
        return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Market & risk" }), _jsx(Card, { children: _jsx(Empty, { title: "No data", message: snapshot?.error ?? "Select a company first." }) })] }));
    }
    const m = snapshot.metrics;
    const latest = tech?.latest;
    const volumeFig = barFig({
        categories: rows.map((r) => r.date),
        series: [
            {
                key: "vol",
                label: "Volume",
                colour: MBS.tint,
                values: rows.map((r) => (r.volume === null ? null : r.volume / 1e6)),
            },
        ],
        fmt: "num",
    });
    // Colour the volume bars by up/down day.
    volumeFig.data[0].marker = {
        color: rows.map((r, i) => (i > 0 && r.close >= rows[i - 1].close ? "rgba(30,122,70,0.55)" : "rgba(192,57,43,0.5)")),
        line: { width: 0 },
    };
    volumeFig.data[0].hovertemplate = "%{y:,.1f}m shares<extra></extra>";
    const rsiFig = lineFig({
        series: [
            {
                key: "rsi",
                label: "RSI (14)",
                colour: "#6250d6",
                points: rows.filter((r) => r.rsi14 !== null).map((r) => ({ x: r.date, y: r.rsi14 })),
                width: 1.6,
            },
        ],
        fmt: "num",
    });
    Object.assign(rsiFig.layout, {
        yaxis: { range: [0, 100], tickvals: [30, 50, 70], gridcolor: "#F3EDF0" },
        shapes: [70, 30].map((y) => ({
            type: "line",
            xref: "paper",
            x0: 0,
            x1: 1,
            y0: y,
            y1: y,
            line: { color: MBS.grey3, width: 1, dash: "dot" },
        })),
    });
    const drawdownFig = lineFig({
        series: [
            {
                key: "dd",
                label: "Drawdown",
                colour: MBS.negative,
                points: rows.map((r) => ({ x: r.date, y: r.drawdown })),
                width: 1.6,
            },
        ],
        fmt: "pct",
        zeroLine: true,
    });
    const volFig = lineFig({
        series: [
            {
                key: "vol",
                label: "60-day vol",
                colour: "#2a78d6",
                points: rows.filter((r) => r.rollVol60 !== null).map((r) => ({ x: r.date, y: r.rollVol60 })),
                width: 1.6,
            },
        ],
        fmt: "pct",
    });
    const returns = rows.map((r) => r.ret).filter((x) => x !== null);
    const hist = histFig(returns);
    const perfCols = [
        { key: "period", header: "Period", align: "left", render: (row) => row.period },
        { key: "stock", header: snapshot.code, render: (row) => _jsx(Pct, { value: row.stock }) },
        { key: "bench", header: "ASX 200", render: (row) => _jsx(Pct, { value: row.benchmark }) },
        { key: "rel", header: "Relative", render: (row) => _jsx(Pct, { value: row.relative }) },
    ];
    return (_jsxs(_Fragment, { children: [_jsx(PageHead, { title: "Market & risk", sub: `${snapshot.code} · ${period} of daily prices · ${rows.length} sessions`, actions: _jsxs(_Fragment, { children: [_jsx(Seg, { options: [
                                { value: "line", label: "Line" },
                                { value: "candle", label: "Candles" },
                            ], value: mode, onChange: setMode }), _jsx("button", { className: `pill${showVolume ? " active" : ""}`, onClick: () => setShowVolume(!showVolume), children: "Volume" }), _jsx("button", { className: `pill${showRsi ? " active" : ""}`, onClick: () => setShowRsi(!showRsi), children: "RSI" }), _jsx("button", { className: `pill${logScale ? " active" : ""}`, onClick: () => setLogScale(!logScale), children: "Log" })] }) }), _jsx(CompanyStrip, { compact: true }), _jsxs(Tiles, { children: [_jsx(Tile, { label: "Last close", value: fmtPrice(latest?.close), note: fmtPct(snapshot.quote.changePct, 2, true), accent: true }), _jsx(Tile, { label: "Total return", value: fmtPct(m?.totalReturn), note: `${period} window`, tone: (m?.totalReturn ?? 0) >= 0 ? "pos" : "neg" }), _jsx(Tile, { label: "Annualised", value: fmtPct(m?.annReturn), note: `vol ${fmtPct(m?.annVol)}` }), _jsx(Tile, { label: "Beta", value: fmtRatio(m?.beta, 2, ""), note: `corr ${fmtRatio(m?.correlation, 2, "")}` }), _jsx(Tile, { label: "Max drawdown", value: fmtPct(m?.maxDrawdown), note: `now ${fmtPct(m?.currentDrawdown)}`, tone: "neg" }), _jsx(Tile, { label: "Sharpe / Sortino", value: `${fmtRatio(m?.sharpe, 2, "")} / ${fmtRatio(m?.sortino, 2, "")}`, note: "rf 4.5%", small: true })] }), _jsxs("div", { className: "grid", style: { marginTop: 16, gap: 12 }, children: [_jsxs(Card, { title: "Price", sub: mode === "candle" ? "OHLC candles" : "daily close", flush: true, actions: _jsx("span", { className: "small muted", children: "Drag to zoom \u00B7 \u2318-click a chip to hide" }), children: [_jsx(LegendChips, { series: [{ key: "close", label: "Close", colour: MBS.primary }, ...overlaySeries], active: active, hidden: hidden, onActive: setActive, onToggle: (k) => setHidden((prev) => {
                                    const next = new Set(prev);
                                    next.has(k) ? next.delete(k) : next.add(k);
                                    return next;
                                }) }), _jsx("div", { style: { padding: "0 10px 8px" }, children: _jsx(Plot, { figure: {
                                        ...priceFig,
                                        layout: {
                                            ...(priceFig.layout ?? {}),
                                            yaxis: {
                                                ...(priceFig.layout?.yaxis ?? {}),
                                                type: logScale ? "log" : "linear",
                                            },
                                        },
                                    }, height: 340 }) })] }), showVolume && (_jsx(Card, { title: "Volume", sub: "million shares", flush: true, children: _jsx("div", { style: { padding: "4px 10px 4px" }, children: _jsx(Plot, { figure: volumeFig, height: 110 }) }) })), showRsi && (_jsx(Card, { title: "RSI (14)", sub: "Wilder smoothing", flush: true, children: _jsx("div", { style: { padding: "4px 10px 4px" }, children: _jsx(Plot, { figure: rsiFig, height: 120 }) }) }))] }), _jsxs("div", { className: "grid main-side", style: { marginTop: 16 }, children: [_jsxs(Card, { title: "Relative performance", sub: "rebased to 100 at common start", flush: true, actions: _jsx("span", { className: "small muted", children: "Click a chip to isolate" }), children: [_jsx(LegendChips, { series: relSeries, active: relActive, hidden: relHidden, onActive: setRelActive, onToggle: (k) => setRelHidden((prev) => {
                                    const next = new Set(prev);
                                    next.has(k) ? next.delete(k) : next.add(k);
                                    return next;
                                }) }), _jsx("div", { style: { padding: "0 10px 10px" }, children: _jsx(Plot, { figure: lineFig({ series: relSeries, active: relActive, hidden: relHidden, fmt: "num", tickFormat: ",.0f" }), height: 268 }) })] }), _jsxs(Card, { title: "Trailing returns", sub: "vs ASX 200", children: [_jsx(DataTable, { columns: perfCols, rows: snapshot.perf, rowKey: (r) => r.period, compact: true }), _jsx("div", { className: "hr" }), _jsx(KeyValues, { rows: [
                                    ["Best day", fmtPct(m?.bestDay)],
                                    ["Worst day", fmtPct(m?.worstDay)],
                                    ["Up days", fmtPct(m?.pctUpDays, 0)],
                                    ["Excess vs index", fmtPct(m?.excessReturn)],
                                ] })] })] }), _jsxs("div", { className: "grid cols-3", style: { marginTop: 16 }, children: [_jsx(Card, { title: "Drawdown", sub: "from peak", flush: true, children: _jsx("div", { style: { padding: "6px 8px" }, children: _jsx(Plot, { figure: drawdownFig, height: 196 }) }) }), _jsx(Card, { title: "Rolling volatility", sub: "60-day, annualised", flush: true, children: _jsx("div", { style: { padding: "6px 8px" }, children: _jsx(Plot, { figure: volFig, height: 196 }) }) }), _jsx(Card, { title: "Daily return distribution", sub: `${returns.length} sessions`, flush: true, children: _jsx("div", { style: { padding: "6px 8px" }, children: _jsx(Plot, { figure: hist, height: 196 }) }) })] }), _jsx(Card, { title: "Volume context", sub: "latest session vs 20-day average", children: _jsxs("div", { className: "grid cols-3", style: { gap: 10 }, children: [_jsx(KeyValues, { rows: [
                                ["Last volume", fmtMoney((rows.at(-1)?.volume ?? null) === null ? null : rows.at(-1).volume, 1, "m")],
                                ["20-day average", fmtMoney(latest?.volVsAvg !== null && latest?.volVsAvg !== undefined ? (rows.at(-1)?.volAvg20 ?? null) : null, 1, "m")],
                            ] }), _jsx(KeyValues, { rows: [
                                ["SMA 50", fmtPrice(latest?.sma50)],
                                ["vs SMA 50", fmtPct(latest?.pctVsSma50)],
                            ] }), _jsx(KeyValues, { rows: [
                                ["SMA 200", fmtPrice(latest?.sma200)],
                                ["Golden cross", latest?.goldenCross ? "Yes (50 > 200)" : "No"],
                            ] })] }) })] }));
}
