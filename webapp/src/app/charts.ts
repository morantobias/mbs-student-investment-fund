// Chart builders. Each returns Plotly {data, layout} in MBS styling.
// Interaction model: `active` isolates one series (others go grey), `hidden`
// removes a series; both are driven by the LegendChips row.

import { BENCH_COLOUR, CAT, MBS, divColours, seqColours } from "../core/brand.js";
import { emphasis, type Figure } from "./components/Plot.js";

export type Fmt = "money" | "pct" | "x" | "num" | "price";

const HOVER: Record<Fmt, string> = {
  money: "%{y:$,.3s}",
  pct: "%{y:.1%}",
  x: "%{y:.1f}x",
  num: "%{y:,.2f}",
  price: "%{y:$,.2f}",
};
const TICK: Record<Fmt, string> = {
  money: "$,.2s",
  pct: ".0%",
  x: ".1f",
  num: ",.0f",
  price: ",.2f",
};

export interface Point {
  x: string | number;
  y: number | null;
}

export interface LineSeries {
  key: string;
  label: string;
  colour: string;
  points: Point[];
  dash?: "solid" | "dot" | "dash";
  width?: number;
}

export function lineFig({
  series,
  active = null,
  hidden = new Set<string>(),
  fmt = "num",
  yTitle,
  xTitle,
  zeroLine = false,
  height,
  legend = false,
  tickFormat,
  hoverMode = "x unified",
}: {
  series: LineSeries[];
  active?: string | null;
  hidden?: Set<string>;
  fmt?: Fmt;
  yTitle?: string;
  xTitle?: string;
  zeroLine?: boolean;
  height?: number;
  legend?: boolean;
  tickFormat?: string;
  hoverMode?: "x unified" | "closest";
}): Figure {
  const data = series.map((s) => {
    const e = emphasis(s.key, s.colour, active, hidden);
    return {
      type: "scatter",
      mode: "lines",
      name: s.label,
      x: s.points.map((p) => p.x),
      y: s.points.map((p) => p.y),
      line: { color: e.colour, width: s.width ?? e.width, dash: s.dash ?? "solid", shape: "linear" },
      opacity: e.visible ? e.opacity : 0,
      hovertemplate: `${s.label}: ${fmt === "money" ? "$%{y:,.3s}" : fmt === "pct" ? "%{y:.2%}" : fmt === "x" ? "%{y:.2f}x" : fmt === "price" ? "$%{y:,.2f}" : "%{y:,.2f}"}<extra></extra>`,
      connectgaps: false,
    };
  });

  return {
    data,
    layout: {
      height,
      hovermode: hoverMode,
      showlegend: legend,
      margin: { l: 58, r: 16, t: 14, b: 40 },
      xaxis: { title: xTitle ? { text: xTitle } : undefined, type: "date", showgrid: false },
      yaxis: { title: yTitle ? { text: yTitle } : undefined, tickformat: tickFormat ?? TICK[fmt], zeroline: zeroLine, zerolinecolor: "#E0D6DB" },
      ...(zeroLine
        ? { shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: MBS.grey3, width: 1 } }] }
        : {}),
    },
  };
}

export interface BarSeries {
  key: string;
  label: string;
  colour: string;
  values: (number | null)[];
}

export function barFig({
  categories,
  series,
  active = null,
  hidden = new Set<string>(),
  fmt = "money",
  stacked = false,
  horizontal = false,
  yTitle,
  textLabels = false,
}: {
  categories: string[];
  series: BarSeries[];
  active?: string | null;
  hidden?: Set<string>;
  fmt?: Fmt;
  stacked?: boolean;
  horizontal?: boolean;
  yTitle?: string;
  textLabels?: boolean;
}): Figure {
  const data = series.map((s) => {
    const e = emphasis(s.key, s.colour, active, hidden);
    return {
      type: "bar",
      orientation: horizontal ? "h" : "v",
      name: s.label,
      x: horizontal ? s.values : categories,
      y: horizontal ? categories : s.values,
      marker: { color: e.colour, opacity: e.visible ? e.opacity : 0, line: { width: 0 } },
      text: textLabels ? s.values.map((v) => (v === null ? "" : formatValue(v, fmt))) : undefined,
      textposition: textLabels ? "outside" : undefined,
      textfont: { size: 10, color: MBS.black },
      cliponaxis: false,
      hovertemplate: `${s.label}: ${HOVER[fmt]}<extra></extra>`,
    };
  });

  return {
    data,
    layout: {
      barmode: stacked ? "relative" : "group",
      bargap: 0.34,
      showlegend: series.length > 1,
      legend: { orientation: "h", x: 0, y: 1.12, font: { size: 10.5 } },
      xaxis: horizontal ? { tickformat: TICK[fmt], gridcolor: "#F3EDF0" } : { showgrid: false },
      yaxis: horizontal
        ? { automargin: true, tickfont: { size: 10.5 } }
        : { tickformat: TICK[fmt], gridcolor: "#F3EDF0", title: yTitle ? { text: yTitle } : undefined },
      margin: horizontal ? { l: 84, r: 24, t: 16, b: 36 } : { l: 58, r: 16, t: 26, b: 40 },
    },
  };
}

function formatValue(v: number, fmt: Fmt): string {
  switch (fmt) {
    case "pct":
      return `${(v * 100).toFixed(1)}%`;
    case "x":
      return `${v.toFixed(1)}x`;
    case "money":
      return Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(1)}bn` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(0)}m` : `$${v.toFixed(0)}`;
    case "price":
      return `$${v.toFixed(2)}`;
    default:
      return v.toFixed(2);
  }
}

/** Horizontal range bars (football field) with a price marker. */
export function footballFig(
  rows: { method: string; low: number; base: number; high: number }[],
  price: number | null,
): Figure {
  const ordered = [...rows].reverse();
  const labels = ordered.map((r) => r.method);
  const lows = ordered.map((r) => r.low);
  const spans = ordered.map((r) => Math.max(r.high - r.low, 0.01));
  const bases = ordered.map((r) => r.base);
  const weighted = labels.indexOf("Weighted fair value");

  const colours = ordered.map((r) =>
    r.method === "Weighted fair value" ? MBS.primary : r.method === "52-week trading range" ? MBS.grey2 : "rgba(163,0,70,0.30)",
  );

  return {
    data: [
      {
        type: "bar",
        orientation: "h",
        x: spans,
        y: labels,
        base: lows,
        marker: { color: colours, line: { width: 0 } },
        hovertemplate: "%{y}<br>%{base:$,.2f} → %{x:$,.2f}<extra></extra>",
        showlegend: false,
        width: 0.55,
      },
      {
        type: "scatter",
        mode: "markers",
        x: bases,
        y: labels,
        marker: { color: MBS.dark, size: 8, symbol: "diamond", line: { color: "#fff", width: 1 } },
        hovertemplate: "%{y}: $%{x:,.2f}<extra></extra>",
        showlegend: false,
      },
    ],
    layout: {
      margin: { l: 14, r: 26, t: 12, b: 34 },
      xaxis: { tickformat: "$,.0f", gridcolor: "#F3EDF0", zeroline: false },
      yaxis: { automargin: true, tickfont: { size: 10.5 }, gridcolor: "rgba(0,0,0,0)" },
      showlegend: false,
      hovermode: "closest",
      ...(price !== null
        ? {
            shapes: [
              {
                type: "line",
                xref: "x",
                yref: "paper",
                x0: price,
                x1: price,
                y0: 0,
                y1: 1,
                line: { color: MBS.black, width: 1.4, dash: "dot" },
              },
            ],
            annotations: [
              {
                x: price,
                y: 1,
                xref: "x",
                yref: "paper",
                text: `Price $${price.toFixed(2)}`,
                showarrow: false,
                xanchor: "left",
                yanchor: "bottom",
                font: { size: 10, color: MBS.black },
              },
            ],
          }
        : {}),
      ...(weighted >= 0 ? {} : {}),
    },
  };
}

/** 2-D sensitivity heatmap with value annotations. */
export function heatFig({
  x,
  y,
  matrix,
  xLabel,
  yLabel,
  subjectValue,
  xIsPercent = true,
  yIsPercent = true,
}: {
  x: number[];
  y: number[];
  matrix: (number | null)[][];
  xLabel: string;
  yLabel: string;
  subjectValue: number | null;
  xIsPercent?: boolean;
  yIsPercent?: boolean;
}): Figure {
  const flat = matrix.flat().filter((v): v is number => v !== null && Number.isFinite(v));
  const min = flat.length ? Math.min(...flat) : 0;
  const max = flat.length ? Math.max(...flat) : 1;
  const n = 9;
  const ramp = divColours(n);

  return {
    data: [
      {
        type: "heatmap",
        z: matrix,
        x,
        y,
        colorscale: ramp.map((c, i) => [i / (n - 1), c]),
        zmin: subjectValue !== null ? Math.min(min, subjectValue) : min,
        zmax: subjectValue !== null ? Math.max(max, subjectValue) : max,
        hovertemplate: `${xLabel}: %{x}<br>${yLabel}: %{y}<br>Value: $%{z:,.2f}<extra></extra>`,
        colorbar: { thickness: 8, len: 0.75, tickformat: "$,.0f", tickfont: { size: 9.5 } },
        xgap: 1,
        ygap: 1,
      },
    ],
    layout: {
      margin: { l: 62, r: 10, t: 12, b: 42 },
      xaxis: {
        title: { text: xLabel, font: { size: 10.5 } },
        tickformat: xIsPercent ? ".1%" : ",.3g",
        type: "category",
        side: "bottom",
      },
      yaxis: {
        title: { text: yLabel, font: { size: 10.5 } },
        tickformat: yIsPercent ? ".1%" : ",.3g",
        type: "category",
      },
      hovermode: "closest",
      showlegend: false,
    },
  };
}

export interface ScatterPoint {
  key: string;
  label: string;
  x: number;
  y: number;
  isSubject: boolean;
}

export function scatterFig({
  points,
  xLabel,
  yLabel,
  xFmt = "pct",
  yFmt = "x",
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  xFmt?: Fmt;
  yFmt?: Fmt;
}): Figure {
  const peers = points.filter((p) => !p.isSubject);
  const subject = points.filter((p) => p.isSubject);
  const medX = median(peers.map((p) => p.x));
  const medY = median(peers.map((p) => p.y));

  return {
    data: [
      {
        type: "scatter",
        mode: "markers+text",
        x: peers.map((p) => p.x),
        y: peers.map((p) => p.y),
        text: peers.map((p) => p.key),
        textposition: "top center",
        textfont: { size: 9, color: MBS.grey2 },
        marker: { color: "rgba(140,140,140,0.55)", size: 9, line: { color: "#fff", width: 1 } },
        hovertemplate: "%{text}<br>" + xLabel + ": " + HOVER[xFmt] + "<br>" + yLabel + ": " + HOVER[yFmt] + "<extra></extra>",
        showlegend: false,
        name: "Peers",
      },
      {
        type: "scatter",
        mode: "markers+text",
        x: subject.map((p) => p.x),
        y: subject.map((p) => p.y),
        text: subject.map((p) => p.key),
        textposition: "top center",
        textfont: { size: 10.5, color: MBS.dark },
        marker: { color: MBS.primary, size: 13, line: { color: "#fff", width: 2 }, symbol: "diamond" },
        hovertemplate: "%{text} (subject)<br>" + xLabel + ": " + HOVER[xFmt] + "<br>" + yLabel + ": " + HOVER[yFmt] + "<extra></extra>",
        showlegend: false,
        name: "Subject",
      },
      ...(medX !== null && medY !== null
        ? [
            {
              type: "scatter",
              mode: "lines",
              x: [medX, medX],
              y: [Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y))],
              line: { color: MBS.border, width: 1, dash: "dot" },
              hoverinfo: "skip",
              showlegend: false,
            },
            {
              type: "scatter",
              mode: "lines",
              x: [Math.min(...points.map((p) => p.x)), Math.max(...points.map((p) => p.x))],
              y: [medY, medY],
              line: { color: MBS.border, width: 1, dash: "dot" },
              hoverinfo: "skip",
              showlegend: false,
            },
          ]
        : []),
    ],
    layout: {
      hovermode: "closest",
      margin: { l: 56, r: 18, t: 14, b: 44 },
      xaxis: { title: { text: xLabel, font: { size: 10.5 } }, tickformat: TICK[xFmt], gridcolor: "#F3EDF0", zeroline: false },
      yaxis: { title: { text: yLabel, font: { size: 10.5 } }, tickformat: TICK[yFmt], gridcolor: "#F3EDF0", zeroline: false },
      showlegend: false,
    },
  };
}

function median(xs: number[]): number | null {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function histFig(values: number[]): Figure {
  return {
    data: [
      {
        type: "histogram",
        x: values,
        nbinsx: 60,
        marker: { color: MBS.primary, line: { color: "#fff", width: 1 } },
        hovertemplate: "%{x:.2%}: %{y} days<extra></extra>",
        opacity: 0.85,
      },
    ],
    layout: {
      bargap: 0.05,
      margin: { l: 50, r: 16, t: 12, b: 40 },
      xaxis: { tickformat: ".1%", gridcolor: "#F3EDF0", zeroline: false },
      yaxis: { title: { text: "Trading days", font: { size: 10.5 } }, gridcolor: "#F3EDF0" },
      showlegend: false,
    },
  };
}

/** Candlestick with optional moving-average overlays. */
export function candleFig(
  rows: { date: string; open: number | null; high: number | null; low: number | null; close: number }[],
  overlays: { key: string; label: string; colour: string; values: (number | null)[] }[] = [],
  hidden: Set<string> = new Set(),
): Figure {
  return {
    data: [
      {
        type: "candlestick",
        x: rows.map((r) => r.date),
        open: rows.map((r) => r.open),
        high: rows.map((r) => r.high),
        low: rows.map((r) => r.low),
        close: rows.map((r) => r.close),
        name: "Price",
        increasing: { line: { color: MBS.positive, width: 1 }, fillcolor: MBS.positive },
        decreasing: { line: { color: MBS.negative, width: 1 }, fillcolor: MBS.negative },
        showlegend: false,
        hoverlabel: { bgcolor: "#fff" },
      },
      ...overlays
        .filter((o) => !hidden.has(o.key))
        .map((o) => ({
          type: "scatter",
          mode: "lines",
          name: o.label,
          x: rows.map((r) => r.date),
          y: o.values,
          line: { color: o.colour, width: 1.4 },
          hovertemplate: `${o.label}: $%{y:,.2f}<extra></extra>`,
          connectgaps: false,
        })),
    ],
    layout: {
      margin: { l: 58, r: 16, t: 12, b: 40 },
      xaxis: { type: "date", rangeslider: { visible: false }, showgrid: false },
      yaxis: { tickformat: "$,.2f", gridcolor: "#F3EDF0" },
      showlegend: overlays.length > 0,
      legend: { orientation: "h", x: 0, y: 1.1, font: { size: 10.5 } },
      hovermode: "x unified",
      dragmode: "zoom",
    },
  };
}

/** EV → equity bridge as a waterfall. */
export function bridgeFig(items: { label: string; value: number | null; kind: "abs" | "rel" | "total" }[]): Figure {
  return {
    data: [
      {
        type: "waterfall",
        orientation: "v",
        measure: items.map((i) => (i.kind === "rel" ? "relative" : "total")),
        x: items.map((i) => i.label),
        y: items.map((i) => (i.value ?? 0) / 1e6),
        text: items.map((i) => (i.value === null ? "–" : `$${(i.value / 1e6).toFixed(0)}m`)),
        textposition: "outside",
        textfont: { size: 10 },
        connector: { line: { color: MBS.grey3, width: 1 } },
        increasing: { marker: { color: MBS.positive } },
        decreasing: { marker: { color: MBS.negative } },
        totals: { marker: { color: MBS.primary } },
        hovertemplate: "%{x}: $%{y:,.0f}m<extra></extra>",
        showlegend: false,
      },
    ],
    layout: {
      margin: { l: 58, r: 16, t: 24, b: 54 },
      yaxis: { title: { text: "$ million", font: { size: 10.5 } }, tickformat: "$,.0f", gridcolor: "#F3EDF0" },
      xaxis: { tickfont: { size: 10 } },
      showlegend: false,
    },
  };
}

export const PALETTE = CAT;
export const BENCH = BENCH_COLOUR;
export const SEQ = seqColours;
