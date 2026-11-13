import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { COMPANIES } from "../core/universe.js";
import { fmtPct, fmtPrice } from "../core/brand.js";
import { useCompany, useValuation } from "./hooks.js";
import { IconBenchmarks, IconChevronLeft, IconChevronRight, IconExport, IconFinancials, IconMarket, IconOverview, IconPeers, IconRatios, IconRefresh, IconSector, IconSearch, IconValuation, } from "./components/icons.js";
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
const AppContext = createContext(null);
export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx)
        throw new Error("useApp must be used inside <App>");
    return ctx;
}
const NAV = [
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
const PAGES = {
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
function readHash() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    return Object.keys(PAGES).includes(raw) ? raw : "overview";
}
export function App() {
    const [page, setPage] = useState(readHash);
    const [symbol, setSymbol] = useState(() => new URLSearchParams(window.location.search).get("symbol") ?? "WBC.AX");
    const [period, setPeriod] = useState("2y");
    const [collapsed, setCollapsed] = useState(false);
    const { data, loading, error, refreshing, refresh } = useCompany(symbol, period);
    const { bundle, assumptions, setAssumptions, reset, dirty } = useValuation(data);
    const navigate = useCallback((next) => {
        setPage(next);
        window.location.hash = `#/${next}`;
        document.querySelector(".content")?.scrollTo({ top: 0 });
        window.scrollTo({ top: 0, behavior: "instant" });
    }, []);
    useEffect(() => {
        const onHash = () => setPage(readHash());
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);
    useEffect(() => {
        document.title = data?.ok ? `${data.code} · ${data.info.name} — MBS SIF` : "MBS SIF — Equity Research";
    }, [data]);
    const value = useMemo(() => ({
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
    }), [data, loading, error, refreshing, symbol, period, refresh, bundle, assumptions, setAssumptions, reset, dirty, page, navigate]);
    const Page = PAGES[page];
    return (_jsx(AppContext.Provider, { value: value, children: _jsxs("div", { className: "app", children: [_jsx(Sidebar, { page: page, navigate: navigate, collapsed: collapsed, setCollapsed: setCollapsed }), _jsxs("div", { className: `main${collapsed ? " collapsed" : ""}`, children: [_jsx(TopBar, {}), _jsxs("main", { className: "content", children: [error && _jsx("div", { style: { marginBottom: 16 }, children: _jsx(ErrorBanner, { children: error }) }), _jsx(Page, {})] })] })] }) }));
}
function Sidebar({ page, navigate, collapsed, setCollapsed, }) {
    return (_jsxs("aside", { className: `sidebar${collapsed ? " collapsed" : ""}`, children: [_jsx("div", { className: "brand", children: _jsxs("div", { className: "brand-mark", children: [_jsx("div", { className: "brand-badge", children: "MBS" }), _jsxs("div", { className: "brand-text", children: [_jsx("div", { className: "brand-title", children: "Student Investment Fund" }), _jsx("div", { className: "brand-sub", children: "Equity Research" })] })] }) }), _jsx("nav", { className: "nav", children: NAV.map((group) => (_jsxs("div", { children: [_jsx("div", { className: "nav-group-label", children: group.group }), group.items.map((item) => {
                            const Icon = item.icon;
                            const active = page === item.key;
                            return (_jsxs("button", { className: `nav-item${active ? " active" : ""}`, onClick: () => navigate(item.key), title: item.label, "aria-current": active ? "page" : undefined, children: [_jsx(Icon, {}), _jsx("span", { className: "nav-label", children: item.label })] }, item.key));
                        })] }, group.group))) }), _jsxs("div", { className: "sidebar-foot", children: ["Data: Yahoo Finance \u00B7 delayed", _jsx("br", {}), "Valuation engine runs locally"] }), _jsx("button", { className: "sidebar-collapse", onClick: () => setCollapsed(!collapsed), title: collapsed ? "Expand" : "Collapse", children: collapsed ? _jsx(IconChevronRight, {}) : _jsx(IconChevronLeft, {}) })] }));
}
function TopBar() {
    const { snapshot, symbol, setSymbol, period, setPeriod, refresh, refreshing, navigate } = useApp();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const boxRef = useRef(null);
    const results = useMemo(() => {
        const q = query.trim().toUpperCase();
        if (!q)
            return COMPANIES.slice(0, 8);
        return COMPANIES.filter((c) => c.code.includes(q) || c.name.toUpperCase().includes(q)).slice(0, 10);
    }, [query]);
    useEffect(() => {
        const onDown = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, []);
    const pick = (ticker) => {
        setSymbol(ticker);
        setQuery("");
        setOpen(false);
        navigate("overview");
    };
    const price = snapshot?.quote.price ?? null;
    const change = snapshot?.quote.changePct ?? null;
    const tone = change === null ? "" : change >= 0 ? "pos" : "neg";
    return (_jsxs("header", { className: "topbar", children: [_jsxs("div", { className: "company-search", ref: boxRef, children: [_jsx("span", { className: "search-icon", children: _jsx(IconSearch, {}) }), _jsx("input", { value: query, placeholder: snapshot?.ok ? `${snapshot.code} — ${snapshot.info.name}` : "Search ASX code or company…", onChange: (e) => {
                            setQuery(e.target.value);
                            setOpen(true);
                            setHighlight(0);
                        }, onFocus: () => setOpen(true), onKeyDown: (e) => {
                            if (e.key === "ArrowDown") {
                                e.preventDefault();
                                setHighlight((h) => Math.min(h + 1, results.length - 1));
                            }
                            else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setHighlight((h) => Math.max(h - 1, 0));
                            }
                            else if (e.key === "Enter") {
                                const hit = results[highlight];
                                if (hit)
                                    pick(hit.ticker);
                                else if (query.trim())
                                    pick(query.trim().toUpperCase().includes(".") ? query.trim().toUpperCase() : `${query.trim().toUpperCase()}.AX`);
                            }
                            else if (e.key === "Escape") {
                                setOpen(false);
                            }
                        } }), open && (_jsx("div", { className: "search-results", children: results.length === 0 ? (_jsxs("div", { className: "search-empty", children: ["No match \u2014 press Enter to load \u201C", query.toUpperCase(), "\u201D anyway"] })) : (results.map((c, i) => (_jsxs("button", { className: `search-result${i === highlight ? " hl" : ""}`, onMouseEnter: () => setHighlight(i), onClick: () => pick(c.ticker), children: [_jsx("code", { children: c.code }), _jsx("span", { className: "sr-name", children: c.name }), _jsx("span", { className: "sr-sector", children: c.sector })] }, c.code)))) }))] }), _jsx("div", { className: "seg", title: "Price-history window", children: ["1y", "2y", "5y"].map((p) => (_jsx("button", { className: period === p ? "active" : "", onClick: () => setPeriod(p), children: p }, p))) }), _jsx("div", { className: "topbar-spacer" }), snapshot?.ok && (_jsxs("div", { className: "price-chip", children: [_jsx("span", { className: "pc-code", children: snapshot.code }), _jsx("span", { className: "pc-value", children: fmtPrice(price) }), _jsx("span", { className: `pc-change ${tone}`, children: fmtPct(change, 2, true) })] })), _jsx("button", { className: `icon-btn${refreshing ? " spinning" : ""}`, onClick: refresh, title: `Reload ${symbol} from source`, "aria-label": "Refresh data", children: _jsx(IconRefresh, {}) })] }));
}
