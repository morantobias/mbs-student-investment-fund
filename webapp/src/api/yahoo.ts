// Yahoo Finance client. Server-side only — the browser never talks to Yahoo.
//
// Two public endpoints carry everything we need and neither requires a crumb:
//   v8/finance/chart            → OHLCV history + quote metadata
//   ws/fundamentals-timeseries  → annual statements (income/balance/cash flow)
// A third (v1/finance/search) supplies company news.

import type { PriceRow, Quote } from "../core/types.js";

const HOST = "https://query2.finance.yahoo.com";
const UA = "yahoofinancer/0.6.1";

export class YahooError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "YahooError";
  }
}

async function getJson(url: string, timeoutMs = 15000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new YahooError(`Yahoo responded ${res.status}`, res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Retry on 429/5xx with exponential backoff — Yahoo throttles bursts. */
async function getJsonRetry(url: string, tries = 3): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await getJson(url);
    } catch (err) {
      lastErr = err;
      const status = err instanceof YahooError ? err.status : undefined;
      if (status && status !== 429 && status < 500) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new YahooError("Yahoo request failed");
}

export interface ChartMeta {
  symbol: string;
  currency: string | null;
  price: number | null;
  previousClose: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  longName: string | null;
  shortName: string | null;
  exchange: string | null;
  fullExchangeName: string | null;
  timezone: string | null;
  marketTime: string | null;
  instrumentType: string | null;
}

export interface ChartResult {
  meta: ChartMeta;
  rows: PriceRow[];
}

const round = (v: number | null, dp: number): number | null =>
  v === null ? null : Math.round(v * 10 ** dp) / 10 ** dp;

const num = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : null;
};

/** Daily OHLCV plus the quote fields Yahoo embeds in the chart metadata. */
export async function yahooChart(symbol: string, range = "2y", interval = "1d"): Promise<ChartResult> {
  const url = `${HOST}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplit`;
  const json = await getJsonRetry(url);
  const result = json?.chart?.result?.[0];
  if (!result) {
    const desc = json?.chart?.error?.description ?? "no data";
    throw new YahooError(`No chart data for ${symbol}: ${desc}`);
  }
  const m = result.meta ?? {};
  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? [];

  const rows: PriceRow[] = [];
  for (let i = 0; i < ts.length; i++) {
    const close = num(q.close?.[i]);
    if (close === null) continue;
    const adjClose = num(adj[i]) ?? close;
    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: round(num(q.open?.[i]), 4),
      high: round(num(q.high?.[i]), 4),
      low: round(num(q.low?.[i]), 4),
      close: round(close, 4)!,
      adjClose: round(adjClose, 4)!,
      volume: num(q.volume?.[i]),
    });
  }
  // Dedupe on date (Yahoo occasionally repeats the final bar intraday).
  const seen = new Map<string, PriceRow>();
  for (const r of rows) seen.set(r.date, r);

  return {
    meta: {
      symbol: m.symbol ?? symbol,
      currency: m.currency ?? null,
      price: round(num(m.regularMarketPrice), 4),
      previousClose: round(num(m.regularMarketPreviousClose) ?? num(m.previousClose) ?? num(m.chartPreviousClose), 4),
      week52High: round(num(m.fiftyTwoWeekHigh), 4),
      week52Low: round(num(m.fiftyTwoWeekLow), 4),
      volume: num(m.regularMarketVolume),
      longName: m.longName ?? null,
      shortName: m.shortName ?? null,
      exchange: m.exchangeName ?? null,
      fullExchangeName: m.fullExchangeName ?? null,
      timezone: m.exchangeTimezoneName ?? null,
      marketTime: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
      instrumentType: m.instrumentType ?? null,
    },
    rows: [...seen.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Quote-only convenience wrapper (5-day window keeps the payload tiny). */
export async function yahooQuote(symbol: string): Promise<Quote> {
  const { meta } = await yahooChart(symbol, "5d");
  const price = meta.price;
  const prev = meta.previousClose;
  return {
    symbol: meta.symbol ?? symbol,
    price,
    previousClose: prev,
    change: price !== null && prev !== null ? price - prev : null,
    changePct: price !== null && prev !== null && prev !== 0 ? price / prev - 1 : null,
    week52High: meta.week52High,
    week52Low: meta.week52Low,
    volume: meta.volume,
    currency: meta.currency,
  };
}

// ---------------------------------------------------------------------------
// Annual statements
// ---------------------------------------------------------------------------
const INCOME: Record<string, string> = {
  annualTotalRevenue: "total_revenue",
  annualOperatingRevenue: "operating_revenue",
  annualCostOfRevenue: "cost_of_revenue",
  annualGrossProfit: "gross_profit",
  annualOperatingExpense: "operating_expense",
  annualOperatingIncome: "operating_income",
  annualEBITDA: "ebitda",
  annualNormalizedEBITDA: "normalized_ebitda",
  annualEBIT: "ebit",
  annualNetNonOperatingInterestIncomeExpense: "net_non_operating_interest_income_expense",
  annualOtherIncomeExpense: "other_income_expense",
  annualPretaxIncome: "pretax_income",
  annualTaxProvision: "tax_provision",
  annualNetIncome: "net_income",
  annualNetIncomeContinuousOperations: "net_income_continuous_operations",
  annualNormalizedIncome: "normalized_income",
  annualDilutedEPS: "diluted_eps",
  annualBasicEPS: "basic_eps",
  annualDilutedAverageShares: "diluted_average_shares",
  annualBasicAverageShares: "basic_average_shares",
};

const BALANCE: Record<string, string> = {
  annualTotalAssets: "total_assets",
  annualCashAndCashEquivalents: "cash_and_cash_equivalents",
  annualOtherShortTermInvestments: "other_short_term_investments",
  annualReceivables: "receivables",
  annualNetPPE: "net_ppe",
  annualGoodwillAndOtherIntangibleAssets: "goodwill_and_other_intangible_assets",
  annualTotalLiabilitiesNetMinorityInterest: "total_liabilities_net_minority_interest",
  annualPayablesAndAccruedExpenses: "payables_and_accrued_expenses",
  annualCurrentDebt: "current_debt",
  annualLongTermDebt: "long_term_debt",
  annualTotalDebt: "total_debt",
  annualNetDebt: "net_debt",
  annualCommonStock: "common_stock",
  annualRetainedEarnings: "retained_earnings",
  annualInvestedCapital: "invested_capital",
};

const CASHFLOW: Record<string, string> = {
  annualOperatingCashFlow: "operating_cash_flow",
  annualCashFlowFromContinuingOperatingActivities: "cash_flow_from_continuing_operating_activities",
  annualDepreciationAndAmortization: "depreciation_and_amortization",
  annualChangeInWorkingCapital: "change_in_working_capital",
  annualInvestingCashFlow: "investing_cash_flow",
  annualCapitalExpenditure: "capital_expenditure",
  annualNetPPEPurchaseAndSale: "net_ppe_purchase_and_sale",
  annualFinancingCashFlow: "financing_cash_flow",
  annualCashDividendsPaid: "cash_dividends_paid",
  annualFreeCashFlow: "free_cash_flow",
  annualEndCashPosition: "end_cash_position",
  annualBeginningCashPosition: "beginning_cash_position",
};

export const ALL_TYPES = { ...INCOME, ...BALANCE, ...CASHFLOW };

export type StatementRow = { date: string; [key: string]: number | string | null };

export interface RawStatements {
  income: StatementRow[];
  balance: StatementRow[];
  cashflow: StatementRow[];
}

const EPOCH_FROM = 946684800; // 2000-01-01
const EPOCH_TO = Math.floor(Date.now() / 1000) + 86400;

/**
 * Fetch every annual line item in one request, then pivot to one row per
 * fiscal year per statement. Yahoo returns parallel arrays keyed by type.
 */
export async function yahooStatements(symbol: string): Promise<RawStatements> {
  const types = Object.keys(ALL_TYPES);
  const url = `${HOST}/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}` +
    `?symbol=${encodeURIComponent(symbol)}&type=${types.join(",")}&period1=${EPOCH_FROM}&period2=${EPOCH_TO}`;
  const json = await getJsonRetry(url);
  const results: any[] = json?.timeseries?.result ?? [];

  const rows = new Map<string, StatementRow>();
  const rowFor = (date: string) => {
    let r = rows.get(date);
    if (!r) {
      r = { date };
      rows.set(date, r);
    }
    return r;
  };

  for (const entry of results) {
    const typeName: string = entry?.meta?.type?.[0] ?? "";
    const field = ALL_TYPES[typeName];
    if (!field) continue;
    const series = entry[typeName];
    if (!Array.isArray(series)) continue;
    for (const point of series) {
      const date: string | undefined = point?.asOfDate;
      if (!date) continue;
      const value = point?.reportedValue?.raw ?? point?.dataValue ?? null;
      rowFor(date)[field] = typeof value === "number" ? value : null;
    }
  }

  const all = [...rows.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const split = (keys: Record<string, string>) => {
    const fields = new Set(Object.values(keys));
    return all
      .map((r) => {
        const out: StatementRow = { date: r.date };
        for (const f of fields) if (r[f] !== undefined) out[f] = r[f];
        return out;
      })
      .filter((r) => Object.keys(r).length > 1);
  };

  return { income: split(INCOME), balance: split(BALANCE), cashflow: split(CASHFLOW) };
}

// ---------------------------------------------------------------------------
// News & company search
// ---------------------------------------------------------------------------
export interface NewsItem {
  title: string;
  publisher: string | null;
  link: string | null;
  publishedAt: string | null;
}

export async function yahooNews(symbol: string, count = 8): Promise<NewsItem[]> {
  try {
    const url = `${HOST}/v1/finance/search?q=${encodeURIComponent(symbol)}&newsCount=${count}&quotesCount=0&enableFuzzyQuery=false`;
    const json = await getJson(url);
    const news = Array.isArray(json?.news) ? json.news : [];
    return news.slice(0, count).map((n: any) => ({
      title: String(n.title ?? "").trim(),
      publisher: n.publisher ?? null,
      link: n.link ?? null,
      publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null,
    })).filter((n: NewsItem) => n.title);
  } catch {
    return [];
  }
}

/** Run promises with bounded concurrency so we never hammer Yahoo. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
