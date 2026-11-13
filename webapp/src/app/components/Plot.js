import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { FONT_STACK, MBS } from "../../core/brand.js";
// Plotly is ~4.7 MB minified, so load it on demand instead of shipping it in
// the entry chunk. The first chart to mount triggers the fetch; subsequent
// charts reuse the same module.
let plotlyPromise = null;
function loadPlotly() {
    plotlyPromise ??= import("plotly.js-dist-min").then((m) => m.default);
    return plotlyPromise;
}
const BASE_LAYOUT = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "#ffffff",
    font: { family: FONT_STACK, size: 11.5, color: MBS.black },
    margin: { l: 58, r: 18, t: 16, b: 42 },
    hovermode: "x unified",
    dragmode: "zoom",
    hoverlabel: {
        bgcolor: "#ffffff",
        bordercolor: MBS.border,
        font: { family: FONT_STACK, size: 11.5, color: MBS.black },
    },
    xaxis: {
        gridcolor: "#F3EDF0",
        linecolor: "#E6DCE1",
        zeroline: false,
        tickfont: { size: 10.5, color: MBS.grey },
        automargin: true,
    },
    yaxis: {
        gridcolor: "#F3EDF0",
        linecolor: "rgba(0,0,0,0)",
        zeroline: false,
        tickfont: { size: 10.5, color: MBS.grey },
        automargin: true,
    },
    showlegend: false,
    bargap: 0.32,
    transition: { duration: 0 },
};
const CONFIG = {
    displayModeBar: "hover",
    displaylogo: false,
    responsive: true,
    scrollZoom: true,
    doubleClick: "reset",
    modeBarButtonsToRemove: [
        "lasso2d",
        "select2d",
        "autoScale2d",
        "toggleSpikelines",
        "hoverCompareCartesian",
        "hoverClosestCartesian",
        "sendDataToCloud",
        "editInChartStudio",
    ],
    toImageButtonOptions: { format: "png", filename: "mbs-sif-chart", scale: 2 },
};
export function mergeLayout(layout = {}) {
    const merged = { ...BASE_LAYOUT, ...layout };
    for (const axis of ["xaxis", "yaxis", "yaxis2", "xaxis2"]) {
        const base = BASE_LAYOUT[axis];
        const override = layout[axis];
        if (base)
            merged[axis] = { ...base, ...(override ?? {}) };
    }
    return merged;
}
export function Plot({ figure, height = 280, className, onRelayout, }) {
    const ref = useRef(null);
    const plotlyRef = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        let cancelled = false;
        const layout = mergeLayout({ ...figure.layout, height });
        void loadPlotly().then((Plotly) => {
            if (cancelled || !el.isConnected)
                return;
            plotlyRef.current = Plotly;
            Plotly.react(el, figure.data, layout, CONFIG).catch(() => {
                /* a resize race is harmless */
            });
            if (onRelayout) {
                el.on("plotly_relayout", onRelayout);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [figure, height, onRelayout]);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        const ro = new ResizeObserver(() => plotlyRef.current?.Plots.resize(el));
        ro.observe(el);
        return () => {
            ro.disconnect();
            plotlyRef.current?.purge(el);
        };
    }, []);
    return _jsx("div", { ref: ref, className: className ?? "chart", style: { height } });
}
/** A chip row that isolates a series (click) or hides it (⌘/ctrl-click). */
export function LegendChips({ series, active, hidden, onActive, onToggle, }) {
    if (series.length < 2)
        return null;
    return (_jsx("div", { className: "chart-legend", children: series.map((s) => {
            const isHidden = hidden.has(s.key);
            return (_jsxs("button", { className: `legend-chip${isHidden ? " off" : ""}${active === s.key ? " active" : ""}`, style: active === s.key ? { borderColor: s.colour, background: `${s.colour}12` } : undefined, title: "Click to highlight \u00B7 \u2318/Ctrl-click to hide", onClick: (e) => {
                    if (e.metaKey || e.ctrlKey)
                        onToggle(s.key);
                    else
                        onActive(active === s.key ? null : s.key);
                }, children: [_jsx("span", { className: "dot", style: { background: isHidden ? MBS.grey3 : s.colour } }), s.label] }, s.key));
        }) }));
}
/** Effective stroke/opacity for a series given the current highlight state. */
export function emphasis(key, baseColour, active, hidden) {
    if (hidden.has(key))
        return { colour: baseColour, width: 1, opacity: 0, visible: false };
    if (active && active !== key)
        return { colour: MBS.grey3, width: 1.2, opacity: 0.9, visible: true };
    return { colour: baseColour, width: active === key ? 3 : 2.1, opacity: 1, visible: true };
}
