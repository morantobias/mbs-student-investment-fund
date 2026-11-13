import { useEffect, useMemo, useState } from "react";
import { MBS, fmtMoney, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { compositeScores, screenTable } from "../../core/analytics.js";
import { rebaseSeries } from "../../core/normalise.js";
import { SECTORS } from "../../core/universe.js";
import { useApp } from "../App.js";
import { useSector } from "../hooks.js";
import { LegendChips, Plot } from "../components/Plot.js";
import { PageHead } from "../components/PageHead.js";
import { Card, DataTable, Empty, ScoreBar, Spinner, Tile, Tiles, type Column } from "../components/ui.js";
import { barFig, lineFig, scatterFig } from "../charts.js";
import type { Ratios } from "../../core/types.js";

export function SectorPage() {
  const { snapshot, navigate, setSymbol } = useApp();
  const [sector, setSector] = useState<string>(snapshot?.info.sector && sectorName(snapshot.info.sector) ? snapshot.info.sector : "Financials");
  const [maxPe, setMaxPe] = useState<number | "">("");
  const [maxPb, setMaxPb] = useState<number | "">("");
  const [minYield, setMinYield] = useState<number | "">("");
  const [minRoe, setMinRoe] = useState<number | "">("");
  const [minMcap, setMinMcap] = useState<number | "">("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>({ key: "marketCap", dir: "desc" });
  const [active, setActive] = useState<string | null>(null);

  const { data, loading, error } = useSector(sector, null, true);

  useEffect(() => {
    if (snapshot?.ok && snapshot.info.sector && sectorName(snapshot.info.sector)) setSector(snapshot.info.sector);
  }, [snapshot?.info.sector]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return screenTable(data.table, {
      peRatio: maxPe === "" ? null : [0, Number(maxPe)],
      pbRatio: maxPb === "" ? null : [0, Number(maxPb)],
      dividendYield: minYield === "" ? null : [Number(minYield) / 100, 1],
      roe: minRoe === "" ? null : [Number(minRoe) / 100, 5],
      marketCap: minMcap === "" ? null : [Number(minMcap) * 1e9, 1e15],
    });
  }, [data, maxPe, maxPb, minYield, minRoe, minMcap]);

  const scored = useMemo(() => compositeScores(filtered), [filtered]);

  const sorted = useMemo(() => {
    if (!sort) return scored;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...scored].sort((a, b) => {
      const va = (a as unknown as Record<string, number | null>)[sort.key];
      const vb = (b as unknown as Record<string, number | null>)[sort.key];
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return (va - vb) * dir;
    });
  }, [scored, sort]);

  const indexSeries = useMemo(() => {
    if (!data?.index?.length) return [];
    const rebased = rebaseSeries([{ code: `${sector} index`, rows: data.index }], "close");
    return rebased.map((r) => ({
      key: r.code,
      label: data.indexSymbol ?? r.code,
      colour: MBS.primary,
      points: r.points.map((p) => ({ x: p.date, y: p.value })),
    }));
  }, [data, sector]);

  const columns: Column<Ratios>[] = [
    {
      key: "code",
      header: "Company",
      align: "left",
      sortValue: (r) => r.code,
      render: (r) => (
        <button
          className="mono"
          style={{ background: "none", border: 0, padding: 0, fontWeight: 700, color: MBS.primary, cursor: "pointer" }}
          onClick={() => {
            setSymbol(r.ticker);
            navigate("overview");
          }}
          title={`Open ${r.name}`}
        >
          {r.code}
        </button>
      ),
    },
    { key: "name", header: "Name", align: "left", sortValue: (r) => r.name, render: (r) => <span className="small">{shortName(r.name)}</span>, width: "220px" },
    { key: "marketCap", header: "Mkt cap", sortValue: (r) => r.marketCap, render: (r) => fmtMoney(r.marketCap) },
    { key: "price", header: "Price", sortValue: (r) => r.price, render: (r) => fmtPrice(r.price) },
    { key: "peRatio", header: "P/E", sortValue: (r) => r.peRatio, render: (r) => fmtRatio(r.peRatio) },
    { key: "pbRatio", header: "P/B", sortValue: (r) => r.pbRatio, render: (r) => fmtRatio(r.pbRatio) },
    { key: "evEbitda", header: "EV/EBITDA", sortValue: (r) => r.evEbitda, render: (r) => fmtRatio(r.evEbitda) },
    { key: "dividendYield", header: "Yield", sortValue: (r) => r.dividendYield, render: (r) => fmtPct(r.dividendYield) },
    { key: "roe", header: "ROE", sortValue: (r) => r.roe, render: (r) => fmtPct(r.roe) },
    { key: "netMargin", header: "Net margin", sortValue: (r) => r.netMargin, render: (r) => fmtPct(r.netMargin) },
    { key: "revenueCagr", header: "Rev CAGR", sortValue: (r) => r.revenueCagr, render: (r) => fmtPct(r.revenueCagr) },
    {
      key: "return1y",
      header: "1y",
      sortValue: (r) => r.return1y ?? null,
      render: (r) => <span className={(r.return1y ?? 0) >= 0 ? "pos" : "neg"}>{fmtPct(r.return1y)}</span>,
    },
    {
      key: "scoreTotal",
      header: "Score",
      sortValue: (r) => (r as unknown as { scoreTotal: number | null }).scoreTotal,
      render: (r) => (
        <div style={{ width: 46 }}>
          <ScoreBar value={(r as unknown as { scoreTotal: number | null }).scoreTotal} />
        </div>
      ),
    },
  ];

  const scatter = data
    ? scatterFig({
        points: data.table
          .filter((r) => r.roe !== null && r.pbRatio !== null)
          .map((r) => ({
            key: r.code,
            label: r.name,
            x: r.roe as number,
            y: r.pbRatio as number,
            isSubject: r.code === snapshot?.code,
          })),
        xLabel: "ROE",
        yLabel: "P/B",
        xFmt: "pct",
        yFmt: "x",
      })
    : null;

  const mcapBars = data
    ? (() => {
        const rows = [...data.table].filter((r) => r.marketCap !== null).slice(0, 15);
        const fig = barFig({
          categories: rows.map((r) => r.code),
          series: [{ key: "mc", label: "Market cap", colour: MBS.primary, values: rows.map((r) => (r.marketCap === null ? null : r.marketCap / 1e9)) }],
          fmt: "num",
          horizontal: true,
          textLabels: true,
        });
        (fig.data[0] as Record<string, unknown>).marker = {
          color: rows.map((r) => (r.code === snapshot?.code ? MBS.primary : "rgba(163,0,70,0.32)")),
        };
        (fig.data[0] as Record<string, unknown>).hovertemplate = "$%{x:,.1f}bn<extra></extra>";
        return fig;
      })()
    : null;

  const returnBars = data
    ? (() => {
        const rows = [...data.table].filter((r) => r.return1y !== null).sort((a, b) => (b.return1y ?? 0) - (a.return1y ?? 0));
        return barFig({
          categories: rows.map((r) => r.code),
          series: [{ key: "r", label: "1y return", colour: MBS.primary, values: rows.map((r) => r.return1y ?? null) }],
          fmt: "pct",
          horizontal: true,
        });
      })()
    : null;

  return (
    <>
      <PageHead
        title="Sector & screener"
        sub={`Cross-sectional view of the ${sector} sector · ${data?.table.length ?? 0} companies with data`}
        actions={
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            style={{ height: 32, padding: "0 10px", border: "1px solid var(--mbs-border)", borderRadius: 7, background: "#fff", fontSize: 12.5 }}
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        }
      />

      {error && <Card><Empty title="Sector data unavailable" message={error} /></Card>}
      {loading && !data && <Card><Spinner label={`Loading ${sector} peers from Yahoo Finance — this can take a few seconds…`} /></Card>}

      {data && (
        <>
          <Tiles>
            <Tile label="Companies" value={filtered.length} note={`of ${data.table.length} in sector`} accent />
            <Tile label="Median P/E" value={fmtRatio(medianOf(filtered, "peRatio"))} note="positive multiples only" />
            <Tile label="Median P/B" value={fmtRatio(medianOf(filtered, "pbRatio"))} />
            <Tile label="Median yield" value={fmtPct(medianOf(filtered, "dividendYield"))} />
            <Tile label="Median ROE" value={fmtPct(medianOf(filtered, "roe"))} />
            <Tile label="Sector index" value={data.indexSymbol ?? "–"} note={`${data.index.length} sessions`} small />
          </Tiles>

          <Card title="Screen" sub="leave a field blank to ignore it" className="" >
            <div className="row wrap" style={{ gap: 12, alignItems: "flex-end" }}>
              <FilterField label="Max P/E" value={maxPe} onChange={setMaxPe} suffix="x" />
              <FilterField label="Max P/B" value={maxPb} onChange={setMaxPb} suffix="x" />
              <FilterField label="Min yield" value={minYield} onChange={setMinYield} suffix="%" />
              <FilterField label="Min ROE" value={minRoe} onChange={setMinRoe} suffix="%" />
              <FilterField label="Min market cap" value={minMcap} onChange={setMinMcap} suffix="$bn" />
              <button
                className="pill"
                onClick={() => {
                  setMaxPe("");
                  setMaxPb("");
                  setMinYield("");
                  setMinRoe("");
                  setMinMcap("");
                }}
              >
                Clear
              </button>
              <span className="spacer" />
              <span className="small muted">{sorted.length} matches</span>
            </div>
          </Card>

          <Card title={`${sector} companies`} sub="click a code to open it" flush>
            <DataTable
              columns={columns}
              rows={sorted}
              rowKey={(r) => r.ticker}
              rowClass={(r) => (r.code === snapshot?.code ? "subject" : "")}
              maxHeight={520}
              sort={sort}
              onSort={(key) => setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }))}
            />
          </Card>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="ROE vs P/B" sub="sector quality-price map" flush>
              <div style={{ padding: "8px 6px" }}>{scatter && <Plot figure={scatter} height={300} />}</div>
            </Card>
            <Card title={`${sector} index`} sub={data.indexSymbol ?? "sector benchmark"} flush>
              <LegendChips series={indexSeries} active={active} hidden={new Set()} onActive={setActive} onToggle={() => {}} />
              <div style={{ padding: "0 8px 6px" }}>
                {indexSeries.length ? (
                  <Plot figure={lineFig({ series: indexSeries, active, hidden: new Set(), fmt: "num", tickFormat: ",.0f" })} height={286} />
                ) : (
                  <Empty title="No index series" message={`No price history returned for ${data.indexSymbol ?? "the sector index"}.`} />
                )}
              </div>
            </Card>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16 }}>
            <Card title="Market capitalisation" sub="top 15 by size, $ billion" flush>
              <div style={{ padding: "8px 6px" }}>{mcapBars && <Plot figure={mcapBars} height={Math.max(260, (mcapBars.data.length ?? 1) * 20 + 200)} />}</div>
            </Card>
            <Card title="One-year total return" sub="all companies with history" flush>
              <div style={{ padding: "8px 6px" }}>
                {returnBars && <Plot figure={returnBars} height={Math.max(260, sorted.length * 18)} />}
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function sectorName(sector: string): boolean {
  return SECTORS.includes(sector);
}

function shortName(name: string): string {
  return name.length > 30 ? `${name.slice(0, 29)}…` : name;
}

function medianOf(rows: Ratios[], key: string): number | null {
  const vals = rows
    .map((r) => (r as unknown as Record<string, number | null>)[key])
    .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

function FilterField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  suffix?: string;
}) {
  return (
    <div className="field" style={{ width: 130 }}>
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          value={value}
          placeholder="any"
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          style={{ paddingRight: suffix ? 34 : 9 }}
        />
        {suffix && (
          <span className="muted small" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

