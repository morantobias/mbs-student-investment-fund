import { useEffect, useRef } from "react";
import { FONT_STACK, MBS } from "../../core/brand.js";

type PlotlyApi = typeof import("plotly.js-dist-min")["default"];

// Plotly is ~4.7 MB minified, so load it on demand instead of shipping it in
// the entry chunk. The first chart to mount triggers the fetch; subsequent
// charts reuse the same module.
let plotlyPromise: Promise<PlotlyApi> | null = null;
function loadPlotly(): Promise<PlotlyApi> {
  plotlyPromise ??= import("plotly.js-dist-min").then((m) => m.default);
  return plotlyPromise;
}

export interface Figure {
  data: Record<string, unknown>[];
  layout?: Record<string, unknown>;
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
} as const;

const CONFIG = {
  displayModeBar: "hover" as const,
  displaylogo: false,
  responsive: true,
  scrollZoom: true,
  doubleClick: "reset" as const,
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

export function mergeLayout(layout: Record<string, unknown> = {}): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...BASE_LAYOUT, ...layout };
  for (const axis of ["xaxis", "yaxis", "yaxis2", "xaxis2"] as const) {
    const base = (BASE_LAYOUT as Record<string, unknown>)[axis] as Record<string, unknown> | undefined;
    const override = (layout as Record<string, unknown>)[axis] as Record<string, unknown> | undefined;
    if (base) merged[axis] = { ...base, ...(override ?? {}) };
  }
  return merged;
}

export function Plot({
  figure,
  height = 280,
  className,
  onRelayout,
}: {
  figure: Figure;
  height?: number;
  className?: string;
  onRelayout?: (event: Record<string, unknown>) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const plotlyRef = useRef<PlotlyApi | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const layout = mergeLayout({ ...figure.layout, height });
    void loadPlotly().then((Plotly) => {
      if (cancelled || !el.isConnected) return;
      plotlyRef.current = Plotly;
      Plotly.react(el, figure.data, layout, CONFIG).catch(() => {
        /* a resize race is harmless */
      });
      if (onRelayout) {
        (el as unknown as { on: (e: string, fn: (d: Record<string, unknown>) => void) => void }).on("plotly_relayout", onRelayout);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [figure, height, onRelayout]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => plotlyRef.current?.Plots.resize(el));
    ro.observe(el);
    return () => {
      ro.disconnect();
      plotlyRef.current?.purge(el);
    };
  }, []);

  return <div ref={ref} className={className ?? "chart"} style={{ height }} />;
}

export interface SeriesDef {
  key: string;
  label: string;
  colour: string;
}

/** A chip row that isolates a series (click) or hides it (⌘/ctrl-click). */
export function LegendChips({
  series,
  active,
  hidden,
  onActive,
  onToggle,
}: {
  series: SeriesDef[];
  active: string | null;
  hidden: Set<string>;
  onActive: (key: string | null) => void;
  onToggle: (key: string) => void;
}) {
  if (series.length < 2) return null;
  return (
    <div className="chart-legend">
      {series.map((s) => {
        const isHidden = hidden.has(s.key);
        return (
          <button
            key={s.key}
            className={`legend-chip${isHidden ? " off" : ""}${active === s.key ? " active" : ""}`}
            style={active === s.key ? { borderColor: s.colour, background: `${s.colour}12` } : undefined}
            title="Click to highlight · ⌘/Ctrl-click to hide"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) onToggle(s.key);
              else onActive(active === s.key ? null : s.key);
            }}
          >
            <span className="dot" style={{ background: isHidden ? MBS.grey3 : s.colour }} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/** Effective stroke/opacity for a series given the current highlight state. */
export function emphasis(
  key: string,
  baseColour: string,
  active: string | null,
  hidden: Set<string>,
): { colour: string; width: number; opacity: number; visible: boolean } {
  if (hidden.has(key)) return { colour: baseColour, width: 1, opacity: 0, visible: false };
  if (active && active !== key) return { colour: MBS.grey3, width: 1.2, opacity: 0.9, visible: true };
  return { colour: baseColour, width: active === key ? 3 : 2.1, opacity: 1, visible: true };
}
