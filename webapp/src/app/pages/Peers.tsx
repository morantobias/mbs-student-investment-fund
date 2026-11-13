import { useMemo, useState } from "react";
import { MBS, fmtMoney, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { compositeScores } from "../../core/analytics.js";
import { rebaseSeries } from "../../core/normalise.js";
import { seriesColours as palette } from "../../core/brand.js";
import { useApp } from "../App.js";
import { LegendChips, Plot } from "../components/Plot.js";
import { CompanyStrip, PageHead } from "../components/PageHead.js";
import { Card, DataTable, Empty, ScoreBar, Spinner, Tile, Tiles, type Column } from "../components/ui.js";
import { barFig, lineFig, scatterFig, type LineSeries } from "../charts.js";
import type { Ratios } from "../../core/types.js";

export function PeersPage() {
  const { snapshot, loading } = useApp();
  const [metric, setMetric] = useState<"peRatio" | "pbRatio" | "evEbitda" | "dividendYield">("peRatio");
  const [relActive, setRelActive] = useState<string | null>(null);
  const [relHidden, setRelHidden] = useState<Set<string>>(new Set());

  const table = snapshot?.peers?.table ?? [];
  const scored = useMemo(() => compositeScores(table), [table]);

  const relSeries = useMemo<LineSeries[]>(() => {
    if (!snapshot?.peers) return [];
    const entries = Object.entries(snapshot.peers.history)
      .map(([symbol, rows]) => ({ code: symbol.replace(/\.AX$/, ""), rows }))
      .filter((e) => e.rows.length > 2);
    const rebased = rebaseSeries(entries, "adjClose");
    const colours = palette(rebased.map((r) => r.code), snapshot.code, []);
    return rebased.map((r) => ({
      key: r.code,
      label: r.code,
      colour: colours[r.code] ?? MBS.grey2,
      points: r.points.map((p) => ({ x: p.date, y: p.value })),
      width: r.code === snapshot.code ? 2.8 : 1.4,
    }));
  }, [snapshot]);

  if (loading && !snapshot) {
    return (
      <>
        <PageHead title="Peer comparison" />
        <Card><Spinner label="Loading peer set…" /></Card>
      </>
    );
  }
  if (!snapshot?.ok) {
    return (
      <>
        <PageHead title="Peer comparison" />
        <Card><Empty title="No company" message={snapshot?.error ?? "Select a company first."} /></Card>
      </>
    );
  }
  if (!table.length) {
    return (
      <>
        <PageHead title="Peer comparison" sub={snapshot.info.name} />
        <CompanyStrip compact />
        <Card><Empty title="No peer data" message="Yahoo Finance did not return statements for this peer set." /></Card>
      </>
    );
  }

  const subject = table.find((r) => r.code === snapshot.code);
  const peersOnly = table.filter((r) => r.code !== snapshot.code);

  const metricLabels: Record<string, string> = {
    peRatio: "P/E",
    pbRatio: "P/B",
    evEbitda: "EV/EBITDA",
    dividendYield: "Dividend yield",
  };
  const metricFmt = metric === "dividendYield" ? "pct" : "x";

  const barData = [...table]
    .filter((r) => (r as unknown as Record<string, number | null>)[metric] !== null)
    .sort((a, b) => ((a as unknown as Record<string, number>)[metric] ?? 0) - ((b as unknown as Record<string, number>)[metric] ?? 0));

  const barFig1 = barFig({
    categories: barData.map((r) => r.code),
    series: [
      {
        key: "m",
        label: metricLabels[metric],
        colour: MBS.primary,
        values: barData.map((r) => (r as unknown as Record<string, number | null>)[metric] ?? null),
      },
    ],
    fmt: metricFmt as "pct" | "x",
    horizontal: true,
    textLabels: true,
  });
  // Recolour: subject in magenta, peers in a muted tone, plus a median line.
  const values = barData.map((r) => (r as unknown as Record<string, number | null>)[metric] ?? null).filter((v): v is number => v !== null);
  const med = values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : null;
  (barFig1.data[0] as Record<string, unknown>).marker = {
    color: barData.map((r) => (r.code === snapshot.code ? MBS.primary : "rgba(140,140,140,0.55)")),
    line: { width: 0 },
  };
  if (med !== null) {
    Object.assign(barFig1.layout as Record<string, unknown>, {
      shapes: [
        {
          type: "line",
          xref: "x",
          yref: "paper",
          x0: med,
          x1: med,
          y0: 0,
          y1: 1,
          line: { color: MBS.grey, width: 1, dash: "dot" },
        },
      ],
      annotations: [
        {
          x: med,
          y: 1,
          xref: "x",
          yref: "paper",
          text: `Median ${metricFmt === "pct" ? fmtPct(med) : fmtRatio(med)}`,
          showarrow: false,
          xanchor: "left",
          yanchor: "bottom",
          font: { size: 10, color: MBS.grey },
        },
      ],
    });
  }

  const scatter = scatterFig({
    points: table
      .filter((r) => r.roe !== null && r.pbRatio !== null)
      .map((r) => ({ key: r.code, label: r.name, x: r.roe as number, y: r.pbRatio as number, isSubject: r.code === snapshot.code })),
    xLabel: "ROE",
    yLabel: "P/B",
    xFmt: "pct",
    yFmt: "x",
  });

  const scatter2 = scatterFig({
    points: table
      .filter((r) => r.revenueCagr !== null && r.evEbitda !== null)
      .map((r) => ({ key: r.code, label: r.name, x: r.revenueCagr as number, y: r.evEbitda as number, isSubject: r.code === snapshot.code })),
    xLabel: "Revenue CAGR",
    yLabel: "EV/EBITDA",
    xFmt: "pct",
    yFmt: "x",
  });

  const columns: Column<Ratios>[] = [
    {
      key: "code",
      header: "Company",
      align: "left",
      sortValue: (r) => r.code,
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="mono" style={{ fontWeight: 700, color: MBS.dark }}>{r.code}</span>
          <span className="small muted" style={{ fontSize: 10.5 }}>{r.name}</span>
        </div>
      ),
    },
    { key: "mcap", header: "Mkt cap", sortValue: (r) => r.marketCap, render: (r) => fmtMoney(r.marketCap) },
    { key: "price", header: "Price", sortValue: (r) => r.price, render: (r) => fmtPrice(r.price) },
    { key: "pe", header: "P/E", sortValue: (r) => r.peRatio, render: (r) => fmtRatio(r.peRatio) },
    { key: "pb", header: "P/B", sortValue: (r) => r.pbRatio, render: (r) => fmtRatio(r.pbRatio) },
    { key: "ev", header: "EV/EBITDA", sortValue: (r) => r.evEbitda, render: (r) => fmtRatio(r.evEbitda) },
    { key: "dy", header: "Div yield", sortValue: (r) => r.dividendYield, render: (r) => fmtPct(r.dividendYield) },
    { key: "roe", header: "ROE", sortValue: (r) => r.roe, render: (r) => fmtPct(r.roe) },
    { key: "nm", header: "Net margin", sortValue: (r) => r.netMargin, render: (r) => fmtPct(r.netMargin) },
    { key: "revcagr", header: "Rev CAGR", sortValue: (r) => r.revenueCagr, render: (r) => fmtPct(r.revenueCagr) },
    { key: "ret", header: "1y return", sortValue: (r) => r.return1y ?? null, render: (r) => <span className={(r.return1y ?? 0) >= 0 ? "pos" : "neg"}>{fmtPct(r.return1y)}</span> },
    {
      key: "score",
      header: "Composite",
      sortValue: (r) => (r as unknown as { scoreTotal?: number | null }).scoreTotal ?? null,
      render: (r) => {
        const s = (scored.find((x) => x.code === r.code)?.scoreTotal ?? null) as number | null;
        return (
          <div style={{ width: 54 }}>
            <ScoreBar value={s} />
          </div>
        );
      },
    },
  ];

  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>({ key: "mcap", dir: "desc" });
  const sorted = useMemo(() => {
    if (!sort) return table;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return table;
    const copy = [...table];
    copy.sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return sort.dir === "asc" ? va - vb : vb - va;
      return sort.dir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    // Keep the subject pinned to the top.
    const idx = copy.findIndex((r) => r.code === snapshot.code);
    if (idx > 0) copy.unshift(copy.splice(idx, 1)[0]);
    return copy;
  }, [table, sort, snapshot.code, columns]);

  const medians = (key: string) => {
    const vals = peersOnly.map((r) => (r as unknown as Record<string, number | null>)[key]).filter((v): v is number => v !== null);
    if (!vals.length) return null;
    const sortedVals = [...vals].sort((a, b) => a - b);
    const mid = Math.floor(sortedVals.length / 2);
    return sortedVals.length % 2 ? sortedVals[mid] : (sortedVals[mid - 1] + sortedVals[mid]) / 2;
  };

  return (
    <>
      <PageHead
        title="Peer comparison"
        sub={`${snapshot.info.industry} · ${table.length} companies · subject highlighted`}
      />
      <CompanyStrip compact />

      <Tiles>
        <Tile label="Peer median P/E" value={fmtRatio(medians("peRatio"))} note={`subject ${fmtRatio(subject?.peRatio ?? null)}`} accent />
        <Tile label="Peer median P/B" value={fmtRatio(medians("pbRatio"))} note={`subject ${fmtRatio(subject?.pbRatio ?? null)}`} />
        <Tile label="Peer median EV/EBITDA" value={fmtRatio(medians("evEbitda"))} note={`subject ${fmtRatio(subject?.evEbitda ?? null)}`} />
        <Tile label="Peer median yield" value={fmtPct(medians("dividendYield"))} note={`subject ${fmtPct(subject?.dividendYield ?? null)}`} />
        <Tile label="Peer median ROE" value={fmtPct(medians("roe"))} note={`subject ${fmtPct(subject?.roe ?? null)}`} />
        <Tile
          label="Relative 1y"
          value={fmtPct(subject?.return1y !== null && subject?.return1y !== undefined && medians("return1y") !== null ? subject.return1y - medians("return1y")! : null)}
          note="subject less peer median"
          tone={
            subject?.return1y !== null && subject?.return1y !== undefined && medians("return1y") !== null && subject.return1y - medians("return1y")! >= 0
              ? "pos"
              : "neg"
          }
        />
      </Tiles>

      <Card title="Peer set" sub="click headers to sort" flush className="card">
        <DataTable
          columns={columns}
          rows={sorted}
          rowKey={(r) => r.ticker}
          rowClass={(r) => (r.code === snapshot.code ? "subject" : "")}
          maxHeight={520}
          sort={sort}
          onSort={(key) =>
            setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }))
          }
          note="Composite score is an equal-weighted percentile blend of quality, value, growth and momentum within this peer set."
        />
      </Card>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card
          title={metricLabels[metric]}
          sub={`${barData.length} companies · subject vs peers`}
          flush
          actions={
            <div className="chart-toolbar">
              {(["peRatio", "pbRatio", "evEbitda", "dividendYield"] as const).map((k) => (
                <button key={k} className={`pill small${metric === k ? " active" : ""}`} onClick={() => setMetric(k)}>
                  {metricLabels[k]}
                </button>
              ))}
            </div>
          }
        >
          <div style={{ padding: "8px 6px 4px" }}>
            <Plot figure={barFig1} height={Math.max(220, barData.length * 26)} />
          </div>
        </Card>

        <Card title="Relative performance" sub="rebased to 100, 1 year" flush>
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
          <div style={{ padding: "0 8px 6px" }}>
            <Plot figure={lineFig({ series: relSeries, active: relActive, hidden: relHidden, fmt: "num", tickFormat: ",.0f" })} height={300} />
          </div>
        </Card>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card title="ROE vs P/B" sub="quality against price" flush>
          <div style={{ padding: "8px 6px" }}><Plot figure={scatter} height={268} /></div>
        </Card>
        <Card title="Growth vs EV/EBITDA" sub="growth against multiple" flush>
          <div style={{ padding: "8px 6px" }}><Plot figure={scatter2} height={268} /></div>
        </Card>
      </div>
    </>
  );
}

