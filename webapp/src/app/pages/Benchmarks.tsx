import { useMemo, useState } from "react";
import { MBS, fmtDate, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { rebaseSeries } from "../../core/normalise.js";
import { seriesColours } from "../../core/brand.js";
import { BENCHMARKS, FX_PAIRS, SECTOR_INDEX_MAP } from "../../core/universe.js";
import { useApp } from "../App.js";
import { useBenchmarks } from "../hooks.js";
import { LegendChips, Plot } from "../components/Plot.js";
import { PageHead } from "../components/PageHead.js";
import { Card, DataTable, Empty, ScoreBar, Spinner, type Column } from "../components/ui.js";
import { lineFig } from "../charts.js";
import type { BoardRow } from "../../core/types.js";

const INDEX_LABELS: Record<string, string> = Object.fromEntries(BENCHMARKS.map((b) => [b.symbol, b.label]));

export function BenchmarksPage() {
  const { snapshot } = useApp();
  const { data, loading, error } = useBenchmarks(true);
  const [active, setActive] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<string>("all");

  const indexSeries = useMemo(() => {
    if (!data) return [];
    const wanted = ["^AXJO", "^GSPC", "^IXIC", "URTH", "EEM", "^VIX"];
    const entries = wanted
      .map((s) => ({ code: INDEX_LABELS[s] ?? s, rows: data.series[s] ?? [] }))
      .filter((e) => e.rows.length > 2);
    const rebased = rebaseSeries(entries, "close");
    const colours = seriesColours(rebased.map((r) => r.code), null, ["S&P/ASX 200"]);
    return rebased.map((r) => ({
      key: r.code,
      label: r.code,
      colour: colours[r.code] ?? MBS.grey2,
      points: r.points.map((p) => ({ x: p.date, y: p.value })),
    }));
  }, [data]);

  const sectorSeries = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(SECTOR_INDEX_MAP)
      .map(([label, sym]) => ({ code: label, rows: data.series[sym] ?? [] }))
      .filter((e) => e.rows.length > 2);
    const rebased = rebaseSeries(entries, "close");
    const subjectSector = snapshot?.info.sector ?? null;
    const colours = seriesColours(rebased.map((r) => r.code), subjectSector, []);
    return rebased.map((r) => ({
      key: r.code,
      label: r.code,
      colour: colours[r.code] ?? MBS.grey2,
      points: r.points.map((p) => ({ x: p.date, y: p.value })),
      width: r.code === subjectSector ? 2.6 : 1.3,
    }));
  }, [data, snapshot?.info.sector]);

  const fxSeries = useMemo(() => {
    if (!data) return [];
    const entries = FX_PAIRS.map((f) => ({ code: f.label, rows: data.fx[f.symbol] ?? [] })).filter((e) => e.rows.length > 2);
    const rebased = rebaseSeries(entries, "close");
    const colours = seriesColours(rebased.map((r) => r.code), null, []);
    return rebased.map((r) => ({
      key: r.code,
      label: r.code,
      colour: colours[r.code] ?? MBS.grey2,
      points: r.points.map((p) => ({ x: p.date, y: p.value })),
    }));
  }, [data]);

  if (error) {
    return (
      <>
        <PageHead title="Benchmarks" />
        <Card><Empty title="Could not load benchmarks" message={error} /></Card>
      </>
    );
  }
  if (loading && !data) {
    return (
      <>
        <PageHead title="Benchmarks" />
        <Card><Spinner label="Loading indices, rates, commodities and FX…" /></Card>
      </>
    );
  }
  if (!data) return null;

  const kinds = ["all", ...new Set(data.board.map((b) => b.kind))];
  const rows = kind === "all" ? data.board : data.board.filter((b) => b.kind === kind);

  const columns: Column<BoardRow>[] = [
    { key: "label", header: "Instrument", align: "left", render: (b) => <span style={{ fontWeight: 600 }}>{b.label}</span> },
    { key: "kind", header: "Type", align: "left", render: (b) => <span className="small muted">{b.kind}</span> },
    { key: "symbol", header: "Symbol", align: "left", render: (b) => <span className="mono small">{b.symbol}</span> },
    { key: "last", header: "Last", render: (b) => fmtPrice(b.price, b.kind === "Rate (%)" ? 2 : 2) },
    { key: "chg", header: "Change", render: (b) => <span className={(b.change ?? 0) >= 0 ? "pos" : "neg"}>{fmtPct(b.changePct, 2, true)}</span> },
    { key: "lo", header: "52w low", render: (b) => fmtPrice(b.week52Low) },
    { key: "hi", header: "52w high", render: (b) => fmtPrice(b.week52High) },
    {
      key: "pos",
      header: "52w position",
      render: (b) => (
        <div style={{ width: 90, display: "inline-block" }}>
          <ScoreBar value={b.pos52} />
        </div>
      ),
    },
  ];

  const asOf = data.board[0]?.symbol ? fmtDate(data.loadedAt) : null;

  return (
    <>
      <PageHead
        title="Benchmarks & rates"
        sub={
          <>
            Indices, sector indices, government yields, commodities and FX · refreshed {asOf}
          </>
        }
        actions={
          <div className="chart-toolbar">
            {kinds.map((k) => (
              <button key={k} className={`pill small${kind === k ? " active" : ""}`} onClick={() => setKind(k)}>
                {k === "all" ? "All" : k}
              </button>
            ))}
          </div>
        }
      />

      <Card title="Market board" sub={`${rows.length} instruments`} flush>
        <DataTable columns={columns} rows={rows} rowKey={(b) => b.symbol} maxHeight={430} compact />
        <div className="table-note">
          Delayed quotes. Yield indices are quoted in percent; commodities in USD.
        </div>
      </Card>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Global equity indices" sub="rebased to 100, 1 year" flush>
          <LegendChips
            series={indexSeries}
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
          <div style={{ padding: "0 8px 8px" }}>
            <Plot figure={lineFig({ series: indexSeries, active, hidden, fmt: "num", tickFormat: ",.0f" })} height={300} />
          </div>
        </Card>

        <Card title="ASX sector indices" sub={`${snapshot?.info.sector ?? "sector"} highlighted`} flush>
          <LegendChips
            series={sectorSeries}
            active={active === "__sector" ? null : null}
            hidden={new Set()}
            onActive={() => {}}
            onToggle={() => {}}
          />
          <div style={{ padding: "0 8px 8px" }}>
            <Plot figure={lineFig({ series: sectorSeries, active: null, hidden: new Set(), fmt: "num", tickFormat: ",.0f" })} height={300} />
          </div>
        </Card>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Australian dollar" sub="rebased, 1 year" flush>
          <div style={{ padding: "8px 8px 4px" }}>
            <Plot figure={lineFig({ series: fxSeries, active: null, hidden: new Set(), fmt: "num", tickFormat: ",.0f" })} height={260} />
          </div>
        </Card>

        <Card title="Risk-free proxy" sub="US 10-year Treasury yield" flush>
          <div style={{ padding: "8px 8px 4px" }}>
            <Plot
              figure={lineFig({
                series: [
                  {
                    key: "tnx",
                    label: "US 10y",
                    colour: MBS.primary,
                    points: (data.series["^TNX"] ?? []).map((r) => ({ x: r.date, y: r.close })),
                    width: 2.2,
                  },
                ],
                fmt: "num",
                tickFormat: ".2f",
              })}
              height={260}
            />
          </div>
          <div className="chart-note">Used as the anchor for the risk-free rate in the valuation model ({fmtRatio(4.5, 1, "%")} default).</div>
        </Card>
      </div>
    </>
  );
}
