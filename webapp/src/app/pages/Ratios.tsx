import { useMemo, useState } from "react";
import { MBS, fmtNum, fmtPct, fmtRatio } from "../../core/brand.js";
import { dupontTable, peerPercentiles } from "../../core/analytics.js";
import { useApp } from "../App.js";
import { Plot } from "../components/Plot.js";
import { CompanyStrip, PageHead } from "../components/PageHead.js";
import { Card, Empty, ScoreBar, Seg, Spinner } from "../components/ui.js";
import { lineFig } from "../charts.js";
import type { FinRow } from "../../core/types.js";

interface RatioSpec {
  key: string;
  label: string;
  kind: "pct" | "x" | "num";
  hint?: string;
}

const GROUPS: { title: string; rows: RatioSpec[] }[] = [
  {
    title: "Profitability",
    rows: [
      { key: "gross_margin", label: "Gross margin", kind: "pct", hint: "Gross profit ÷ revenue" },
      { key: "ebitda_margin", label: "EBITDA margin", kind: "pct", hint: "EBITDA ÷ revenue" },
      { key: "ebit_margin", label: "EBIT margin", kind: "pct", hint: "EBIT ÷ revenue" },
      { key: "net_margin", label: "Net margin", kind: "pct", hint: "Net income ÷ revenue" },
      { key: "fcf_margin", label: "FCF margin", kind: "pct", hint: "Free cash flow ÷ revenue" },
    ],
  },
  {
    title: "Returns",
    rows: [
      { key: "roe", label: "Return on equity", kind: "pct", hint: "Net income ÷ average equity" },
      { key: "roa", label: "Return on assets", kind: "pct", hint: "Net income ÷ average total assets" },
      { key: "roic", label: "Return on invested capital", kind: "pct", hint: "NOPAT ÷ average invested capital" },
      { key: "cash_conversion", label: "Cash conversion", kind: "x", hint: "Operating cash flow ÷ net income" },
    ],
  },
  {
    title: "Leverage & liquidity",
    rows: [
      { key: "equity_assets", label: "Equity / assets", kind: "pct", hint: "Common equity ÷ total assets" },
      { key: "debt_equity", label: "Debt / equity", kind: "x", hint: "Total debt ÷ equity" },
      { key: "net_debt_ebitda", label: "Net debt / EBITDA", kind: "x", hint: "Net debt ÷ EBITDA" },
      { key: "interest_coverage", label: "Interest coverage", kind: "x", hint: "EBIT ÷ net interest expense" },
      { key: "leverage", label: "Equity multiplier", kind: "x", hint: "Average assets ÷ average equity (DuPont)" },
    ],
  },
  {
    title: "Growth (YoY)",
    rows: [
      { key: "revenue_growth", label: "Revenue growth", kind: "pct" },
      { key: "ebitda_growth", label: "EBITDA growth", kind: "pct" },
      { key: "eps_growth", label: "EPS growth", kind: "pct" },
      { key: "dps_growth", label: "DPS growth", kind: "pct" },
      { key: "bvps_growth", label: "BVPS growth", kind: "pct" },
    ],
  },
];

function fmtRatioCell(v: number | null, kind: RatioSpec["kind"]): string {
  if (v === null) return "–";
  return kind === "pct" ? fmtPct(v) : kind === "x" ? fmtRatio(v) : fmtNum(v, 2);
}

export function RatiosPage() {
  const { snapshot, loading } = useApp();
  const [view, setView] = useState<"history" | "dupont" | "percentile">("history");

  const fin = snapshot?.fin ?? [];
  const labels = fin.map((f) => f.label as string);
  const dupont = useMemo(() => dupontTable(fin), [fin]);
  const percentiles = useMemo(
    () =>
      snapshot?.peers
        ? peerPercentiles(snapshot.peers.table, snapshot.code, [
            "roe",
            "netMargin",
            "roic",
            "peRatio",
            "pbRatio",
            "evEbitda",
            "dividendYield",
            "revenueCagr",
            "epsCagr",
          ])
        : [],
    [snapshot],
  );

  if (loading && !snapshot) {
    return (
      <>
        <PageHead title="Ratios" />
        <Card><Spinner label="Computing ratios…" /></Card>
      </>
    );
  }
  if (!snapshot?.ok) {
    return (
      <>
        <PageHead title="Ratios" />
        <Card><Empty title="No ratio data" message={snapshot?.error ?? "Select a company first."} /></Card>
      </>
    );
  }

  const returnsFig = lineFig({
    series: [
      { key: "roe", label: "ROE", colour: MBS.primary, points: fin.map((f) => ({ x: f.label as string, y: f.roe as number | null })) },
      { key: "roic", label: "ROIC", colour: "#2a78d6", points: fin.map((f) => ({ x: f.label as string, y: f.roic as number | null })) },
      { key: "roa", label: "ROA", colour: "#1baf7a", points: fin.map((f) => ({ x: f.label as string, y: f.roa as number | null })) },
    ],
    fmt: "pct",
    tickFormat: ".0%",
    legend: true,
  });

  const leverageFig = lineFig({
    series: snapshot.info.family === "bank" || snapshot.info.family === "insurer" || snapshot.info.family === "financial"
      ? [
          { key: "ea", label: "Equity / assets", colour: MBS.primary, points: fin.map((f) => ({ x: f.label as string, y: f.equity_assets as number | null })) },
          { key: "lev", label: "Equity multiplier", colour: "#eda100", points: fin.map((f) => ({ x: f.label as string, y: f.leverage as number | null })) },
        ]
      : [
          { key: "nde", label: "Net debt / EBITDA", colour: MBS.primary, points: fin.map((f) => ({ x: f.label as string, y: f.net_debt_ebitda as number | null })) },
          { key: "ic", label: "Interest cover", colour: "#2a78d6", points: fin.map((f) => ({ x: f.label as string, y: f.interest_coverage as number | null })) },
        ],
    fmt: "x",
    tickFormat: ",.1f",
    legend: true,
  });

  return (
    <>
      <PageHead
        title="Ratio analysis"
        sub={`${snapshot.code} · ${labels.length} fiscal years · latest ${snapshot.ratios.fyLabel}`}
        actions={
          <Seg
            options={[
              { value: "history", label: "History" },
              { value: "dupont", label: "DuPont" },
              { value: "percentile", label: "vs peers" },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />
      <CompanyStrip compact />

      <div className="grid cols-2">
        <Card title="Returns" sub="ROE, ROIC and ROA" flush>
          <div style={{ padding: "10px 8px 4px" }}><Plot figure={returnsFig} height={236} /></div>
        </Card>
        <Card title={snapshot.info.family === "bank" ? "Capital intensity" : "Leverage and coverage"} sub="times" flush>
          <div style={{ padding: "10px 8px 4px" }}><Plot figure={leverageFig} height={236} /></div>
        </Card>
      </div>

      {view === "history" && (
        <Card title="Ratio history" sub="click a column header to sort years" flush className="" >
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th style={{ textAlign: "left", minWidth: 230 }}>Ratio</th>
                  {labels.map((l) => <th key={l}>{l}</th>)}
                  <th>Latest</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((g) => (
                  <>
                    <tr key={g.title} className="group">
                      <td colSpan={labels.length + 2}>{g.title}</td>
                    </tr>
                    {g.rows.map((row) => {
                      const values = fin.map((f) => f[row.key] as number | null);
                      const latestVal = values.at(-1) ?? null;
                      return (
                        <tr key={row.key}>
                          <td style={{ textAlign: "left" }} title={row.hint}>
                            {row.label}
                          </td>
                          {values.map((v, i) => (
                            <td key={i} className={row.kind === "pct" && v !== null && v < 0 ? "neg" : undefined}>
                              {fmtRatioCell(v, row.kind)}
                            </td>
                          ))}
                          <td style={{ fontWeight: 700 }}>{fmtRatioCell(latestVal, row.kind)}</td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-note">
            Hover a ratio name for its definition. Averages use opening and closing balances where both are available.
          </div>
        </Card>
      )}

      {view === "dupont" && (
        <div className="grid main-side">
          <Card title="DuPont decomposition" sub="ROE = net margin × asset turnover × leverage" flush>
            <div className="table-wrap">
              <table className="data compact">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Year</th>
                    <th>Net margin</th>
                    <th>Asset turnover</th>
                    <th>Equity multiplier</th>
                    <th>ROE (DuPont)</th>
                    <th>ROE (reported)</th>
                  </tr>
                </thead>
                <tbody>
                  {dupont.map((d) => (
                    <tr key={d.label}>
                      <td style={{ textAlign: "left" }}>{d.label}</td>
                      <td>{fmtPct(d.netMargin)}</td>
                      <td>{fmtRatio(d.assetTurnover, 2, "x")}</td>
                      <td>{fmtRatio(d.leverage, 2, "x")}</td>
                      <td style={{ fontWeight: 700 }}>{fmtPct(d.roeDupont)}</td>
                      <td>{fmtPct(d.roe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-note">
              Differences between the two ROE columns come from average-balance timing and non-controlling interests.
            </div>
          </Card>
          <Card title="Latest decomposition" sub={snapshot.ratios.fyLabel}>
            <div className="stack" style={{ gap: 14 }}>
              {(() => {
                const d = dupont.at(-1);
                if (!d) return null;
                const items: [string, number | null, string][] = [
                  ["Net margin", d.netMargin, fmtPct(d.netMargin)],
                  ["Asset turnover", d.assetTurnover, fmtRatio(d.assetTurnover, 2, "x")],
                  ["Equity multiplier", d.leverage, fmtRatio(d.leverage, 2, "x")],
                ];
                return items.map(([label, value, display]) => (
                  <div key={label}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="small muted">{label}</span>
                      <strong className="num">{display}</strong>
                    </div>
                    <ScoreBar value={value === null ? null : Math.min(1, Math.abs(value))} />
                  </div>
                ));
              })()}
            </div>
          </Card>
        </div>
      )}

      {view === "percentile" && (
        <Card title="Percentile rank vs peer set" sub={`${snapshot.peers?.table.length ?? 0} companies including subject`}>
          {percentiles.length === 0 ? (
            <Empty title="No peer set" message="Peer data is still loading or unavailable for this company." />
          ) : (
            <div className="grid cols-2" style={{ gap: 20 }}>
              {percentiles.map((p) => (
                <div key={p.metric}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <span className="small" style={{ fontWeight: 600 }}>{METRIC_LABELS[p.metric] ?? p.metric}</span>
                    <span className="small num muted">
                      {p.value === null ? "–" : p.metric.toLowerCase().includes("ratio") || p.metric === "evEbitda" ? fmtRatio(p.value) : fmtPct(p.value)}
                      {p.percentile !== null && ` · ${Math.round(p.percentile * 100)}th`}
                    </span>
                  </div>
                  <ScoreBar value={p.percentile} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
}

const METRIC_LABELS: Record<string, string> = {
  roe: "Return on equity",
  netMargin: "Net margin",
  roic: "Return on invested capital",
  peRatio: "P/E (lower is cheaper)",
  pbRatio: "P/B (lower is cheaper)",
  evEbitda: "EV/EBITDA (lower is cheaper)",
  dividendYield: "Dividend yield",
  revenueCagr: "Revenue CAGR",
  epsCagr: "EPS CAGR",
};

export type { FinRow };
