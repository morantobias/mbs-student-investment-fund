import { useMemo, useState } from "react";
import { MBS, fmtMoney, fmtPct, fmtPrice, fmtRatio } from "../../core/brand.js";
import {
  costOfEquity,
  footballField,
  reverseDcf,
  sensitivity1d,
  sensitivity2d,
  waccCalc,
  type Assumptions,
  type SensVar,
} from "../../core/valuation.js";
import { useApp } from "../App.js";
import { Plot } from "../components/Plot.js";
import { CompanyStrip, PageHead } from "../components/PageHead.js";
import { Badge, Card, DataTable, Empty, RecBadge, Seg, Spinner, Tile, Tiles, type Column } from "../components/ui.js";
import { barFig, bridgeFig, footballFig, heatFig, lineFig } from "../charts.js";

const pctInput = (v: number) => (v * 100).toFixed(2);
const fromPct = (s: string) => Number(s) / 100;

export function ValuationPage() {
  const { snapshot, loading, valuation, assumptions, setAssumptions, resetAssumptions, dirty } = useApp();
  const [sensVar, setSensVar] = useState<SensVar>("ke");

  const v = valuation?.valuation;
  const scen = valuation?.scenarios;

  const sens1d = useMemo(() => {
    if (!snapshot?.ok || !assumptions) return [];
    return sensitivity1d(snapshot.ratios, snapshot.peers?.table ?? null, assumptions, sensVar);
  }, [snapshot, assumptions, sensVar]);

  const sens2d = useMemo(() => {
    if (!assumptions) return null;
    return sensitivity2d(assumptions, { basis: assumptions.headlineBasis });
  }, [assumptions]);

  const reverse = useMemo(() => (assumptions ? reverseDcf(assumptions) : null), [assumptions]);

  if (loading && !snapshot) {
    return (
      <>
        <PageHead title="Valuation" />
        <Card><Spinner label="Building the model…" /></Card>
      </>
    );
  }
  if (!snapshot?.ok || !v || !assumptions) {
    return (
      <>
        <PageHead title="Valuation" />
        <Card><Empty title="Model unavailable" message={snapshot?.error ?? "Select a company with earnings history."} /></Card>
      </>
    );
  }

  const set = (patch: Partial<Assumptions>) => setAssumptions({ ...assumptions, ...patch });
  const ff = footballField(snapshot.quote, v, scen, sens1d);
  const ke = costOfEquity(assumptions.rf, assumptions.beta, assumptions.mrp);
  const wacc = waccCalc(ke, assumptions.costOfDebt, assumptions.taxRate, assumptions.debtWeight);

  const methodCols: Column<(typeof v.methods)[number]>[] = [
    { key: "label", header: "Method", align: "left", render: (m) => m.label },
    { key: "value", header: `Value (${v.headlineBasis === "fc" ? "incl. franking" : "ex-franking"})`, render: (m) => fmtPrice(v.headlineBasis === "fc" ? m.valueFc : m.valueEx) },
    { key: "low", header: "Low", render: (m) => (m.low === null ? "–" : fmtPrice(m.low)) },
    { key: "high", header: "High", render: (m) => (m.high === null ? "–" : fmtPrice(m.high)) },
    { key: "upside", header: "Upside", render: (m) => {
        const u = v.headlineBasis === "fc" ? m.upsideFc : m.upsideEx;
        return <span className={u === null ? "muted" : u >= 0 ? "pos" : "neg"}>{fmtPct(u, 1, true)}</span>;
      } },
    { key: "weight", header: "Weight", render: (m) => <span className={`method-chip${m.inUse ? " used" : ""}`}>{m.inUse ? `${Math.round(m.weightUsed * 100)}%` : "–"}</span> },
    { key: "note", header: "Note", align: "left", render: (m) => <span className="small muted">{m.note}</span> },
  ];

  const scenCols: Column<(typeof scen & object[])[number]>[] = [
    { key: "scenario", header: "Scenario", align: "left", render: (s) => s.scenario },
    { key: "weight", header: "Weight", render: (s) => fmtPct(s.weight, 0) },
    { key: "g", header: "Growth Δ", render: (s) => fmtPct(s.growthDelta, 1, true) },
    { key: "ke", header: "Ke", render: (s) => fmtPct(s.ke) },
    { key: "ex", header: "Value (ex)", render: (s) => fmtPrice(s.valueEx) },
    { key: "fc", header: "Value (incl.)", render: (s) => fmtPrice(s.valueFc) },
    { key: "mos", header: "Upside", render: (s) => {
        const m = v.headlineBasis === "fc" ? s.mosFc : s.mosEx;
        return <span className={m === null ? "muted" : m >= 0 ? "pos" : "neg"}>{fmtPct(m, 1, true)}</span>;
      } },
  ];

  const revenueScene = barFig({
    categories: scen?.filter((s) => s.scenario !== "Probability-weighted").map((s) => s.scenario) ?? [],
    series: [
      {
        key: "val",
        label: "Value per share",
        colour: MBS.primary,
        values: scen?.filter((s) => s.scenario !== "Probability-weighted").map((s) => (v.headlineBasis === "fc" ? s.valueFc : s.valueEx)) ?? [],
      },
    ],
    fmt: "price",
    textLabels: true,
  });
  if (v.price !== null) {
    Object.assign(revenueScene.layout as Record<string, unknown>, {
      shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: v.price, y1: v.price, line: { color: MBS.black, width: 1.2, dash: "dot" } }],
    });
  }

  const sensFig = lineFig({
    series: [
      {
        key: "val",
        label: "Value per share",
        colour: MBS.primary,
        points: sens1d.map((s) => ({ x: s.delta, y: v.headlineBasis === "fc" ? s.valueFc : s.valueEx })),
        width: 2.4,
      },
    ],
    fmt: "price",
  });
  Object.assign(sensFig.layout as Record<string, unknown>, {
    xaxis: {
      title: { text: SENS_LABELS[sensVar], font: { size: 10.5 } },
      tickformat: sensVar === "ke" || sensVar === "tg" ? "+.1%" : "+.0%",
      gridcolor: "#F3EDF0",
    },
    yaxis: { tickformat: "$,.0f", gridcolor: "#F3EDF0" },
    ...(v.price !== null
      ? {
          shapes: [{ type: "line", xref: "paper", x0: 0, x1: 1, y0: v.price, y1: v.price, line: { color: MBS.black, width: 1.2, dash: "dot" } }],
        }
      : {}),
  });

  const schedule = v.dcf?.schedule ?? v.ddm?.schedule ?? v.rim?.schedule ?? [];

  const bridge = v.dcf
    ? bridgeFig([
        { label: "PV of FCFF", value: v.dcf.pvFcffSum, kind: "abs" },
        { label: "PV of terminal", value: v.dcf.pvTerminal, kind: "rel" },
        { label: "Enterprise value", value: v.dcf.enterpriseValue, kind: "total" },
        { label: "Net debt", value: -assumptions.netDebt, kind: "rel" },
        { label: "Equity value", value: v.dcf.equityValue, kind: "total" },
      ])
    : null;

  return (
    <>
      <PageHead
        title="Valuation"
        sub={
          <>
            {snapshot.code} · {v.isFinancial ? "dividend / excess-returns framework" : "unlevered FCFF framework"} · recomputes instantly
          </>
        }
        actions={
          <>
            {dirty && <Badge kind="hold">Edited</Badge>}
            <button className="pill" onClick={resetAssumptions} disabled={!dirty}>
              Reset assumptions
            </button>
            <Seg
              options={[
                { value: "ex", label: "Ex-franking" },
                { value: "fc", label: "Incl. franking" },
              ]}
              value={assumptions.headlineBasis}
              onChange={(basis) => set({ headlineBasis: basis })}
            />
          </>
        }
      />
      <CompanyStrip compact />

      <div className="grid side-main">
        <div className="stack">
          <Card title="Assumptions" sub="live model inputs">
            <div className="grid cols-2" style={{ gap: 10 }}>
              <NumField label="Risk-free rate" value={pctInput(assumptions.rf)} onChange={(s) => set({ rf: fromPct(s) })} suffix="%" />
              <NumField label="Beta" value={assumptions.beta.toFixed(2)} step={0.05} onChange={(s) => set({ beta: Number(s) })} />
              <NumField label="Market risk premium" value={pctInput(assumptions.mrp)} onChange={(s) => set({ mrp: fromPct(s) })} suffix="%" />
              <NumField label="Terminal growth" value={pctInput(assumptions.terminalGrowth)} onChange={(s) => set({ terminalGrowth: fromPct(s) })} suffix="%" />
              <NumField label="Cost of debt" value={pctInput(assumptions.costOfDebt)} onChange={(s) => set({ costOfDebt: fromPct(s) })} suffix="%" />
              <NumField label="Debt weight" value={pctInput(assumptions.debtWeight)} onChange={(s) => set({ debtWeight: fromPct(s) })} suffix="%" />
              <NumField label="Tax rate" value={pctInput(assumptions.taxRate)} onChange={(s) => set({ taxRate: fromPct(s) })} suffix="%" />
              <NumField label="Horizon (years)" value={String(assumptions.horizon)} step={1} onChange={(s) => set({ horizon: Math.max(3, Math.min(10, Number(s))) })} />
            </div>

            <div className="hr" />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="tile-label">Cost of equity (CAPM)</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtPct(ke)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="tile-label">WACC</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: MBS.primary }}>{fmtPct(wacc)}</div>
              </div>
            </div>

            <div className="hr" />
            <label className="check">
              <input type="checkbox" checked={assumptions.midyear} onChange={(e) => set({ midyear: e.target.checked })} />
              Mid-year discounting
            </label>

            <div className="hr" />
            <div className="tile-label" style={{ marginBottom: 8 }}>Method weights</div>
            <div className="stack" style={{ gap: 8 }}>
              {(
                [
                  ["dcf", "FCFF DCF"],
                  ["ddm", "Dividend discount"],
                  ["rim", "Residual income"],
                  ["pe", "Peer P/E"],
                  ["pb", "Peer P/B"],
                  ["evEbitda", "Peer EV/EBITDA"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="row" style={{ gap: 10 }}>
                  <span className="small" style={{ flex: 1 }}>{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(assumptions.weights[key] * 100)}
                    onChange={(e) => set({ weights: { ...assumptions.weights, [key]: Number(e.target.value) / 100 } })}
                    style={{ width: 96 }}
                  />
                  <span className="mono" style={{ width: 34, textAlign: "right" }}>{Math.round(assumptions.weights[key] * 100)}%</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Projection grid" sub={v.isFinancial ? "EPS growth and payout" : "revenue growth and EBIT margin"}>
            <table className="data compact">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Year</th>
                  <th>{v.isFinancial ? "EPS growth" : "Growth"}</th>
                  <th>{v.isFinancial ? "Payout" : "EBIT margin"}</th>
                </tr>
              </thead>
              <tbody>
                {assumptions.grid.map((row, i) => (
                  <tr key={row.year}>
                    <td style={{ textAlign: "left" }}>{row.label}</td>
                    <td>
                      <input
                        type="number"
                        step={0.5}
                        value={pctInput((v.isFinancial ? row.epsGrowth : row.revenueGrowth) ?? 0)}
                        onChange={(e) => {
                          const next = [...assumptions.grid];
                          next[i] = v.isFinancial
                            ? { ...row, epsGrowth: fromPct(e.target.value) }
                            : { ...row, revenueGrowth: fromPct(e.target.value) };
                          set({ grid: next });
                        }}
                        style={{ width: 72, height: 26, padding: "0 6px", border: "1px solid var(--mbs-border)", borderRadius: 5, textAlign: "right" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step={0.5}
                        value={pctInput((v.isFinancial ? row.payout : row.ebitMargin) ?? 0)}
                        onChange={(e) => {
                          const next = [...assumptions.grid];
                          next[i] = v.isFinancial
                            ? { ...row, payout: fromPct(e.target.value) }
                            : { ...row, ebitMargin: fromPct(e.target.value) };
                          set({ grid: next });
                        }}
                        style={{ width: 72, height: 26, padding: "0 6px", border: "1px solid var(--mbs-border)", borderRadius: 5, textAlign: "right" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-note">Values in percent. Edits flow straight through every method and sensitivity.</div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Verdict" sub={`${Math.round(v.methods.filter((m) => m.inUse).length)} methods`}>
            <div className="grid" style={{ gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
              <div>
                <div className="tile-label">Weighted fair value per share</div>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", color: MBS.dark, lineHeight: 1.1 }}>
                  {fmtPrice(v.weightedValue)}
                </div>
                <div className="row" style={{ gap: 10, marginTop: 6 }}>
                  <RecBadge rec={v.recommendation} />
                  <span className={`delta ${(v.upside ?? 0) >= 0 ? "pos" : "neg"}`}>
                    {fmtPct(v.upside, 1, true)} vs {fmtPrice(v.price)}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="tile-label">Franking factor</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtRatio(v.frankingFactor, 3, "x")}</div>
                <div className="tile-label" style={{ marginTop: 8 }}>TV share of value</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {fmtPct(v.dcf?.tvShare ?? v.ddm?.tvShare ?? null, 0)}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Football field" sub="range of value by method" flush>
            <div style={{ padding: "8px 8px 4px" }}>
              <Plot figure={footballFig(ff, v.price)} height={Math.max(230, ff.length * 30)} />
            </div>
          </Card>

          <Card title="Methods" sub={`${v.methods.filter((m) => m.inUse).length} weighted`} flush>
            <DataTable columns={methodCols} rows={v.methods} rowKey={(m) => m.method} compact />
          </Card>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Scenarios" sub="weighted probability case" flush>
          <DataTable columns={scenCols} rows={scen ?? []} rowKey={(s) => s.scenario} compact />
          <div style={{ padding: "6px 8px 4px" }}>
            <Plot figure={revenueScene} height={190} />
          </div>
        </Card>

        <Card title="Sensitivity" sub={SENS_LABELS[sensVar]} flush actions={
          <div className="chart-toolbar">
            {(["ke", "growth", "tg", "margin"] as SensVar[]).map((k) => (
              <button key={k} className={`pill small${sensVar === k ? " active" : ""}`} onClick={() => setSensVar(k)}>
                {SENS_SHORT[k]}
              </button>
            ))}
          </div>
        }>
          <div style={{ padding: "6px 8px 4px" }}>
            <Plot figure={sensFig} height={230} />
          </div>
          <div className="chart-note">Dotted line is the current share price.</div>
        </Card>
      </div>

      {sens2d && (
        <Card title="Two-way sensitivity" sub={`${sens2d.method} · ${sens2d.xLabel} × ${sens2d.yLabel}`} flush className="" >
          <div className="table-wrap" style={{ overflow: "visible" }}>
            <div style={{ padding: "6px 8px 2px" }}>
              <Plot
                figure={heatFig({
                  x: sens2d.x,
                  y: sens2d.y,
                  matrix: sens2d.matrix,
                  xLabel: sens2d.xLabel,
                  yLabel: sens2d.yLabel,
                  subjectValue: v.price,
                })}
                height={320}
              />
            </div>
          </div>
        </Card>
      )}

      <div className="grid main-side" style={{ marginTop: 16 }}>
        <Card title={v.isFinancial ? "Dividend / earnings schedule" : "FCFF schedule"} sub={v.isFinancial ? "EPS, payout, DPS and book value" : "$ million"} flush>
          <div className="table-wrap" style={{ maxHeight: 340 }}>
            <table className="data compact">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Year</th>
                  {v.isFinancial ? (
                    <>
                      <th>EPS</th>
                      <th>Payout</th>
                      <th>DPS</th>
                      <th>DPS incl. franking</th>
                      <th>BVPS</th>
                      <th>ROE</th>
                    </>
                  ) : (
                    <>
                      <th>Revenue</th>
                      <th>EBIT</th>
                      <th>NOPAT</th>
                      <th>D&amp;A</th>
                      <th>Capex</th>
                      <th>Δ NWC</th>
                      <th>FCFF</th>
                      <th>PV</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => {
                  const fin = row as unknown as Record<string, number | null>;
                  return (
                    <tr key={row.year}>
                      <td style={{ textAlign: "left" }}>{row.label}</td>
                      {v.isFinancial ? (
                        <>
                          <td>{fmtPrice(fin.eps)}</td>
                          <td>{fmtPct(fin.payout)}</td>
                          <td>{fmtPrice(fin.dps)}</td>
                          <td>{fmtPrice(fin.dpsGrossed)}</td>
                          <td>{fmtPrice(fin.bvps)}</td>
                          <td>{fmtPct(fin.roe)}</td>
                        </>
                      ) : (
                        <>
                          <td>{fmtMoney(fin.revenue)}</td>
                          <td>{fmtMoney(fin.ebit)}</td>
                          <td>{fmtMoney(fin.nopat)}</td>
                          <td>{fmtMoney(fin.da)}</td>
                          <td>{fmtMoney(fin.capex)}</td>
                          <td>{fmtMoney(fin.deltaNwc)}</td>
                          <td style={{ fontWeight: 700 }}>{fmtMoney(fin.fcff)}</td>
                          <td>{fmtMoney(fin.pvFcff)}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {v.dcf && (
            <div className="table-note">
              Terminal value {fmtMoney(v.dcf.terminalValue)} at {fmtPct(v.dcf.terminalGrowth)} growth, discounted at {fmtPct(v.dcf.wacc)} — {fmtPct(v.dcf.tvShare, 0)} of enterprise value.
            </div>
          )}
          {v.ddm && (
            <div className="table-note">
              Terminal dividend {fmtPrice(v.ddm.terminalValue)} capitalised at {fmtPct(v.ddm.ke)} less {fmtPct(v.ddm.terminalGrowth)}; franking factor {fmtRatio(v.ddm.frankingFactor, 3, "x")}.
            </div>
          )}
        </Card>

        <div className="stack">
          {bridge ? (
            <Card title="Enterprise to equity bridge" sub="$ million" flush>
              <div style={{ padding: "6px 8px" }}><Plot figure={bridge} height={250} /></div>
            </Card>
          ) : (
            <Card title="Excess returns" sub="justified P/B">
              <div className="grid cols-2" style={{ gap: 10 }}>
                <div>
                  <div className="tile-label">Justified P/B</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtRatio(v.jpb?.justifiedPb)}</div>
                </div>
                <div>
                  <div className="tile-label">Value</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtPrice(v.jpb?.value)}</div>
                </div>
                <div>
                  <div className="tile-label">ROE − Ke spread</div>
                  <div className={`delta ${(v.jpb?.spread ?? 0) >= 0 ? "pos" : "neg"}`}>{fmtPct(v.jpb?.spread)}</div>
                </div>
                <div>
                  <div className="tile-label">Upside</div>
                  <div className={`delta ${(v.jpb?.upside ?? 0) >= 0 ? "pos" : "neg"}`}>{fmtPct(v.jpb?.upside, 1, true)}</div>
                </div>
              </div>
            </Card>
          )}

          {reverse && !v.isFinancial && (
            <Card title="Reverse DCF" sub="what the price implies">
              <div className="grid cols-2" style={{ gap: 10 }}>
                <div>
                  <div className="tile-label">Implied revenue growth</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtPct(reverse.impliedGrowth)}</div>
                </div>
                <div>
                  <div className="tile-label">Implied terminal growth</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtPct(reverse.impliedTerminalGrowth)}</div>
                </div>
              </div>
              <div className="table-note" style={{ marginTop: 8 }}>
                The uniform growth that would make the DCF equal today's price. Higher than your forecast implies the market is more optimistic than you.
              </div>
            </Card>
          )}

          <Card title="Peer multiples" sub={`${v.rel[0]?.nPeers ?? 0} peers`} flush>
            <DataTable
              columns={[
                { key: "label", header: "Method", align: "left", render: (r: (typeof v.rel)[number]) => r.label },
                { key: "company", header: "Company", render: (r) => fmtRatio(r.companyMultiple) },
                { key: "med", header: "Peer median", render: (r) => fmtRatio(r.multiple) },
                { key: "val", header: "Implied value", render: (r) => fmtPrice(r.value) },
              ]}
              rows={v.rel}
              rowKey={(r) => r.method}
              compact
            />
          </Card>
        </div>
      </div>

      <Tiles>
        <Tile label="Ke" value={fmtPct(v.ke)} note={`rf ${fmtPct(assumptions.rf)} + β ${assumptions.beta.toFixed(2)} × ${fmtPct(assumptions.mrp)}`} small />
        <Tile label="WACC" value={fmtPct(v.wacc)} note={`${fmtPct(assumptions.debtWeight, 0)} debt`} small />
        <Tile label="Ex-franking value" value={fmtPrice(v.weightedValueEx)} note={fmtPct(v.mosEx, 1, true)} small />
        <Tile label="Incl. franking value" value={fmtPrice(v.weightedValueFc)} note={fmtPct(v.mosFc, 1, true)} small />
        <Tile label="Method spread" value={fmtPct(methodSpread(v))} note="low to high" small />
        <Tile label="Terminal share" value={fmtPct(v.dcf?.tvShare ?? v.ddm?.tvShare ?? null, 0)} note="of total value" small />
      </Tiles>
    </>
  );
}

function methodSpread(v: { methods: { available: boolean; valueEx: number | null }[] }): number | null {
  const vals = v.methods.filter((m) => m.available && m.valueEx !== null).map((m) => m.valueEx!);
  if (vals.length < 2) return null;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  return lo > 0 ? hi / lo - 1 : null;
}

const SENS_LABELS: Record<SensVar, string> = {
  ke: "Cost of equity shift (bp)",
  growth: "Revenue / EPS growth shift",
  tg: "Terminal growth shift",
  margin: "EBIT margin shift",
};
const SENS_SHORT: Record<SensVar, string> = { ke: "Ke", growth: "Growth", tg: "Terminal", margin: "Margin" };

function NumField({
  label,
  value,
  onChange,
  step = 0.25,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        <input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} style={{ paddingRight: suffix ? 26 : 9 }} />
        {suffix && (
          <span className="muted small" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
