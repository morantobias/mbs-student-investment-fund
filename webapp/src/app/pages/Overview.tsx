import { useMemo, useState } from "react";
import { fmtDate, fmtPct, fmtPrice, fmtRatio, fmtMoney, fmtInt, MBS } from "../../core/brand.js";
import { footballField } from "../../core/valuation.js";
import { useApp } from "../App.js";
import { LegendChips, Plot, type SeriesDef } from "../components/Plot.js";
import { CompanyStrip, PageHead, Pct } from "../components/PageHead.js";
import { Card, DataTable, Empty, KeyValues, RecBadge, Spinner, Tile, Tiles, type Column } from "../components/ui.js";
import { lineFig, barFig, footballFig } from "../charts.js";
import type { PerfRow } from "../../core/types.js";

export function OverviewPage() {
  const { snapshot, loading, valuation, navigate } = useApp();
  const [active, setActive] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const priceSeries: SeriesDef[] = useMemo(
    () => [
      { key: "close", label: "Close", colour: MBS.primary },
      { key: "sma50", label: "SMA 50", colour: "#eda100" },
      { key: "sma200", label: "SMA 200", colour: "#2a78d6" },
    ],
    [],
  );

  if (loading && !snapshot) {
    return (
      <>
        <PageHead title="Overview" sub="Loading company…" />
        <Card><Spinner label="Pulling quote, statements and peers from Yahoo Finance…" /></Card>
      </>
    );
  }

  if (!snapshot?.ok) {
    return (
      <>
        <PageHead title="Overview" />
        <Card>
          <Empty
            title="No company loaded"
            message={snapshot?.error ?? "Search an ASX code above to begin."}
          />
        </Card>
      </>
    );
  }

  const { ratios: r, tech, perf, info } = snapshot;
  const v = valuation?.valuation;
  const latest = tech?.latest;

  const priceFig = lineFig({
    series: [
      {
        key: "close",
        label: "Close",
        colour: MBS.primary,
        points: (tech?.series ?? []).map((d) => ({ x: d.date, y: d.close })),
        width: 2.2,
      },
      {
        key: "sma50",
        label: "SMA 50",
        colour: "#eda100",
        points: (tech?.series ?? []).map((d) => ({ x: d.date, y: d.sma50 })),
        width: 1.3,
      },
      {
        key: "sma200",
        label: "SMA 200",
        colour: "#2a78d6",
        points: (tech?.series ?? []).map((d) => ({ x: d.date, y: d.sma200 })),
        width: 1.3,
      },
    ],
    active,
    hidden,
    fmt: "price",
    tickFormat: "$,.0f",
  });

  const ff = v ? footballField(snapshot.quote, v, valuation?.scenarios, undefined) : [];

  const revenue = snapshot.fin.map((f) => f.revenue as number | null);
  const netIncome = snapshot.fin.map((f) => f.net_income as number | null);
  const finFig = barFig({
    categories: snapshot.fin.map((f) => f.label as string),
    series: [
      { key: "rev", label: "Revenue", colour: "#2a78d6", values: revenue.map((x) => (x === null ? null : x / 1e6)) },
      { key: "ni", label: "Net income", colour: MBS.primary, values: netIncome.map((x) => (x === null ? null : x / 1e6)) },
    ],
    fmt: "money",
    yTitle: "$ million",
  });

  const perfCols: Column<PerfRow>[] = [
    { key: "period", header: "Period", align: "left", render: (row) => row.period },
    { key: "stock", header: info.code, render: (row) => <Pct value={row.stock} /> },
    { key: "bench", header: "ASX 200", render: (row) => <Pct value={row.benchmark} /> },
    { key: "rel", header: "Relative", render: (row) => <Pct value={row.relative} /> },
  ];

  return (
    <>
      <PageHead
        title="Company overview"
        sub={
          <>
            {info.name} · {info.industry} · last price {fmtDate(snapshot.quote.symbol ? snapshot.metrics?.lastDate : null)}
          </>
        }
        actions={
          <button className="pill" onClick={() => navigate("valuation")}>
            Open valuation →
          </button>
        }
      />
      <CompanyStrip />

      <Tiles>
        <Tile label="Market cap" value={fmtMoney(r.marketCap)} note={`EV ${fmtMoney(r.enterpriseValue)}`} accent />
        <Tile label="P/E" value={fmtRatio(r.peRatio)} note={r.eps !== null ? `EPS ${fmtPrice(r.eps)}` : undefined} />
        <Tile label="P/B" value={fmtRatio(r.pbRatio)} note={r.bvps !== null ? `BVPS ${fmtPrice(r.bvps)}` : undefined} />
        <Tile
          label="Dividend yield"
          value={fmtPct(r.dividendYield)}
          note={r.grossedYield !== null ? `${fmtPct(r.grossedYield)} franked` : undefined}
        />
        <Tile
          label="ROE"
          value={fmtPct(r.roe)}
          note={r.roePrior !== null ? `prior ${fmtPct(r.roePrior)}` : undefined}
          tone={r.roe !== null && r.roePrior !== null ? (r.roe >= r.roePrior ? "pos" : "neg") : undefined}
        />
        <Tile
          label={v?.isFinancial ? "Equity / assets" : "Net debt / EBITDA"}
          value={v?.isFinancial ? fmtPct(r.equityAssets) : fmtRatio(r.netDebtEbitda)}
          note={v?.isFinancial ? `leverage ${fmtRatio(r.leverage)}` : `cover ${fmtRatio(r.interestCoverage)}`}
        />
        <Tile
          label="52-week position"
          value={latest?.pos52 !== null && latest?.pos52 !== undefined ? fmtPct(latest.pos52, 0) : "–"}
          note={snapshot.tech ? `${fmtPrice(latest?.lo52)} – ${fmtPrice(latest?.hi52)}` : undefined}
        />
      </Tiles>

      <div className="grid main-side" style={{ marginTop: 16 }}>
        <Card
          title="Share price"
          sub="daily close with moving averages"
          flush
          actions={<span className="small muted">Drag to zoom · double-click to reset</span>}
        >
          <LegendChips
            series={priceSeries}
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
          <div style={{ padding: "0 10px 10px" }}>
            <Plot figure={priceFig} height={286} />
          </div>
        </Card>

        <div className="stack">
          <Card title="Valuation summary" sub={v ? `${v.methods.filter((m) => m.inUse).length} methods in use` : undefined}>
            {v ? (
              <div className="stack" style={{ gap: 12 }}>
                <div className="row" style={{ alignItems: "baseline", gap: 12 }}>
                  <div>
                    <div className="tile-label">Weighted fair value</div>
                    <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-0.02em", color: MBS.dark }}>
                      {fmtPrice(v.weightedValue)}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <RecBadge rec={v.recommendation} />
                    <div className={`small ${(v.upside ?? 0) >= 0 ? "pos" : "neg"}`} style={{ fontWeight: 700, marginTop: 3 }}>
                      {fmtPct(v.upside, 1, true)} vs {fmtPrice(v.price)}
                    </div>
                  </div>
                </div>
                <div className="hr" style={{ margin: "2px 0" }} />
                <table className="data compact">
                  <tbody>
                    {v.methods
                      .filter((m) => m.available)
                      .map((m) => (
                        <tr key={m.method}>
                          <td style={{ textAlign: "left" }}>{m.label}</td>
                          <td className="num">{fmtPrice(m.valueEx)}</td>
                          <td style={{ width: 56 }}>
                            <span className={`method-chip${m.inUse ? " used" : ""}`}>{m.inUse ? `${Math.round(m.weightUsed * 100)}%` : "–"}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <button className="pill" onClick={() => navigate("valuation")}>
                  Adjust assumptions →
                </button>
              </div>
            ) : (
              <Empty title="Valuation unavailable" message="The model needs earnings or dividend data for this company." />
            )}
          </Card>
        </div>
      </div>

      <div className="grid main-side" style={{ marginTop: 16 }}>
        <Card title="Football field" sub="valuation ranges by method" flush>
          {ff.length > 1 ? (
            <div style={{ padding: "8px 10px 6px" }}>
              <Plot figure={footballFig(ff, v?.price ?? snapshot.quote.price)} height={250} />
            </div>
          ) : (
            <Empty title="Not enough methods" message="Peer or intrinsic methods are unavailable for this company." />
          )}
        </Card>

        <Card title="Performance" sub="total return vs ASX 200">
          <DataTable
            columns={perfCols}
            rows={perf}
            rowKey={(row) => row.period}
            compact
            note="Adjusted for dividends and splits."
          />
        </Card>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Revenue and earnings" sub="reported, $ million" flush>
          <div style={{ padding: "10px 10px 4px" }}>
            <Plot figure={finFig} height={250} />
          </div>
        </Card>

        <Card title="Risk snapshot" sub={`trailing ${snapshot.period}`}>
          <div className="grid cols-2" style={{ gap: 10 }}>
            <KeyValues
              rows={[
                ["Beta vs ASX 200", fmtRatio(snapshot.metrics?.beta, 2, "")],
                ["Annualised vol", fmtPct(snapshot.metrics?.annVol)],
                ["Max drawdown", fmtPct(snapshot.metrics?.maxDrawdown)],
                ["Sharpe", fmtRatio(snapshot.metrics?.sharpe, 2, "")],
              ]}
            />
            <KeyValues
              rows={[
                ["Alpha (ann.)", fmtPct(snapshot.metrics?.alpha)],
                ["Tracking error", fmtPct(snapshot.metrics?.trackingError)],
                ["RSI (14)", latest?.rsi14?.toFixed(1) ?? "–"],
                ["Vol vs 20d avg", fmtPct(latest?.volVsAvg)],
              ]}
            />
          </div>
          <div className="hr" />
          <KeyValues
            rows={[
              ["Shares on issue", fmtInt(r.sharesOut)],
              ["Free float value", fmtMoney(r.marketCap)],
              ["Net debt", fmtMoney(r.netDebt)],
              ["Cash & investments", fmtMoney(r.cash)],
            ]}
          />
        </Card>
      </div>
    </>
  );
}
