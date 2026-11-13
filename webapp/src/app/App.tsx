import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { COMPANIES } from "../core/universe.js";
import { fmtPct, fmtPrice } from "../core/brand.js";
import type { CompanySnapshot } from "../core/types.js";
import type { Assumptions } from "../core/valuation.js";
import { useCompany, useValuation, type ValuationBundle } from "./hooks.js";
import {
  IconBenchmarks,
  IconChevronLeft,
  IconChevronRight,
  IconExport,
  IconFinancials,
  IconMarket,
  IconOverview,
  IconPeers,
  IconRatios,
  IconRefresh,
  IconSector,
  IconSearch,
  IconValuation,
} from "./components/icons.js";
import { ErrorBanner } from "./components/ui.js";
import { OverviewPage } from "./pages/Overview.js";
import { MarketPage } from "./pages/Market.js";
import { FinancialsPage } from "./pages/Financials.js";
import { RatiosPage } from "./pages/Ratios.js";
import { PeersPage } from "./pages/Peers.js";
import { ValuationPage } from "./pages/Valuation.js";
import { SectorPage } from "./pages/Sector.js";
import { BenchmarksPage } from "./pages/Benchmarks.js";
import { ExportPage } from "./pages/Export.js";

export type PageKey =
  | "overview"
  | "market"
  | "financials"
  | "ratios"
  | "peers"
  | "valuation"
  | "sector"
  | "benchmarks"
  | "export";

interface AppContextValue {
  snapshot: CompanySnapshot | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  symbol: string;
  period: string;
  setSymbol: (symbol: string) => void;
  setPeriod: (period: string) => void;
  refresh: () => void;
  valuation: ValuationBundle | null;
  assumptions: Assumptions | null;
  setAssumptions: (a: Assumptions) => void;
  resetAssumptions: () => void;
  dirty: boolean;
  page: PageKey;
  navigate: (page: PageKey) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <App>");
  return ctx;
}

const NAV: { group: string; items: { key: PageKey; label: string; icon: typeof IconOverview; badge?: string }[] }[] = [
  {
    group: "Company",
    items: [
      { key: "overview", label: "Overview", icon: IconOverview },
      { key: "market", label: "Market & risk", icon: IconMarket },
      { key: "financials", label: "Financials", icon: IconFinancials },
      { key: "ratios", label: "Ratios", icon: IconRatios },
      { key: "peers", label: "Peer comparison", icon: IconPeers },
      { key: "valuation", label: "Valuation", icon: IconValuation },
    ],
  },
  {
    group: "Cross-section",
    items: [
      { key: "sector", label: "Sector & screener", icon: IconSector },
      { key: "benchmarks", label: "Benchmarks", icon: IconBenchmarks },
    ],
  },
  { group: "Output", items: [{ key: "export", label: "Notes & export", icon: IconExport }] },
];

const PAGES: Record<PageKey, ComponentType> = {
  overview: OverviewPage,
  market: MarketPage,
  financials: FinancialsPage,
  ratios: RatiosPage,
  peers: PeersPage,
  valuation: ValuationPage,
  sector: SectorPage,
  benchmarks: BenchmarksPage,
  export: ExportPage,
};

function readHash(): PageKey {
  const raw = window.location.hash.replace(/^#\/?/, "");
  return (Object.keys(PAGES) as PageKey[]).includes(raw as PageKey) ? (raw as PageKey) : "overview";
}

export function App() {
  const [page, setPage] = useState<PageKey>(readHash);
  const [symbol, setSymbol] = useState(() => new URLSearchParams(window.location.search).get("symbol") ?? "WBC.AX");
  const [period, setPeriod] = useState("2y");
  const [collapsed, setCollapsed] = useState(false);

  const { data, loading, error, refreshing, refresh } = useCompany(symbol, period);
  const { bundle, assumptions, setAssumptions, reset, dirty } = useValuation(data);

  const navigate = useCallback((next: PageKey) => {
    setPage(next);
    window.location.hash = `#/${next}`;
    document.querySelector(".content")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  useEffect(() => {
    const onHash = () => setPage(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = data?.ok ? `${data.code} · ${data.info.name} — MBS SIF` : "MBS SIF — Equity Research";
  }, [data]);

  const value = useMemo<AppContextValue>(
    () => ({
      snapshot: data,
      loading,
      error,
      refreshing,
      symbol,
      period,
      setSymbol,
      setPeriod,
      refresh,
      valuation: bundle,
      assumptions,
      setAssumptions,
      resetAssumptions: reset,
      dirty,
      page,
      navigate,
    }),
    [data, loading, error, refreshing, symbol, period, refresh, bundle, assumptions, setAssumptions, reset, dirty, page, navigate],
  );

  const Page = PAGES[page];

  return (
    <AppContext.Provider value={value}>
      <div className="app">
        <Sidebar page={page} navigate={navigate} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className={`main${collapsed ? " collapsed" : ""}`}>
          <TopBar />
          <main className="content">
            {error && <div style={{ marginBottom: 16 }}><ErrorBanner>{error}</ErrorBanner></div>}
            <Page />
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}

function Sidebar({
  page,
  navigate,
  collapsed,
  setCollapsed,
}: {
  page: PageKey;
  navigate: (p: PageKey) => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="brand">
        <div className="brand-mark">
          <div className="brand-badge">MBS</div>
          <div className="brand-text">
            <div className="brand-title">Student Investment Fund</div>
            <div className="brand-sub">Equity Research</div>
          </div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((group) => (
          <div key={group.group}>
            <div className="nav-group-label">{group.group}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = page === item.key;
              return (
                <button
                  key={item.key}
                  className={`nav-item${active ? " active" : ""}`}
                  onClick={() => navigate(item.key)}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon />
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        Data: Yahoo Finance · delayed
        <br />
        Valuation engine runs locally
      </div>
      <button className="sidebar-collapse" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expand" : "Collapse"}>
        {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
      </button>
    </aside>
  );
}

function TopBar() {
  const { snapshot, symbol, setSymbol, period, setPeriod, refresh, refreshing, navigate } = useApp();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return COMPANIES.slice(0, 8);
    return COMPANIES.filter((c) => c.code.includes(q) || c.name.toUpperCase().includes(q)).slice(0, 10);
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (ticker: string) => {
    setSymbol(ticker);
    setQuery("");
    setOpen(false);
    navigate("overview");
  };

  const price = snapshot?.quote.price ?? null;
  const change = snapshot?.quote.changePct ?? null;
  const tone = change === null ? "" : change >= 0 ? "pos" : "neg";

  return (
    <header className="topbar">
      <div className="company-search" ref={boxRef}>
        <span className="search-icon">
          <IconSearch />
        </span>
        <input
          value={query}
          placeholder={snapshot?.ok ? `${snapshot.code} — ${snapshot.info.name}` : "Search ASX code or company…"}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              const hit = results[highlight];
              if (hit) pick(hit.ticker);
              else if (query.trim()) pick(query.trim().toUpperCase().includes(".") ? query.trim().toUpperCase() : `${query.trim().toUpperCase()}.AX`);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {open && (
          <div className="search-results">
            {results.length === 0 ? (
              <div className="search-empty">
                No match — press Enter to load “{query.toUpperCase()}” anyway
              </div>
            ) : (
              results.map((c, i) => (
                <button
                  key={c.code}
                  className={`search-result${i === highlight ? " hl" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(c.ticker)}
                >
                  <code>{c.code}</code>
                  <span className="sr-name">{c.name}</span>
                  <span className="sr-sector">{c.sector}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="seg" title="Price-history window">
        {["1y", "2y", "5y"].map((p) => (
          <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
            {p}
          </button>
        ))}
      </div>

      <div className="topbar-spacer" />

      {snapshot?.ok && (
        <div className="price-chip">
          <span className="pc-code">{snapshot.code}</span>
          <span className="pc-value">{fmtPrice(price)}</span>
          <span className={`pc-change ${tone}`}>{fmtPct(change, 2, true)}</span>
        </div>
      )}

      <button
        className={`icon-btn${refreshing ? " spinning" : ""}`}
        onClick={refresh}
        title={`Reload ${symbol} from source`}
        aria-label="Refresh data"
      >
        <IconRefresh />
      </button>
    </header>
  );
}
