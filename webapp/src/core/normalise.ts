// Statement normalisation, derived ratios, price analytics and technicals.
// Ported 1:1 from app/R/data.R — same formulas, same column names, same edge cases.

import { cagr, correlation, covariance, safeDiv, sd } from "./brand.js";
import type {
  DividendRow,
  FinRow,
  PerfRow,
  PriceMetrics,
  PriceRow,
  Quote,
  Ratios,
  TechRow,
  Technicals,
  CompanyInfo,
} from "./types.js";

export type RawRow = { date: string; [key: string]: number | string | null | undefined };
export type StatementSet = { income: RawRow[]; balance: RawRow[]; cashflow: RawRow[] };

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};

/** Coalesce: first non-null. */
const co = (...xs: (number | null | undefined)[]): number | null => {
  for (const x of xs) if (x !== null && x !== undefined && Number.isFinite(x)) return x;
  return null;
};

/**
 * Normalise one statement: parse dates, coerce numerics, drop empty fiscal years,
 * and keep the most complete row when a year appears twice.
 */
export function tidyStatement(rows: RawRow[]): RawRow[] {
  if (!rows?.length) return [];
  const parsed: RawRow[] = rows
    .map((r) => ({ ...r, date: String(r.date ?? "").slice(0, 10) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));

  const cols = new Set<string>();
  for (const r of parsed) for (const k of Object.keys(r)) if (k !== "symbol" && k !== "date") cols.add(k);

  const keep = parsed.filter((r) => {
    let n = 0;
    for (const c of cols) if (num(r[c]) !== null) n++;
    return n > 0;
  });

  const withFy = keep.map((r) => {
    const fy = Number(r.date.slice(0, 4));
    let nOk = 0;
    for (const c of cols) if (num(r[c]) !== null) nOk++;
    return { row: r, fy, nOk };
  });

  // One row per fiscal year — the most complete wins.
  const best = new Map<number, { row: RawRow; nOk: number }>();
  for (const w of withFy) {
    const cur = best.get(w.fy);
    if (!cur || w.nOk > cur.nOk) best.set(w.fy, { row: w.row, nOk: w.nOk });
  }

  return [...best.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v.row)
    .map((r) => {
      const out: RawRow = { ...r };
      for (const k of Object.keys(out)) {
        if (k === "symbol" || k === "date") continue;
        out[k] = num(out[k]);
      }
      return out;
    });
}

// ---------------------------------------------------------------------------
// Canonical financial history — one row per fiscal year with a stable shape.
// ---------------------------------------------------------------------------
export function buildFin(st: StatementSet): FinRow[] | null {
  const inc = st.income ?? [];
  const bal = st.balance ?? [];
  const cf = st.cashflow ?? [];
  if (!inc.length && !bal.length) return null;

  const fyOf = (rows: RawRow[]) => rows.map((r) => Number(r.date.slice(0, 4))).filter(Number.isFinite);
  let years = [...new Set([...fyOf(inc), ...fyOf(bal), ...fyOf(cf)])].sort((a, b) => a - b);
  if (!years.length) return null;

  const pick = (rows: RawRow[], col: string, fy: number): number | null => {
    if (!rows.length) return null;
    const r = rows.find((x) => Number(x.date.slice(0, 4)) === fy);
    return r ? num(r[col]) : null;
  };
  const dateFor = (fy: number): string => {
    for (const rows of [inc, bal, cf]) {
      const r = rows.find((x) => Number(x.date.slice(0, 4)) === fy);
      if (r) return r.date;
    }
    return `${fy}-06-30`;
  };

  // Drop phantom fiscal years carrying a single field.
  const coreOk = (fy: number) =>
    [
      pick(inc, "total_revenue", fy),
      pick(inc, "net_income", fy),
      pick(bal, "total_assets", fy),
      pick(cf, "operating_cash_flow", fy),
    ].filter((v) => v !== null).length;
  years = years.filter((fy) => coreOk(fy) >= 2);
  if (!years.length) return null;

  const fin: FinRow[] = years.map((fy) => ({
    fy,
    date: dateFor(fy),
    label: `FY${String(fy).slice(2)}`,
  }));

  const set = (key: string, values: (number | null)[]) => {
    fin.forEach((row, i) => {
      row[key] = values[i];
    });
  };
  const col = (rows: RawRow[], c: string) => years.map((fy) => pick(rows, c, fy));

  // --- Income statement -----------------------------------------------------
  set("revenue", years.map((fy) => co(pick(inc, "total_revenue", fy), pick(inc, "operating_revenue", fy))));
  set("cost_of_revenue", col(inc, "cost_of_revenue"));
  set("gross_profit", col(inc, "gross_profit"));
  set("operating_expense", col(inc, "operating_expense"));
  set("operating_income", col(inc, "operating_income"));
  set("ebitda", years.map((fy) => co(pick(inc, "ebitda", fy), pick(inc, "normalized_ebitda", fy))));
  set("ebit", col(inc, "ebit"));
  set("interest_net", col(inc, "net_non_operating_interest_income_expense"));
  set("other_income", col(inc, "other_income_expense"));
  set("pretax_income", col(inc, "pretax_income"));
  set("tax", col(inc, "tax_provision"));
  set("net_income", col(inc, "net_income"));
  set("net_income_cont", col(inc, "net_income_continuous_operations"));
  set("normalised_income", col(inc, "normalized_income"));
  set("eps", years.map((fy) => co(pick(inc, "diluted_eps", fy), pick(inc, "basic_eps", fy))));
  set("eps_basic", col(inc, "basic_eps"));
  set("shares", years.map((fy) => co(pick(inc, "diluted_average_shares", fy), pick(inc, "basic_average_shares", fy))));
  set("shares_basic", col(inc, "basic_average_shares"));

  // --- Balance sheet --------------------------------------------------------
  set("total_assets", col(bal, "total_assets"));
  set("cash", col(bal, "cash_and_cash_equivalents"));
  set("st_investments", col(bal, "other_short_term_investments"));
  set("receivables", col(bal, "receivables"));
  set("net_ppe", col(bal, "net_ppe"));
  set("goodwill_intang", col(bal, "goodwill_and_other_intangible_assets"));
  set("total_liabilities", col(bal, "total_liabilities_net_minority_interest"));
  set("payables", col(bal, "payables_and_accrued_expenses"));
  set("current_debt", col(bal, "current_debt"));
  set("long_term_debt", col(bal, "long_term_debt"));
  set("total_debt", col(bal, "total_debt"));
  set("net_debt", col(bal, "net_debt"));
  set("common_stock", col(bal, "common_stock"));
  set("retained_earnings", col(bal, "retained_earnings"));
  set("invested_capital", col(bal, "invested_capital"));

  const eq1 = fin.map((r) => (r.total_assets as number | null) !== null && (r.total_liabilities as number | null) !== null
    ? (r.total_assets as number) - (r.total_liabilities as number)
    : null);
  const eq2 = fin.map((r) => {
    const a = r.common_stock as number | null;
    const b = r.retained_earnings as number | null;
    return a !== null && b !== null ? a + b : null;
  });
  set("equity", eq1.map((v, i) => co(v, eq2[i])));

  // --- Cash flow ------------------------------------------------------------
  set("ocf", years.map((fy) => co(
    pick(cf, "operating_cash_flow", fy),
    pick(cf, "cash_flow_from_continuing_operating_activities", fy),
  )));
  set("da", col(cf, "depreciation_and_amortization"));
  set("change_nwc", col(cf, "change_in_working_capital"));
  set("investing_cf", col(cf, "investing_cash_flow"));
  set("capex", years.map((fy) => {
    const v = co(pick(cf, "capital_expenditure", fy), pick(cf, "net_ppe_purchase_and_sale", fy));
    return v === null ? null : Math.abs(v);
  }));
  set("financing_cf", col(cf, "financing_cash_flow"));
  set("dividends_paid", years.map((fy) => {
    const v = pick(cf, "cash_dividends_paid", fy);
    return v === null ? null : Math.abs(v);
  }));
  set("fcf", col(cf, "free_cash_flow"));
  set("end_cash", col(cf, "end_cash_position"));
  set("begin_cash", col(cf, "beginning_cash_position"));

  const g = (k: string) => fin.map((r) => r[k] as number | null);

  // --- Fallbacks for key aggregates ----------------------------------------
  set("total_debt", g("total_debt").map((v, i) => co(v, add(g("current_debt")[i], g("long_term_debt")[i]))));
  set("net_debt", g("net_debt").map((v, i) =>
    co(v, sub(g("total_debt")[i], add(g("cash")[i] ?? 0, g("st_investments")[i] ?? 0)))));
  set("ebit", g("ebit").map((v, i) => co(v, g("operating_income")[i], sub(g("pretax_income")[i], g("interest_net")[i] ?? 0))));
  set("ebitda", g("ebitda").map((v, i) => co(v, add(g("ebit")[i], g("da")[i] ?? 0))));
  set("fcf", g("fcf").map((v, i) => co(v, sub(g("ocf")[i], g("capex")[i] ?? 0))));
  set("gross_profit", g("gross_profit").map((v, i) => co(v, sub(g("revenue")[i], g("cost_of_revenue")[i]))));
  set("cash_total", g("cash").map((v, i) => {
    const st = g("st_investments")[i];
    if (v === null && st === null) return null;
    return (v ?? 0) + (st ?? 0);
  }));

  // --- Per share ------------------------------------------------------------
  set("dps", div(g("dividends_paid"), g("shares")));
  set("bvps", div(g("equity"), g("shares")));
  set("tbvps", div(g("equity").map((v, i) => sub(v, g("goodwill_intang")[i] ?? 0)), g("shares")));
  set("ocf_ps", div(g("ocf"), g("shares")));
  set("fcf_ps", div(g("fcf"), g("shares")));
  set("payout", div(g("dividends_paid"), g("net_income")));
  set("dividend_cover", div(g("net_income"), g("dividends_paid")));

  // --- Margins & returns ----------------------------------------------------
  set("gross_margin", div(g("gross_profit"), g("revenue")));
  set("ebitda_margin", div(g("ebitda"), g("revenue")));
  set("ebit_margin", div(g("ebit"), g("revenue")));
  set("pretax_margin", div(g("pretax_income"), g("revenue")));
  set("net_margin", div(g("net_income"), g("revenue")));
  set("fcf_margin", div(g("fcf"), g("revenue")));
  set("tax_rate_eff", div(g("tax"), g("pretax_income")));

  const avg = (xs: (number | null)[]) => xs.map((x, i) => (i === 0 || xs[i - 1] === null ? x : (x === null ? null : (x + xs[i - 1]!) / 2)));
  set("roe", div(g("net_income"), avg(g("equity"))));
  set("roa", div(g("net_income"), avg(g("total_assets"))));

  const taxRate = g("tax_rate_eff").map((v) => Math.max(0, Math.min(0.5, v ?? 0.3)));
  const nopat = g("ebit").map((v, i) => (v === null ? null : v * (1 - taxRate[i])));
  set("nopat", nopat);
  set("roic", div(nopat, avg(g("invested_capital").map((v, i) => co(v, add(g("equity")[i], g("net_debt")[i]))))));
  set("asset_turnover", div(g("revenue"), avg(g("total_assets"))));
  set("leverage", div(avg(g("total_assets")), avg(g("equity"))));
  set("equity_assets", div(g("equity"), g("total_assets")));
  set("debt_equity", div(g("total_debt"), g("equity")));

  set("net_debt_ebitda", div(g("net_debt"), g("ebitda")).map((v, i) => {
    const e = g("ebitda")[i];
    return e !== null && e <= 0 ? null : v;
  }));
  set("interest_coverage", g("interest_net").map((v, i) =>
    v !== null && v < 0 ? safeDiv(g("ebit")[i], -v) : null));
  set("cash_conversion", div(g("ocf"), g("net_income")));
  set("fcf_conversion", div(g("fcf"), g("net_income")));
  set("capex_revenue", div(g("capex"), g("revenue")));
  set("da_revenue", div(g("da"), g("revenue")));
  set("capex_da", div(g("capex"), g("da")));
  set("nwc_revenue", div(g("receivables").map((v, i) => (v ?? 0) - (g("payables")[i] ?? 0)), g("revenue")));

  // --- Growth (YoY) ---------------------------------------------------------
  const growth = (xs: (number | null)[]) => xs.map((x, i) => {
    const p = i === 0 ? null : xs[i - 1];
    if (x === null || p === null || p <= 0) return null;
    return x / p - 1;
  });
  set("revenue_growth", growth(g("revenue")));
  set("ebitda_growth", growth(g("ebitda")));
  set("ebit_growth", growth(g("ebit")));
  set("ni_growth", growth(g("net_income")));
  set("eps_growth", growth(g("eps")));
  set("dps_growth", growth(g("dps")));
  set("bvps_growth", growth(g("bvps")));
  set("assets_growth", growth(g("total_assets")));

  return fin;
}

const add = (a: number | null, b: number | null | undefined): number | null =>
  a === null || b === null || b === undefined ? null : a + b;
const sub = (a: number | null, b: number | null | undefined): number | null =>
  a === null || b === null || b === undefined ? null : a - b;
const div = (a: (number | null)[], b: (number | null)[]): (number | null)[] => a.map((v, i) => safeDiv(v, b[i]));

/** Latest-year snapshot combined with the live quote → one-row ratios object. */
export function latestSnapshot(
  symbol: string,
  fin: FinRow[],
  quote: Quote,
  divs: DividendRow[],
  info: CompanyInfo,
): Ratios | null {
  if (!fin.length) return null;
  const L = fin[fin.length - 1];
  const P = fin.length > 1 ? fin[fin.length - 2] : L;
  const g = (row: FinRow, k: string) => row[k] as number | null;

  const price = quote.price;
  const shares = g(L, "shares");
  const mcap = price !== null && shares !== null ? price * shares : null;
  const netDebt = g(L, "net_debt") ?? 0;
  const ev = mcap !== null ? mcap + netDebt : null;
  const dpsTtm = ttmDividends(divs);
  const dpsUse = dpsTtm !== null && dpsTtm > 0 ? dpsTtm : g(L, "dps");
  const eps = g(L, "eps");
  const bvps = g(L, "bvps");
  const tbvps = g(L, "tbvps");

  const cg = (colKey: string): number | null => {
    const idx = fin.map((r, i) => ({ v: g(r, colKey), i })).filter((x) => x.v !== null);
    if (idx.length < 2) return null;
    const first = idx[0];
    const last = idx[idx.length - 1];
    const span = fin[last.i].fy - fin[first.i].fy;
    return cagr([first.v, last.v], span);
  };
  const spanYears = fin.length > 1 ? fin[fin.length - 1].fy - fin[0].fy : 0;
  const pe = price !== null && eps !== null && eps > 0 ? price / eps : null;
  const epsCagr = cg("eps");
  const ry = (colKey: string) => g(L, colKey);

  return {
    ticker: symbol,
    code: info.code,
    name: info.name,
    sector: info.sector ?? null,
    industry: info.industry ?? null,
    fy: L.fy,
    fyLabel: L.label as string,
    periodEnd: L.date as string,
    nYears: fin.length,
    price,
    sharesOut: shares,
    marketCap: mcap,
    enterpriseValue: ev,
    netDebt,
    totalDebt: g(L, "total_debt"),
    cash: ry("cash_total"),
    revenue: g(L, "revenue"),
    ebitda: g(L, "ebitda"),
    ebit: g(L, "ebit"),
    pretaxIncome: g(L, "pretax_income"),
    netIncome: g(L, "net_income"),
    normalisedIncome: g(L, "normalised_income"),
    eps,
    dps: dpsUse,
    dpsReported: g(L, "dps"),
    dpsTtm,
    bvps,
    tbvps,
    equity: g(L, "equity"),
    totalAssets: g(L, "total_assets"),
    goodwillIntang: g(L, "goodwill_intang"),
    ocf: g(L, "ocf"),
    capex: g(L, "capex"),
    fcf: g(L, "fcf"),
    da: g(L, "da"),
    dividendsPaid: g(L, "dividends_paid"),
    peRatio: pe,
    pbRatio: price !== null && bvps !== null && bvps > 0 ? price / bvps : null,
    pTbv: price !== null && tbvps !== null && tbvps > 0 ? price / tbvps : null,
    evRevenue: ev !== null && g(L, "revenue") !== null && (g(L, "revenue") as number) > 0 ? ev / (g(L, "revenue") as number) : null,
    evEbitda: ev !== null && g(L, "ebitda") !== null && (g(L, "ebitda") as number) > 0 ? ev / (g(L, "ebitda") as number) : null,
    evEbit: ev !== null && g(L, "ebit") !== null && (g(L, "ebit") as number) > 0 ? ev / (g(L, "ebit") as number) : null,
    psRatio: mcap !== null && g(L, "revenue") !== null && (g(L, "revenue") as number) > 0 ? mcap / (g(L, "revenue") as number) : null,
    earningsYield: eps !== null && price !== null && price > 0 ? eps / price : null,
    dividendYield: dpsUse !== null && price !== null && price > 0 ? dpsUse / price : null,
    grossedYield: dpsUse !== null && price !== null && price > 0 ? dpsUse / price / 0.7 : null,
    fcfYield: g(L, "fcf") !== null && mcap !== null && mcap > 0 ? (g(L, "fcf") as number) / mcap : null,
    ocfYield: g(L, "ocf") !== null && mcap !== null && mcap > 0 ? (g(L, "ocf") as number) / mcap : null,
    peg: pe !== null && epsCagr !== null && epsCagr > 0 ? pe / (epsCagr * 100) : null,
    payout: g(L, "payout"),
    dividendCover: g(L, "dividend_cover"),
    roe: g(L, "roe"),
    roa: g(L, "roa"),
    roic: g(L, "roic"),
    roePrior: g(P, "roe"),
    roicPrior: g(P, "roic"),
    grossMargin: g(L, "gross_margin"),
    ebitdaMargin: g(L, "ebitda_margin"),
    ebitMargin: g(L, "ebit_margin"),
    pretaxMargin: g(L, "pretax_margin"),
    netMargin: g(L, "net_margin"),
    fcfMargin: g(L, "fcf_margin"),
    taxRateEff: g(L, "tax_rate_eff"),
    assetTurnover: g(L, "asset_turnover"),
    leverage: g(L, "leverage"),
    equityAssets: g(L, "equity_assets"),
    debtEquity: g(L, "debt_equity"),
    netDebtEbitda: g(L, "net_debt_ebitda"),
    interestCoverage: g(L, "interest_coverage"),
    cashConversion: g(L, "cash_conversion"),
    fcfConversion: g(L, "fcf_conversion"),
    capexRevenue: g(L, "capex_revenue"),
    daRevenue: g(L, "da_revenue"),
    nwcRevenue: g(L, "nwc_revenue"),
    revenueGrowth: g(L, "revenue_growth"),
    niGrowth: g(L, "ni_growth"),
    epsGrowth: g(L, "eps_growth"),
    revenueCagr: cg("revenue"),
    ebitdaCagr: cg("ebitda"),
    ebitCagr: cg("ebit"),
    niCagr: cg("net_income"),
    epsCagr,
    dpsCagr: cg("dps"),
    ocfCagr: cg("ocf"),
    fcfCagr: cg("fcf"),
    bvpsCagr: cg("bvps"),
    cagrYears: spanYears,
  };
}

// ---------------------------------------------------------------------------
// Dividends are inferred from the adjusted-close ratio: Yahoo scales adj_close
// before each ex-date by (1 − D / P_prev), so the ratio steps up on the ex-date.
// ---------------------------------------------------------------------------
export function inferDividends(history: PriceRow[]): DividendRow[] {
  if (!history || history.length < 3) return [];
  const h = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const r = h.map((x) => (x.close ? x.adjClose / x.close : NaN));
  const out: DividendRow[] = [];
  for (let i = 1; i < h.length; i++) {
    const jump = r[i] / r[i - 1];
    if (!Number.isFinite(jump) || jump <= 1.0005 || jump >= 1.25) continue;
    const dps = h[i - 1].close * (1 - r[i - 1] / r[i]);
    if (Number.isFinite(dps) && dps > 0) {
      out.push({ exDate: h[i].date, dps: Math.round(dps * 1e4) / 1e4 });
    }
  }
  return out.sort((a, b) => b.exDate.localeCompare(a.exDate));
}

export function ttmDividends(divs: DividendRow[], asof: Date = new Date()): number | null {
  if (!divs?.length) return null;
  const from = new Date(asof.getTime() - 366 * 864e5).toISOString().slice(0, 10);
  const to = asof.toISOString().slice(0, 10);
  const d = divs.filter((x) => x.exDate > from && x.exDate <= to);
  return d.length ? d.reduce((a, b) => a + b.dps, 0) : null;
}

// ---------------------------------------------------------------------------
// Price analytics
// ---------------------------------------------------------------------------
export function priceMetrics(history: PriceRow[], bench: PriceRow[] | null, rf = 0.045): PriceMetrics | null {
  if (!history || history.length < 20) return null;
  const h = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const px = h.map((x) => x.adjClose);
  const ret = px.slice(1).map((v, i) => v / px[i] - 1);
  const days = (new Date(h[h.length - 1].date).getTime() - new Date(h[0].date).getTime()) / 864e5;
  const years = Math.max(days / 365.25, 1 / 252);
  const totalReturn = px[px.length - 1] / px[0] - 1;
  const annReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
  const annVol = (sd(ret) ?? 0) * Math.sqrt(252);
  const downside = ret.filter((x) => x < 0);
  const downVol = downside.length > 5 ? (sd(downside) ?? 0) * Math.sqrt(252) : null;

  let peak = -Infinity;
  const dd = px.map((v) => {
    peak = Math.max(peak, v);
    return v / peak - 1;
  });

  let beta: number | null = null;
  let corr: number | null = null;
  let alpha: number | null = null;
  let benchTotal: number | null = null;
  let benchAnn: number | null = null;
  let te: number | null = null;

  if (bench && bench.length > 20) {
    const b = [...bench].sort((a, c) => a.date.localeCompare(c.date));
    const bp = b.map((x) => x.close);
    const bretBy = new Map<string, number>();
    for (let i = 1; i < b.length; i++) bretBy.set(b[i].date, bp[i] / bp[i - 1] - 1);
    const pairs: { s: number; b: number }[] = [];
    for (let i = 1; i < h.length; i++) {
      const br = bretBy.get(h[i].date);
      if (br !== undefined) pairs.push({ s: ret[i - 1], b: br });
    }
    if (pairs.length > 30) {
      const sv = pairs.map((p) => p.s);
      const bv = pairs.map((p) => p.b);
      const cov = covariance(sv, bv);
      const varb = sd(bv);
      beta = cov !== null && varb !== null && varb !== 0 ? cov / (varb * varb) : null;
      corr = correlation(sv, bv);
      benchTotal = bp[bp.length - 1] / bp[0] - 1;
      benchAnn = Math.pow(1 + benchTotal, 1 / years) - 1;
      alpha = beta !== null ? annReturn - (rf + beta * (benchAnn - rf)) : null;
      const diff = sv.map((x, i) => x - bv[i]);
      te = (sd(diff) ?? 0) * Math.sqrt(252);
    }
  }

  return {
    totalReturn,
    annReturn,
    annVol,
    downsideVol: downVol,
    sharpe: annVol > 0 ? (annReturn - rf) / annVol : null,
    sortino: downVol !== null && downVol > 0 ? (annReturn - rf) / downVol : null,
    maxDrawdown: Math.min(...dd),
    currentDrawdown: dd[dd.length - 1],
    beta,
    correlation: corr,
    alpha,
    trackingError: te,
    benchTotalReturn: benchTotal,
    benchAnnReturn: benchAnn,
    excessReturn: benchTotal !== null ? totalReturn - benchTotal : null,
    bestDay: Math.max(...ret),
    worstDay: Math.min(...ret),
    pctUpDays: ret.filter((x) => x > 0).length / ret.length,
    firstDate: h[0].date,
    lastDate: h[h.length - 1].date,
    years,
    lastPrice: h[h.length - 1].close,
  };
}

export function performanceTable(history: PriceRow[], bench: PriceRow[] | null): PerfRow[] {
  if (!history || history.length < 5) return [];
  const h = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const b = bench ? [...bench].sort((x, y) => x.date.localeCompare(y.date)) : null;
  const last = h[h.length - 1].date;
  const windows: [string, number | null][] = [
    ["1 week", 7],
    ["1 month", 30],
    ["3 months", 91],
    ["6 months", 182],
    ["YTD", null],
    ["1 year", 365],
    ["2 years", 730],
    ["3 years", 1095],
    ["5 years", 1826],
  ];

  const retAt = (rows: PriceRow[], key: "adjClose" | "close", days: number | null): number | null => {
    if (!rows.length) return null;
    const end = new Date(last);
    const start = days === null
      ? new Date(Date.UTC(end.getUTCFullYear(), 0, 1) - 864e5).toISOString().slice(0, 10)
      : new Date(end.getTime() - days * 864e5).toISOString().slice(0, 10);
    if (new Date(start) < new Date(new Date(rows[0].date).getTime() - 7 * 864e5)) return null;
    const base = rows.filter((x) => x.date <= start);
    if (!base.length) return null;
    const lastVal = rows[rows.length - 1][key];
    const baseVal = base[base.length - 1][key];
    return baseVal ? lastVal / baseVal - 1 : null;
  };

  return windows
    .map(([period, days]) => {
      const stock = retAt(h, "adjClose", days);
      const benchmark = b ? retAt(b, "close", days) : null;
      return {
        period,
        stock,
        benchmark,
        relative: stock !== null && benchmark !== null ? stock - benchmark : null,
      };
    })
    .filter((r) => r.stock !== null);
}

// ---------------------------------------------------------------------------
// Technical indicators
// ---------------------------------------------------------------------------
function rollingMean(xs: (number | null)[], k: number): (number | null)[] {
  const n = xs.length;
  if (n < k) return xs.map(() => null);
  const out: (number | null)[] = xs.map(() => null);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const v = xs[i];
    if (v !== null) {
      sum += v;
      count++;
    }
    if (i >= k) {
      const out_ = xs[i - k];
      if (out_ !== null) {
        sum -= out_;
        count--;
      }
    }
    if (i >= k - 1 && count === k) out[i] = sum / k;
  }
  return out;
}

function rollingSd(xs: (number | null)[], k: number): (number | null)[] {
  const n = xs.length;
  const out: (number | null)[] = xs.map(() => null);
  if (n < k) return out;
  for (let i = k - 1; i < n; i++) {
    const win = xs.slice(i - k + 1, i + 1).filter((v): v is number => v !== null);
    if (win.length === k) out[i] = sd(win);
  }
  return out;
}

export function computeTechnicals(history: PriceRow[]): Technicals | null {
  if (!history || history.length < 30) return null;
  const h = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const n = h.length;
  const close = h.map((x) => x.close);
  const adj = h.map((x) => x.adjClose);
  const vol = h.map((x) => x.volume);

  const sma20 = rollingMean(close, 20);
  const sma50 = rollingMean(close, 50);
  const sma100 = rollingMean(close, 100);
  const sma200 = rollingMean(close, 200);
  const sd20 = rollingSd(close, 20);
  const ret = close.map((v, i) => (i === 0 ? null : close[i - 1] ? v / close[i - 1] - 1 : null));
  const rollVol = rollingSd(ret, 60).map((v) => (v === null ? null : v * Math.sqrt(252)));

  let peak = -Infinity;
  const drawdown = adj.map((v) => {
    peak = Math.max(peak, v);
    return v / peak - 1;
  });

  // RSI(14), Wilder smoothing
  const rsi: (number | null)[] = h.map(() => null);
  if (n > 15) {
    let ag = 0;
    let al = 0;
    for (let i = 1; i <= 14; i++) {
      const d = close[i] - close[i - 1];
      ag += Math.max(d, 0);
      al += Math.max(-d, 0);
    }
    ag /= 14;
    al /= 14;
    rsi[14] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (let i = 15; i < n; i++) {
      const d = close[i] - close[i - 1];
      ag = (ag * 13 + Math.max(d, 0)) / 14;
      al = (al * 13 + Math.max(-d, 0)) / 14;
      rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    }
  }

  const volAvg20 = rollingMean(vol, 20);

  const series: TechRow[] = h.map((row, i) => ({
    ...row,
    sma20: sma20[i],
    sma50: sma50[i],
    sma100: sma100[i],
    sma200: sma200[i],
    bbUpper: sma20[i] !== null && sd20[i] !== null ? sma20[i]! + 2 * sd20[i]! : null,
    bbLower: sma20[i] !== null && sd20[i] !== null ? sma20[i]! - 2 * sd20[i]! : null,
    ret: ret[i],
    rollVol60: rollVol[i],
    drawdown: drawdown[i],
    rsi14: rsi[i],
    volAvg20: volAvg20[i],
  }));

  const L = series[n - 1];
  const yearAgo = new Date(new Date(L.date).getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const window = series.filter((x) => x.date > yearAgo).map((x) => x.close);
  const hi52 = window.length ? Math.max(...window) : null;
  const lo52 = window.length ? Math.min(...window) : null;

  return {
    series,
    latest: {
      close: L.close,
      sma20: L.sma20,
      sma50: L.sma50,
      sma200: L.sma200,
      rsi14: L.rsi14,
      rollVol60: L.rollVol60,
      drawdown: L.drawdown,
      bbUpper: L.bbUpper,
      bbLower: L.bbLower,
      pctVsSma50: L.sma50 ? L.close / L.sma50 - 1 : null,
      pctVsSma200: L.sma200 ? L.close / L.sma200 - 1 : null,
      goldenCross: L.sma50 !== null && L.sma200 !== null ? L.sma50 > L.sma200 : false,
      hi52,
      lo52,
      pos52: hi52 !== null && lo52 !== null && hi52 > lo52 ? (L.close - lo52) / (hi52 - lo52) : null,
      volVsAvg: L.volAvg20 ? (L.volume ?? 0) / L.volAvg20 - 1 : null,
    },
  };
}

/** Rebase several series to 100 at their common start date. */
export function rebaseSeries(
  series: { code: string; rows: PriceRow[] }[],
  key: "adjClose" | "close" = "adjClose",
): { code: string; points: { date: string; value: number }[] }[] {
  if (!series.length) return [];
  const start = series
    .map((s) => (s.rows.length ? s.rows[0].date : ""))
    .filter(Boolean)
    .sort()
    .pop();
  if (!start) return [];
  return series.map((s) => {
    const rows = s.rows.filter((r) => r.date >= start);
    const base = rows.length ? rows[0][key] : 0;
    return {
      code: s.code,
      points: rows.map((r) => ({ date: r.date, value: base ? (r[key] / base) * 100 : 0 })),
    };
  });
}
