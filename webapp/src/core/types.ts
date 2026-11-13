// Shared domain types. The API returns these directly; the client re-uses them.

export type ModelFamily = "bank" | "insurer" | "financial" | "reit" | "industrial";

export interface UniverseCompany {
  code: string;
  name: string;
  sector: string;
  industry: string;
  ticker: string;
  family: ModelFamily;
  peers: string[];
}

export interface BenchmarkDef {
  label: string;
  symbol: string;
  kind: string;
}

export interface Universe {
  companies: UniverseCompany[];
  benchmarks: BenchmarkDef[];
  sectorIndexMap: Record<string, string>;
  fxPairs: { label: string; symbol: string }[];
  familyLabels: Record<ModelFamily, string>;
}

export interface CompanyInfo {
  code: string;
  name: string;
  sector: string;
  industry: string;
  inUniverse: boolean;
  peers: string[];
  family: ModelFamily;
}

export interface Quote {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
  currency: string | null;
}

export interface PriceRow {
  date: string; // YYYY-MM-DD
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  adjClose: number;
  volume: number | null;
}

/** One row per fiscal year; every statement line plus derived margins and growth. */
export interface FinRow {
  fy: number;
  date: string;
  label: string;
  [key: string]: number | string | null;
}

export interface Ratios {
  ticker: string;
  code: string;
  name: string;
  sector: string | null;
  industry: string | null;
  fy: number;
  fyLabel: string;
  periodEnd: string;
  nYears: number;
  price: number | null;
  sharesOut: number | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  netDebt: number | null;
  totalDebt: number | null;
  cash: number | null;
  revenue: number | null;
  ebitda: number | null;
  ebit: number | null;
  pretaxIncome: number | null;
  netIncome: number | null;
  normalisedIncome: number | null;
  eps: number | null;
  dps: number | null;
  dpsReported: number | null;
  dpsTtm: number | null;
  bvps: number | null;
  tbvps: number | null;
  equity: number | null;
  totalAssets: number | null;
  goodwillIntang: number | null;
  ocf: number | null;
  capex: number | null;
  fcf: number | null;
  da: number | null;
  dividendsPaid: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  pTbv: number | null;
  evRevenue: number | null;
  evEbitda: number | null;
  evEbit: number | null;
  psRatio: number | null;
  earningsYield: number | null;
  dividendYield: number | null;
  grossedYield: number | null;
  fcfYield: number | null;
  ocfYield: number | null;
  peg: number | null;
  payout: number | null;
  dividendCover: number | null;
  roe: number | null;
  roa: number | null;
  roic: number | null;
  roePrior: number | null;
  roicPrior: number | null;
  grossMargin: number | null;
  ebitdaMargin: number | null;
  ebitMargin: number | null;
  pretaxMargin: number | null;
  netMargin: number | null;
  fcfMargin: number | null;
  taxRateEff: number | null;
  assetTurnover: number | null;
  leverage: number | null;
  equityAssets: number | null;
  debtEquity: number | null;
  netDebtEbitda: number | null;
  interestCoverage: number | null;
  cashConversion: number | null;
  fcfConversion: number | null;
  capexRevenue: number | null;
  daRevenue: number | null;
  nwcRevenue: number | null;
  revenueGrowth: number | null;
  niGrowth: number | null;
  epsGrowth: number | null;
  revenueCagr: number | null;
  ebitdaCagr: number | null;
  ebitCagr: number | null;
  niCagr: number | null;
  epsCagr: number | null;
  dpsCagr: number | null;
  ocfCagr: number | null;
  fcfCagr: number | null;
  bvpsCagr: number | null;
  cagrYears: number;
  return1y?: number | null;
  week52High?: number | null;
  week52Low?: number | null;
  changePct?: number | null;
}

export interface TechRow extends PriceRow {
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  ret: number | null;
  rollVol60: number | null;
  drawdown: number | null;
  rsi14: number | null;
  volAvg20: number | null;
}

export interface TechLatest {
  close: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  rollVol60: number | null;
  drawdown: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  pctVsSma50: number | null;
  pctVsSma200: number | null;
  goldenCross: boolean;
  hi52: number | null;
  lo52: number | null;
  pos52: number | null;
  volVsAvg: number | null;
}

export interface Technicals {
  series: TechRow[];
  latest: TechLatest;
}

export interface PriceMetrics {
  totalReturn: number | null;
  annReturn: number | null;
  annVol: number | null;
  downsideVol: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
  currentDrawdown: number | null;
  beta: number | null;
  correlation: number | null;
  alpha: number | null;
  trackingError: number | null;
  benchTotalReturn: number | null;
  benchAnnReturn: number | null;
  excessReturn: number | null;
  bestDay: number | null;
  worstDay: number | null;
  pctUpDays: number | null;
  firstDate: string | null;
  lastDate: string | null;
  years: number | null;
  lastPrice: number | null;
}

export interface PerfRow {
  period: string;
  stock: number | null;
  benchmark: number | null;
  relative: number | null;
}

export interface DividendRow {
  exDate: string;
  dps: number;
}

export interface PeerSet {
  table: Ratios[];
  symbols: string[];
  history: Record<string, PriceRow[]>;
}

export interface NewsItem {
  title: string;
  publisher: string | null;
  link: string | null;
  publishedAt: string | null;
}

export interface CompanySnapshot {
  ok: boolean;
  symbol: string;
  code: string;
  info: CompanyInfo;
  quote: Quote;
  meta: {
    exchange: string | null;
    fullExchangeName: string | null;
    timezone: string | null;
    longName: string | null;
    website: string | null;
    summary: string | null;
    employees: number | null;
  };
  fin: FinRow[];
  ratios: Ratios;
  history: PriceRow[];
  bench: PriceRow[];
  sectorPx: PriceRow[];
  sectorIndex: string | null;
  dividends: DividendRow[];
  metrics: PriceMetrics | null;
  perf: PerfRow[];
  tech: Technicals | null;
  peers: PeerSet | null;
  news: NewsItem[];
  period: string;
  loadedAt: string;
  error?: string;
}

export interface BoardRow extends Quote {
  label: string;
  kind: string;
  pos52: number | null;
}

export interface BenchmarksPayload {
  board: BoardRow[];
  series: Record<string, PriceRow[]>;
  fx: Record<string, PriceRow[]>;
  loadedAt: string;
}

export interface SectorPayload {
  sector: string;
  indexSymbol: string | null;
  index: PriceRow[];
  table: Ratios[];
  loadedAt: string;
}
