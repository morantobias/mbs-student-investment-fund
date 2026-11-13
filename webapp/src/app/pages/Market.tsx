import { useMemo, useState } from "react";
import { MBS, fmtMoney, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { rebaseSeries } from "../../core/normalise.js";
import { seriesColours } from "../../core/brand.js";
import { useApp } from "../App.js";
import { LegendChips, Plot, type SeriesDef } from "../components/Plot.js";
import { CompanyStrip, PageHead, Pct } from "../components/PageHead.js";
import { Card, DataTable, Empty, KeyValues, Seg, Spinner, Tile, Tiles, type Column } from "../components/ui.js";
import { barFig, candleFig, histFig, lineFig } from "../charts.js";
import type { PerfRow } from "../../core/types.js";

const OVERLAYS = [
  { key: "sma50", label: "SMA 50", colour: "#eda100", field: "sma50" as const },
  { key: "sma200", label: "SMA 200", colour: "#2a78d6", field: "sma200" as const },
];

export function MarketPage() {
  const { snapshot, loading, period } = useApp();
  const [mode, setMode] = useState<"line" | "candle">("line");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [logScale, setLogScale] = useState(false);
  const [relActive, setRelActive] = useState<string | null>(null);
  const [relHidden, setRelHidden] = useState<Set<string>>(new Set());

  const tech = snapshot?.tech;
  const rows = tech?.series ?? [];

  const overlaySeries: SeriesDef[] = OVERLAYS.map((o) => ({ key: o.key, label: o.label, colour: o.colour }));

  const priceFig = useMemo(() => {
    if (mode === "candle") {
      return candleFig(
        rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close })),
        OVERLAYS.map((o) => ({ key: o.key, label: o.label, colour: o.colour, values: rows.map((r) => r[o.field]) })),
        hidden,
      );
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
    if (!snapshot?.ok) return [];
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
    return (
      <>
        <PageHead title="Market & risk" />
        <Card><Spinner label="Loading price history…" /></Card>
      </>
    );
  }
  if (!snapshot?.ok) {
    return (
      <>
        <PageHead title="Market & risk" />
        <Card><Empty title="No data" message={snapshot?.error ?? "Select a company first."} /></Card>
      </>
    );
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
  (volumeFig.data[0] as Record<string, unknown>).marker = {
    color: rows.map((r, i) => (i > 0 && r.close >= rows[i - 1].close ? "rgba(30,122,70,0.55)" : "rgba(192,57,43,0.5)")),
    line: { width: 0 },
  };
  (volumeFig.data[0] as Record<string, unknown>).hovertemplate = "%{y:,.1f}m shares<extra></extra>";

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
  Object.assign(rsiFig.layout as Record<string, unknown>, {
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

  const returns = rows.map((r) => r.ret).filter((x): x is number => x !== null);
  const hist = histFig(returns);

  const perfCols: Column<PerfRow>[] = [
    { key: "period", header: "Period", align: "left", render: (row) => row.period },
    { key: "stock", header: snapshot.code, render: (row) => <Pct value={row.stock} /> },
    { key: "bench", header: "ASX 200", render: (row) => <Pct value={row.benchmark} /> },
    { key: "rel", header: "Relative", render: (row) => <Pct value={row.relative} /> },
  ];

  return (
    <>
      <PageHead
        title="Market & risk"
        sub={`${snapshot.code} · ${period} of daily prices · ${rows.length} sessions`}
        actions={
          <>
            <Seg
              options={[
                { value: "line", label: "Line" },
                { value: "candle", label: "Candles" },
              ]}
              value={mode}
              onChange={setMode}
            />
            <button className={`pill${showVolume ? " active" : ""}`} onClick={() => setShowVolume(!showVolume)}>
              Volume
            </button>
            <button className={`pill${showRsi ? " active" : ""}`} onClick={() => setShowRsi(!showRsi)}>
              RSI
            </button>
            <button className={`pill${logScale ? " active" : ""}`} onClick={() => setLogScale(!logScale)}>
              Log
            </button>
          </>
        }
      />
      <CompanyStrip compact />

      <Tiles>
        <Tile label="Last close" value={fmtPrice(latest?.close)} note={fmtPct(snapshot.quote.changePct, 2, true)} accent />
        <Tile label="Total return" value={fmtPct(m?.totalReturn)} note={`${period} window`} tone={(m?.totalReturn ?? 0) >= 0 ? "pos" : "neg"} />
        <Tile label="Annualised" value={fmtPct(m?.annReturn)} note={`vol ${fmtPct(m?.annVol)}`} />
        <Tile label="Beta" value={fmtRatio(m?.beta, 2, "")} note={`corr ${fmtRatio(m?.correlation, 2, "")}`} />
        <Tile label="Max drawdown" value={fmtPct(m?.maxDrawdown)} note={`now ${fmtPct(m?.currentDrawdown)}`} tone="neg" />
        <Tile label="Sharpe / Sortino" value={`${fmtRatio(m?.sharpe, 2, "")} / ${fmtRatio(m?.sortino, 2, "")}`} note="rf 4.5%" small />
      </Tiles>

      <div className="grid" style={{ marginTop: 16, gap: 12 }}>
        <Card
          title="Price"
          sub={mode === "candle" ? "OHLC candles" : "daily close"}
          flush
          actions={<span className="small muted">Drag to zoom · ⌘-click a chip to hide</span>}
        >
          <LegendChips
            series={[{ key: "close", label: "Close", colour: MBS.primary }, ...overlaySeries]}
            active={active}
            hidden={hidden}
            onActive={setActive}
            onToggle={(k) =>
              setHidden((prev) => {
                const next = new Set(prev);
                next.has(k) ? next.delete(k) : next.add(k);
                return next;
              })
            }
          />
          <div style={{ padding: "0 10px 8px" }}>
            <Plot
              figure={{
                ...priceFig,
                layout: {
                  ...(priceFig.layout ?? {}),
                  yaxis: {
                    ...((priceFig.layout?.yaxis as Record<string, unknown>) ?? {}),
                    type: logScale ? "log" : "linear",
                  },
                },
              }}
              height={340}
            />
          </div>
        </Card>

        {showVolume && (
          <Card title="Volume" sub="million shares" flush>
            <div style={{ padding: "4px 10px 4px" }}>
              <Plot figure={volumeFig} height={110} />
            </div>
          </Card>
        )}
        {showRsi && (
          <Card title="RSI (14)" sub="Wilder smoothing" flush>
            <div style={{ padding: "4px 10px 4px" }}>
              <Plot figure={rsiFig} height={120} />
            </div>
          </Card>
        )}
      </div>

      <div className="grid main-side" style={{ marginTop: 16 }}>
        <Card
          title="Relative performance"
          sub="rebased to 100 at common start"
          flush
          actions={<span className="small muted">Click a chip to isolate</span>}
        >
          <LegendChips
            series={relSeries}
            active={relActive}
            hidden={relHidden}
            onActive={setRelActive}
            onToggle={(k) =>
              setRelHidden((prev) => {
                const next = new Set(prev);
                next.has(k) ? next.delete(k) : next.add(k);
                return next;
              })
            }
          />
          <div style={{ padding: "0 10px 10px" }}>
            <Plot figure={lineFig({ series: relSeries, active: relActive, hidden: relHidden, fmt: "num", tickFormat: ",.0f" })} height={268} />
          </div>
        </Card>

        <Card title="Trailing returns" sub="vs ASX 200">
          <DataTable columns={perfCols} rows={snapshot.perf} rowKey={(r) => r.period} compact />
          <div className="hr" />
          <KeyValues
            rows={[
              ["Best day", fmtPct(m?.bestDay)],
              ["Worst day", fmtPct(m?.worstDay)],
              ["Up days", fmtPct(m?.pctUpDays, 0)],
              ["Excess vs index", fmtPct(m?.excessReturn)],
            ]}
          />
        </Card>
      </div>

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        <Card title="Drawdown" sub="from peak" flush>
          <div style={{ padding: "6px 8px" }}><Plot figure={drawdownFig} height={196} /></div>
        </Card>
        <Card title="Rolling volatility" sub="60-day, annualised" flush>
          <div style={{ padding: "6px 8px" }}><Plot figure={volFig} height={196} /></div>
        </Card>
        <Card title="Daily return distribution" sub={`${returns.length} sessions`} flush>
          <div style={{ padding: "6px 8px" }}><Plot figure={hist} height={196} /></div>
        </Card>
      </div>

      <Card title="Volume context" sub="latest session vs 20-day average">
        <div className="grid cols-3" style={{ gap: 10 }}>
          <KeyValues
            rows={[
              ["Last volume", fmtMoney((rows.at(-1)?.volume ?? null) === null ? null : (rows.at(-1)!.volume as number), 1, "m")],
              ["20-day average", fmtMoney(latest?.volVsAvg !== null && latest?.volVsAvg !== undefined ? (rows.at(-1)?.volAvg20 ?? null) : null, 1, "m")],
            ]}
          />
          <KeyValues
            rows={[
              ["SMA 50", fmtPrice(latest?.sma50)],
              ["vs SMA 50", fmtPct(latest?.pctVsSma50)],
            ]}
          />
          <KeyValues
            rows={[
              ["SMA 200", fmtPrice(latest?.sma200)],
              ["Golden cross", latest?.goldenCross ? "Yes (50 > 200)" : "No"],
            ]}
          />
        </div>
      </Card>
    </>
  );
}
