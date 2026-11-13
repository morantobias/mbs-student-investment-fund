import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { MBS, fmtDate, fmtMoney, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import { useApp } from "../App.js";
import type { Assumptions, ValuationResult } from "../../core/valuation.js";
import { PageHead } from "../components/PageHead.js";
import { Card, Empty, NoticeBanner, Spinner } from "../components/ui.js";
import { IconDownload, IconPrint } from "../components/icons.js";

export function ExportPage() {
  const { snapshot, loading, valuation, assumptions } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const v = valuation?.valuation ?? null;

  const rows = useMemo(() => {
    if (!snapshot?.ok || !assumptions) return null;
    return {
      summary: buildSummarySheet(snapshot, v),
      financials: budgetSheet(snapshot),
      ratios: ratiosSheet(snapshot),
      peers: peersSheet(snapshot),
      methods: methodsSheet(v),
      assumptions: assumptionsSheet(assumptions),
      projections: projectionsSheet(v),
    };
  }, [snapshot, v, assumptions]);

  if (loading && !snapshot) {
    return (
      <>
        <PageHead title="Notes & export" />
        <Card><Spinner /></Card>
      </>
    );
  }
  if (!snapshot?.ok || !rows || !v || !assumptions) {
    return (
      <>
        <PageHead title="Notes & export" />
        <Card><Empty title="Nothing to export" message={snapshot?.error ?? "Load a company first."} /></Card>
      </>
    );
  }

  const fileBase = `${snapshot.code}_${snapshot.info.name.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40)}_${new Date().toISOString().slice(0, 10)}`;

  const downloadXlsx = () => {
    setBusy("xlsx");
    try {
      const wb = XLSX.utils.book_new();
      for (const [name, data] of Object.entries(rows)) {
        const ws = XLSX.utils.aoa_to_sheet(data as unknown as unknown[][]);
        const widths = (data as unknown as unknown[][]).reduce<number[]>((acc, row) => {
          row.forEach((cell, i) => {
            const len = cell === null || cell === undefined ? 4 : String(cell).length + 2;
            acc[i] = Math.max(acc[i] ?? 10, Math.min(len, 42));
          });
          return acc;
        }, []);
        (ws as unknown as { "!cols": { wch: number }[] })["!cols"] = widths.map((w) => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      }
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
    } finally {
      setBusy(null);
    }
  };

  const downloadCsv = (name: string, data: unknown[][]) => {
    const csv = data
      .map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : `"${String(cell).replace(/"/g, '""')}"`)).join(","))
      .join("\n");
    triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileBase}_${name}.csv`);
  };

  const openNote = () => {
    const html = researchNote(snapshot, v, assumptions);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const downloadNote = () => {
    const html = researchNote(snapshot, v, assumptions);
    triggerDownload(new Blob([html], { type: "text/html;charset=utf-8" }), `${fileBase}_research_note.html`);
  };

  return (
    <>
      <PageHead
        title="Notes & export"
        sub={`${snapshot.code} · ${snapshot.info.name} · prepared ${fmtDate(new Date())}`}
        actions={
          <>
            <button className="pill" onClick={() => window.print()}>
              <IconPrint /> Print / save as PDF
            </button>
          </>
        }
      />

      <NoticeBanner>
        Everything below is generated in your browser from the data already loaded — no server round-trip, nothing stored.
      </NoticeBanner>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Excel workbook" sub="seven sheets, ready to format">
          <p className="small muted" style={{ marginTop: 0 }}>
            Summary · financials · ratios · peer comps · valuation methods · assumptions · projections. Values are live
            numbers, not pictures, so the workbook stays editable.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="pill active" onClick={downloadXlsx} disabled={busy === "xlsx"}>
              <IconDownload /> {busy === "xlsx" ? "Building…" : "Download .xlsx"}
            </button>
            <button className="pill" onClick={() => downloadCsv("peer_comps", rows.peers)}>
              Peer comps CSV
            </button>
            <button className="pill" onClick={() => downloadCsv("ratios", rows.ratios)}>
              Ratios CSV
            </button>
          </div>
        </Card>

        <Card title="Research note" sub="MBS-formatted, print-ready">
          <p className="small muted" style={{ marginTop: 0 }}>
            A one-page draft note in the Fund&apos;s house style: verdict, key numbers, valuation summary, risks and
            disclaimer. Open it, then print to PDF or paste into Word.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="pill active" onClick={openNote}>
              Open note
            </button>
            <button className="pill" onClick={downloadNote}>
              <IconDownload /> Download .html
            </button>
          </div>
        </Card>
      </div>

      <Card title="What is included" sub="sheet by sheet" flush>
        <div className="table-wrap">
          <table className="data compact">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Sheet</th>
                <th style={{ textAlign: "left" }}>Contents</th>
                <th>Rows</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rows).map(([name, data]) => (
                <tr key={name}>
                  <td style={{ textAlign: "left", fontWeight: 700, textTransform: "capitalize" }}>{name}</td>
                  <td style={{ textAlign: "left" }} className="small muted">
                    {SHEET_DESCRIPTIONS[name] ?? ""}
                  </td>
                  <td>{(data as unknown[][]).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

const SHEET_DESCRIPTIONS: Record<string, string> = {
  summary: "Company identity, quote, headline ratios, valuation verdict and recommendation",
  financials: "Income statement, balance sheet and cash flow by fiscal year ($ million)",
  ratios: "Margins, returns, leverage and growth by fiscal year",
  peers: "Peer set with multiples, returns and 1-year performance",
  methods: "Every valuation method, its value range, weight and weight used",
  assumptions: "The exact model inputs behind the current fair value",
  projections: "Forecast schedule from the intrinsic model",
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------
function buildSummarySheet(
  snapshot: NonNullable<ReturnType<typeof useApp>["snapshot"]>,
  val: ValuationResult | null,
): unknown[][] {
  const r = snapshot.ratios;
  return [
    ["MBS Student Investment Fund — company summary"],
    [],
    ["Company", snapshot.info.name],
    ["Code", snapshot.code],
    ["Sector", snapshot.info.sector],
    ["Industry", snapshot.info.industry],
    ["Model family", snapshot.info.family],
    ["Fiscal year", r.fyLabel],
    ["Period end", r.periodEnd],
    ["Prepared", new Date().toISOString().slice(0, 10)],
    [],
    ["Market data"],
    ["Price", r.price],
    ["52-week low", snapshot.quote.week52Low],
    ["52-week high", snapshot.quote.week52High],
    ["Shares on issue", r.sharesOut],
    ["Market capitalisation", r.marketCap],
    ["Enterprise value", r.enterpriseValue],
    ["Net debt", r.netDebt],
    [],
    ["Headline metrics"],
    ["Revenue", r.revenue],
    ["EBITDA", r.ebitda],
    ["Net income", r.netIncome],
    ["EPS", r.eps],
    ["DPS", r.dps],
    ["P/E", r.peRatio],
    ["P/B", r.pbRatio],
    ["EV/EBITDA", r.evEbitda],
    ["Dividend yield", r.dividendYield],
    ["ROE", r.roe],
    ["Net margin", r.netMargin],
    [],
    ["Valuation"],
    ["Ke", val?.ke ?? null],
    ["WACC", val?.wacc ?? null],
    ["Weighted fair value", val?.weightedValue ?? null],
    ["Upside / (downside)", val?.upside ?? null],
    ["Recommendation", val?.recommendation ?? null],
    ["Basis", val?.headlineBasis === "fc" ? "Including franking credits" : "Excluding franking credits"],
  ];
}

function budgetSheet(snapshot: NonNullable<ReturnType<typeof useApp>["snapshot"]>): unknown[][] {
  const fin = snapshot.fin;
  const rows: [string, string, (v: number | null) => number | null][] = [
    ["Revenue", "revenue", (x) => (x === null ? null : x / 1e6)],
    ["EBITDA", "ebitda", (x) => (x === null ? null : x / 1e6)],
    ["EBIT", "ebit", (x) => (x === null ? null : x / 1e6)],
    ["Net income", "net_income", (x) => (x === null ? null : x / 1e6)],
    ["EPS", "eps", (x) => x],
    ["DPS", "dps", (x) => x],
    ["Total assets", "total_assets", (x) => (x === null ? null : x / 1e6)],
    ["Total debt", "total_debt", (x) => (x === null ? null : x / 1e6)],
    ["Equity", "equity", (x) => (x === null ? null : x / 1e6)],
    ["Operating cash flow", "ocf", (x) => (x === null ? null : x / 1e6)],
    ["Capex", "capex", (x) => (x === null ? null : x / 1e6)],
    ["Free cash flow", "fcf", (x) => (x === null ? null : x / 1e6)],
    ["Dividends paid", "dividends_paid", (x) => (x === null ? null : x / 1e6)],
  ];
  return [
    ["Financial summary ($ million unless stated)"],
    ["Line item", ...fin.map((f) => f.label as string)],
    ...rows.map(([label, key, scale]) => [label, ...fin.map((f) => scale(f[key] as number | null))]),
  ];
}

function ratiosSheet(snapshot: NonNullable<ReturnType<typeof useApp>["snapshot"]>): unknown[][] {
  const fin = snapshot.fin;
  const keys: [string, string][] = [
    ["Gross margin", "gross_margin"],
    ["EBITDA margin", "ebitda_margin"],
    ["EBIT margin", "ebit_margin"],
    ["Net margin", "net_margin"],
    ["ROE", "roe"],
    ["ROA", "roa"],
    ["ROIC", "roic"],
    ["Equity / assets", "equity_assets"],
    ["Debt / equity", "debt_equity"],
    ["Net debt / EBITDA", "net_debt_ebitda"],
    ["Interest coverage", "interest_coverage"],
    ["Cash conversion", "cash_conversion"],
    ["Revenue growth", "revenue_growth"],
    ["EPS growth", "eps_growth"],
  ];
  return [
    ["Ratio history"],
    ["Ratio", ...fin.map((f) => f.label as string)],
    ...keys.map(([label, key]) => [label, ...fin.map((f) => f[key] as number | null)]),
  ];
}

function peersSheet(snapshot: NonNullable<ReturnType<typeof useApp>["snapshot"]>): unknown[][] {
  const table = snapshot.peers?.table ?? [];
  const head = ["Code", "Name", "Market cap", "Price", "P/E", "P/B", "EV/EBITDA", "Dividend yield", "ROE", "Net margin", "Rev CAGR", "EPS CAGR", "1y return"];
  return [
    ["Peer comparison"],
    head,
    ...table.map((r) => [
      r.code,
      r.name,
      r.marketCap,
      r.price,
      r.peRatio,
      r.pbRatio,
      r.evEbitda,
      r.dividendYield,
      r.roe,
      r.netMargin,
      r.revenueCagr,
      r.epsCagr,
      r.return1y ?? null,
    ]),
  ];
}

function methodsSheet(val: ValuationResult | null): unknown[][] {
  if (!val) return [["Valuation methods"], ["No valuation available"]];
  return [
    ["Valuation methods"],
    ["Method", "Value (ex-franking)", "Value (incl. franking)", "Low", "High", "Weight", "Weight used", "In use", "Note"],
    ...val.methods.map((m) => [
      m.label,
      m.valueEx,
      m.valueFc,
      m.low,
      m.high,
      m.weight,
      m.weightUsed,
      m.inUse ? "Yes" : "No",
      m.note,
    ]),
    [],
    ["Weighted fair value (ex)", val.weightedValueEx],
    ["Weighted fair value (incl.)", val.weightedValueFc],
    ["Upside (ex)", val.mosEx],
    ["Upside (incl.)", val.mosFc],
    ["Recommendation", val.recommendation],
  ];
}

function assumptionsSheet(a: Assumptions): unknown[][] {
  return [
    ["Model assumptions"],
    ["Input", "Value"],
    ["Risk-free rate", a.rf],
    ["Beta", a.beta],
    ["Market risk premium", a.mrp],
    ["Cost of equity", a.rf + a.beta * a.mrp],
    ["Cost of debt", a.costOfDebt],
    ["Debt weight", a.debtWeight],
    ["Tax rate", a.taxRate],
    ["Terminal growth", a.terminalGrowth],
    ["Horizon", a.horizon],
    ["Franking", a.franking],
    ["Mid-year discounting", a.midyear ? "Yes" : "No"],
    ["Headline basis", a.headlineBasis],
    [],
    ["Method", "Weight"],
    ...Object.entries(a.weights).map(([k, w]) => [k, w]),
    [],
    ["Projection year", "Revenue growth / EPS growth", "EBIT margin / payout"],
    ...a.grid.map((g) => [g.label, g.revenueGrowth ?? g.epsGrowth ?? null, g.ebitMargin ?? g.payout ?? null]),
  ];
}

function projectionsSheet(val: ValuationResult | null): unknown[][] {
  if (!val) return [["Projections"], ["Not available"]];
  if (val.dcf) {
    return [
      ["FCFF projection ($ million)"],
      ["Year", "Revenue", "Growth", "EBIT", "EBIT margin", "NOPAT", "D&A", "Capex", "Δ NWC", "FCFF", "Discount factor", "PV"],
      ...val.dcf.schedule.map((s) => [
        s.label,
        s.revenue / 1e6,
        s.revenueGrowth,
        s.ebit / 1e6,
        s.ebitMargin,
        s.nopat / 1e6,
        s.da / 1e6,
        s.capex / 1e6,
        s.deltaNwc / 1e6,
        s.fcff / 1e6,
        s.discountFactor ?? null,
        (s.pvFcff ?? null) === null ? null : (s.pvFcff as number) / 1e6,
      ]),
    ];
  }
  const sched = val.ddm?.schedule ?? val.rim?.schedule ?? [];
  return [
    ["Earnings and dividend projection"],
    ["Year", "EPS", "EPS growth", "Payout", "DPS", "DPS incl. franking", "BVPS", "ROE"],
    ...sched.map((s) => [s.label, s.eps, s.epsGrowth, s.payout, s.dps, s.dpsGrossed ?? null, s.bvps, s.roe]),
  ];
}

// ---------------------------------------------------------------------------
// Research note (print-ready HTML in the Fund's house style)
// ---------------------------------------------------------------------------
function researchNote(
  snapshot: NonNullable<ReturnType<typeof useApp>["snapshot"]>,
  v: ValuationResult,
  a: Assumptions,
): string {
  const r = snapshot.ratios;
  const peers = snapshot.peers?.table ?? [];
  const med = (key: string) => {
    const vals = peers
      .filter((p) => p.code !== snapshot.code)
      .map((p) => (p as unknown as Record<string, number | null>)[key])
      .filter((x): x is number => x !== null && Number.isFinite(x) && x > 0)
      .sort((x, y) => x - y);
    if (!vals.length) return null;
    const m = Math.floor(vals.length / 2);
    return vals.length % 2 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
  };

  const peerPe = med("peRatio");
  const peerPb = med("pbRatio");
  const verdict = v.recommendation;
  const upside = v.upside ?? 0;

  const summary = [
    `${snapshot.info.name} (${snapshot.code}) trades at ${fmtRatio(r.peRatio)} FY${String(r.fy).slice(2)} earnings and ${fmtRatio(r.pbRatio)} book value`,
    peerPe !== null ? `, against peer medians of ${fmtRatio(peerPe)} and ${fmtRatio(peerPb)}` : "",
    `. Return on equity was ${fmtPct(r.roe)} with a ${fmtPct(r.netMargin)} net margin and ${fmtPct(r.dividendYield)} dividend yield`,
    r.grossedYield !== null ? ` (${fmtPct(r.grossedYield)} grossed up for franking)` : "",
    ".",
  ].join("");

  const recommendation = `Our weighted fair value of ${fmtPrice(v.weightedValue)} per share implies ${fmtPct(upside, 1, true)} ${
    upside >= 0 ? "upside" : "downside"
  } from the ${fmtPrice(v.price)} last traded price, supporting a ${verdict.toUpperCase()} recommendation under the Fund's ${fmtPct(
    10,
    0,
  )} buy / ${fmtPct(-5, 0)} sell thresholds.`;

  const methodRows = v.methods
    .filter((m) => m.available)
    .map(
      (m) => `<tr><td>${m.label}</td><td>${fmtPrice(v.headlineBasis === "fc" ? m.valueFc : m.valueEx)}</td><td>${
        m.inUse ? `${Math.round(m.weightUsed * 100)}%` : "–"
      }</td></tr>`,
    )
    .join("");

  const finRows = snapshot.fin
    .map(
      (f) => `<tr><td>${f.label}</td><td>${fmtMoney(f.revenue as number)}</td><td>${fmtMoney(f.net_income as number)}</td><td>${fmtPct(
        f.roe as number,
      )}</td></tr>`,
    )
    .join("");

  const risks = [
    `Beta of ${fmtRatio(snapshot.metrics?.beta, 2, "")} against the ASX 200 and annualised volatility of ${fmtPct(
      snapshot.metrics?.annVol,
    )} place the stock in the ${(snapshot.metrics?.annVol ?? 0) > 0.3 ? "higher" : "moderate"} risk band for the portfolio.`,
    `Maximum drawdown over the period was ${fmtPct(snapshot.metrics?.maxDrawdown)}, with the shares currently ${fmtPct(
      snapshot.metrics?.currentDrawdown,
    )} below their prior peak.`,
    r.netDebtEbitda !== null
      ? `Leverage sits at ${fmtRatio(r.netDebtEbitda)} net debt to EBITDA with interest cover of ${fmtRatio(r.interestCoverage)}.`
      : `Capital intensity is measured by an equity-to-assets ratio of ${fmtPct(r.equityAssets)}.`,
    `Terminal value represents ${fmtPct(v.dcf?.tvShare ?? v.ddm?.tvShare ?? null, 0)} of the modelled value, so the recommendation is sensitive to the ${fmtPct(
      a.terminalGrowth,
    )} terminal growth assumption.`,
  ]
    .map((x) => `<li>${x}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><title>${snapshot.code} — MBS SIF research note</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif; color: #212121; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  .sheet { max-width: 190mm; margin: 0 auto; padding: 10mm 0; }
  .band { background: #A30046; color: #fff; padding: 14px 18px; }
  .band h1 { margin: 0; font-size: 20pt; letter-spacing: -0.02em; }
  .band .sub { opacity: .85; font-size: 9pt; text-transform: uppercase; letter-spacing: .12em; }
  .verdict { display: flex; gap: 18px; align-items: center; border-bottom: 2px solid #A30046; padding: 12px 0; }
  .pill { background: ${verdict === "Buy" ? "#1E7A46" : verdict === "Sell" ? "#C0392B" : "#B7791F"}; color: #fff; padding: 4px 14px; border-radius: 99px; font-weight: 700; font-size: 10pt; }
  h2 { color: #5E0028; font-size: 11.5pt; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid #D9BFCB; padding-bottom: 3px; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th { background: #F2E3EA; color: #5E0028; text-align: right; padding: 5px 8px; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; }
  th:first-child, td:first-child { text-align: left; }
  td { padding: 4px 8px; border-bottom: 1px solid #EDE3E8; text-align: right; }
  .kv { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px 18px; }
  .kv div span { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: .07em; color: #8C8C8C; }
  .kv div strong { font-size: 12pt; }
  .note { font-size: 8pt; color: #8C8C8C; margin-top: 18px; border-top: 1px solid #EDE3E8; padding-top: 8px; }
  ul { margin: 6px 0 0 16px; padding: 0; }
  li { margin-bottom: 4px; }
</style></head>
<body><div class="sheet">
  <div class="band">
    <div class="sub">Melbourne Business School · Student Investment Fund</div>
    <h1>${snapshot.info.name} (${snapshot.code})</h1>
    <div class="sub">${snapshot.info.sector} · ${snapshot.info.industry} · ${fmtDate(new Date())}</div>
  </div>

  <div class="verdict">
    <span class="pill">${verdict.toUpperCase()}</span>
    <div><strong>Fair value ${fmtPrice(v.weightedValue)}</strong> vs price ${fmtPrice(v.price)} (${fmtPct(upside, 1, true)})</div>
  </div>

  <div class="kv" style="margin-top:14px">
    <div><span>Market cap</span><strong>${fmtMoney(r.marketCap)}</strong></div>
    <div><span>P/E</span><strong>${fmtRatio(r.peRatio)}</strong></div>
    <div><span>P/B</span><strong>${fmtRatio(r.pbRatio)}</strong></div>
    <div><span>Dividend yield</span><strong>${fmtPct(r.dividendYield)}</strong></div>
    <div><span>ROE</span><strong>${fmtPct(r.roe)}</strong></div>
    <div><span>Net margin</span><strong>${fmtPct(r.netMargin)}</strong></div>
    <div><span>Revenue CAGR</span><strong>${fmtPct(r.revenueCagr)}</strong></div>
    <div><span>Beta</span><strong>${fmtRatio(snapshot.metrics?.beta, 2, "")}</strong></div>
  </div>

  <h2>Investment summary</h2>
  <p>${summary}</p>
  <p>${recommendation}</p>

  <h2>Valuation</h2>
  <table><thead><tr><th>Method</th><th>Value per share</th><th>Weight</th></tr></thead><tbody>${methodRows}</tbody></table>

  <h2>Financial summary</h2>
  <table><thead><tr><th>Year</th><th>Revenue</th><th>Net income</th><th>ROE</th></tr></thead><tbody>${finRows}</tbody></table>

  <h2>Key risks</h2>
  <ul>${risks}</ul>

  <div class="note">
    Prepared with the MBS SIF equity research workstation. Market data from Yahoo Finance (delayed). Model inputs:
    Ke ${fmtPct(v.ke)}, WACC ${fmtPct(v.wacc)}, terminal growth ${fmtPct(a.terminalGrowth)}, horizon ${a.horizon} years,
    ${v.headlineBasis === "fc" ? "including" : "excluding"} franking credits. This document is a student exercise and is
    not investment advice.
  </div>
</div></body></html>`;
}

export const _styles = MBS;
