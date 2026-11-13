# MBS Student Investment Fund — Equity Research Workstation
## Project Scope Document

**Version:** 2.0
**Status:** Delivered (v2 — full rebuild of the v1 dashboard)
**Location:** `app/`
**Owner:** Melbourne Business School — Student Investment Fund (MBS SIF)
**Last updated:** 10 November 2026

---

## 1. Purpose

The MBS SIF needs a Capital IQ–style research workstation that its analysts can use to
produce equity research on any ASX-listed company, and on any industry within a sector,
without paying for a commercial terminal. Koyfin, the Fund's current tool, is inadequate
for the depth of work the Investment Committee expects.

Version 2 replaces the v1 dashboard with a complete analyst workflow: live data for a
company and its peers, multi-year ratio and technical analysis, a sector-aware valuation
engine with editable forecast drivers, scenario weighting and sensitivity grids, a sector
screener, and MBS-branded exports — including a **formula-driven copy of the Fund's
Junior Analyst financial model** and a research-note draft in the structure of the Fund's
investment recommendations.

The reference standard for content coverage is
*"MBS Student Investment Fund — Westpac — Sell S1 2026"*: valuations are reported both
excluding and including franking credits, the cost of equity is built with CAPM, and
bear/base/bull scenarios are probability-weighted (Appendix B) with cost-of-equity and
driver sensitivities (Appendix C).

---

## 2. What changed from v1

| Area | v1 | v2 |
|---|---|---|
| Framework | Bootstrap 3 `navbarPage`, static ggplot images | bslib (Bootstrap 5) `page_navbar`, interactive plotly charts, sticky company header, cards, tooltips |
| Universe | 70 names, several delisted or mislabelled (NCM, SYD, ABC, CSR, HUB24, BRG as Brickworks) | 152 names validated live against Yahoo Finance, GICS-style sector/industry, curated cross-industry peers |
| Data calls | One `Ticker` object per endpoint, no caching | Batch endpoints (`yf_get_market_stats`, `yf_get_financials`, `yf_download_prices`), app-wide `cachem` caches, more line items (EBITDA, EBIT, COGS, operating income) |
| Fundamentals | Latest year only | Canonical multi-year history (`build_fin`) with margins, returns, DuPont, growth, per-share and payout series; phantom fiscal years removed |
| Dividends | Cash dividends paid ÷ shares | Ex-dates and DPS inferred from Yahoo's adjusted-close series; trailing-12-month DPS drives yields and the dividend model |
| Market data | Rebased line, 6 metrics | Candles/line with SMA 20/50/100/200, Bollinger, volume, RSI; trailing returns 1w–5y vs ASX 200; drawdown, rolling volatility, return distribution; Sharpe, Sortino, alpha, tracking error; sector-index relative performance |
| Valuation | Single growth/margin inputs; Gordon DDM; crude weighting | Per-year editable driver grid (rhandsontable); FCFF DCF with mid-year option, EV bridge and reverse DCF; two-stage DDM with franking gross-up; residual income model; justified P/B; peer P/E, P/B, EV/EBITDA with interquartile ranges; editable method weights; headline basis toggle (incl./excl. franking) |
| Scenarios & sensitivity | Two 1-D tables | Editable bear/base/bull deltas and probabilities; four 1-D tables (Ke, growth, terminal growth, margin/payout) reported ex- and incl. franking; two-way heatmap; football field |
| Peers | One table, four bars | Percentile tiles, exportable comps table with medians, six ranked bars, P/B-vs-ROE and P/E-vs-growth scatters with regression, one-year relative performance |
| Sector | — | Whole-sector or whole-universe load, screener (P/E, P/B, yield, ROE, market cap, industry, dividend payers), composite quality/value/growth/momentum scores, industry medians, charts, export |
| Benchmarks | 8 symbols | 34 instruments: ASX 200 + 11 S&P/ASX 200 sector indices, US and global indices, Treasury curve, VIX, commodities, 7 FX pairs; 52-week position bars |
| Exports | 3 workbooks with values only | Research workbook (15 sheets), **Junior Analyst model with live Excel formulas across all 14 template sheets**, Ratio Guide with formula-driven sheet 2 covering the subject and every peer, sector workbook, Markdown research note for the Word pipeline, zip bundle |
| Analyst notes | — | Thesis, investment case, risks, catalysts, ESG and recommendation override flow into the workbook cover and the note |
| Quality | None | Parse checks, live export test (`tests/test_exports.R`), headless server test driving every output for a bank, a miner, an ad-hoc ticker and a bad ticker (`tests/smoke.R`) |

**v2.1 (current build)** — hardening pass before handover:

+ Long price/market series are decimated before plotting (worst chart 12.4 s → ~2–3 s).
+ Fundamentals and prices now persist to a disk cache, so a restarted app paints in
  seconds instead of re-fetching every peer.
+ Every workbook export is re-zipped after saving to remove openxlsx's orphaned drawing
  relationships — the fix that makes the `.xlsx` files open in openpyxl, Power Query and
  Excel rather than failing on a missing `xl/drawings/drawing1.xml`.
+ Peer-median guide lines in horizontal bar charts use a paper-referenced shape, so they
  are no longer dropped by plotly's discrete-axis rule.
+ Screenshot harness (`tests/screenshots.R`) waits on visible-output readiness and
  captures viewport-sized images, so captures are not taken mid-render.
+ Chart data is cleaned before plotting — all-NA series are skipped and NA rows dropped from
  multi-series, scenario and empty-state charts — so a `testServer` pass over the whole app
  now runs with zero plotly warnings and no silently dropped overrides.

---

## 3. In scope

### 3.1 Company coverage

* Any security addressable by a Yahoo Finance ticker; ASX codes are normalised to `CODE.AX`.
* A curated universe of 152 ASX names (`R/universe.R`) with sector, industry and a
  valuation family (bank, insurer, financial, REIT, industrial). Every ticker was
  validated live on 10 November 2026.
* Free-text entry for names outside the universe; the Yahoo company name is used and
  the industrial valuation family applies.

### 3.2 Peer and sector coverage

* **Industry peers (curated)** — names sharing the company's industry, with hand-set
  overrides where cross-industry comparison is standard (e.g. Macquarie against the
  majors, Qantas against infrastructure).
* **Full GICS sector** — every universe name in the sector.
* **Custom tickers** — analyst-entered list.
* **Sector & Screener** — a sector or the whole universe loaded in a handful of batch
  calls, filtered by valuation, quality, size and industry.

### 3.3 Data retrieved

| Category | Fields |
|---|---|
| Quote | Price, previous close, day change, 52-week range, volume, currency, exchange, first trade date |
| Developments | Yahoo significant developments and relevance-scored related securities |
| Income statement | Revenue, cost of revenue, gross profit, operating expense, operating income, EBITDA, EBIT, net interest, other income, pre-tax, tax, net income, normalised income, EPS, share counts |
| Balance sheet | Total assets, cash, short-term investments, receivables, net PP&E, goodwill & intangibles, liabilities, payables, current/long-term/total debt, equity, retained earnings, invested capital, net debt |
| Cash flow | Operating cash flow, D&A, working-capital change, investing, capex, financing, dividends paid, free cash flow, opening/closing cash |
| Derived history | Margins, ROE/ROA/ROIC, DuPont, leverage, coverage, cash conversion, capex intensity, YoY growth, per-share series, payout, dividend cover, historical multiples at period-end prices |
| Prices | Daily OHLCV and adjusted close for 6M–Max; inferred dividends |
| Benchmarks | 27 indices/rates/commodities and 7 FX pairs |

### 3.4 Analytical capability

* **Ratio engine** across every reported year plus a live-price snapshot (valuation,
  quality, risk, growth, PEG, grossed-up yield, tangible book).
* **Price analytics**: total/annualised return, volatility, downside volatility, Sharpe,
  Sortino, beta, correlation, Jensen alpha, tracking error, max and current drawdown,
  best/worst day, trailing returns, SMA/Bollinger/RSI, 52-week position.
* **Valuation engine** (`R/valuation.R`, pure functions):
  * Industrial: FCFF DCF from per-year revenue growth, EBIT margin, D&A, capex, NWC and
    tax drivers; WACC build; terminal value share; EV-to-equity bridge; reverse DCF
    (implied growth and implied terminal growth); peer multiples; dividend cross-check.
  * Financial (bank/insurer/financial) and REIT: two-stage dividend discount model with
    EPS growth and payout drivers, franking gross-up at the 30% corporate rate; residual
    income model; justified P/B from (ROE − g)/(Ke − g); peer P/E, P/B and yield.
  * Weighted fair value with analyst weights re-normalised over available methods;
    margin of safety; Buy/Hold/Sell bands (editable).
  * Scenarios (editable deltas and probabilities) and sensitivities (Ke, growth, terminal
    growth, margin or payout; two-way grid), all reported ex- and incl. franking.
  * Football field combining the 52-week range, intrinsic ±100bp Ke bands, peer
    interquartile ranges, the scenario range and the weighted value.
* **Cross-sectional analytics**: peer percentiles, medians, composite scores, screening.

### 3.5 Embedded templates

* **Junior Analyst Financial Model** — all 14 sheets (START HERE, Control & Assumptions,
  Historical Data, Operating Drivers, Working Capital, PPE & D&A, Debt Schedule, Income
  Statement, Balance Sheet, Cash Flow, DCF Valuation, Trading Comps, Model Checks,
  Sources & Notes). Historical columns are populated from Yahoo Finance in $ millions;
  forecast columns and the DCF are **live Excel formulas** driven by yellow input cells,
  with balance-sheet, cash, PPE and equity roll-forward checks.
* **Ratio Guide** — Formula Guide (32 metrics), Historical Financials (one row for the
  subject and one per peer, 68 columns), Ratio Analysis (38 formula columns).
* **Research note** — Markdown in the Fund's investment-recommendation structure
  (Portfolio Recommendation table, thesis, case, risks, catalysts, ESG, model summary,
  scenarios, valuation summary, Appendix A/B/C) readable by the `build_sector_summary.py`
  Markdown parser.

### 3.6 Dashboard design

* bslib `page_navbar` with the MBS magenta navbar, logo and clock; a sticky control bar
  (grouped ticker search, period, load, cache refresh) and a persistent company strip
  (price, change, 52-week position, market cap, P/E, P/B, yield, fair value, margin of
  safety, recommendation badge).
* Nine tabs: Overview, Market, Financials, Ratios, Peers, Valuation, Sector & Screener,
  Benchmarks, Notes & Export.
* Stat tiles with deltas and tooltips (definitions from the Ratio Guide), cards with
  full-screen toggle, DataTables with MBS header styling, subject-row highlighting,
  colour bars and copy/CSV/Excel buttons, editable Handsontable grids with yellow input
  cells, and plotly charts with unified hover, hairline grids and a validated
  categorical palette (subject in MBS magenta, benchmarks in grey).
* Navigation locks while a load is in flight; progress bars report each stage;
  failures degrade the affected panel with a message rather than the session.

### 3.7 Excel styling

Calibri throughout; MBS magenta `#A30046` headers with white bold text; dark maroon
`#5E0028` section bands; light magenta `#F2E3EA` row banding; pale magenta `#D9BFCB`
borders; grey `#595959` notes; yellow `#FFF9DB` input cells; subject rows in a magenta
tint. Numbers are written as numbers with Excel number formats so analysts can compute
on them.

---

## 4. Out of scope (v2)

* Order execution, portfolio accounting or position keeping.
* Consensus estimates, broker research, transcripts, ownership and analyst-rating feeds
  (not exposed by `yahoofinancer` 0.6.1 — `key_stats`, `summary_profile`, `earnings`
  and similar endpoints return NULL).
* Quarterly or half-yearly statements (Yahoo returns none for ASX names).
* Point-in-time fundamentals; real-time streaming quotes.
* Authentication, multi-user persistence of analyst notes (notes live in the session and
  in the exports).
* Direct Word/PDF generation inside the app (the Markdown note feeds the existing Python
  builders).

---

## 5. Data sources and constraints

**Source:** Yahoo Finance via `yahoofinancer` (`yf_get_market_stats`, `yf_get_financials`,
`yf_download_prices`, `Ticker`).

* Annual statements only; some fiscal years arrive with a single field and are dropped
  (`build_fin` keeps a year only when at least two core fields are present).
* Bank statements lack COGS, gross profit and interest expense; EBITDA/EBIT are taken
  from reported fields where present and otherwise derived. The valuation family switches
  methodology for financials, and EV/EBITDA is marked not meaningful.
* Dividends are inferred from adjusted-close ratio steps; special dividends appear as
  larger steps and splits are ignored. Verify against announcements before publishing.
* Load time is network-bound: a company is ~6 HTTP calls (15–30 s uncached), a peer set
  ~5 calls, a sector ~5 calls (30–120 s). Quotes and metadata are cached in memory
  (10–15 min); statements (12 h) and prices (60 min) are cached **on disk** under
  `~/.cache/R/mbs-sif`, so restarting the app does not re-download the market. The
  circular-arrow button in the header clears every cache.
* Yahoo rate-limits bursts; the app batches aggressively and a failed name degrades only
  its own row.

---

## 6. Architecture

```
app/
├── global.R              # packages, options, sources R/, fund defaults
├── ui.R                  # bslib page_navbar, nine tabs, sidebars
├── server.R              # thin shell sourcing R/server_*.R
├── R/
│   ├── brand.R           # MBS tokens, validated chart palette, bslib theme, formatters
│   ├── universe.R        # 152-name ASX universe, peers, benchmarks, FX, model families
│   ├── data.R            # cached batch fetchers, statement normalisation, dividend
│   │                     # inference, price analytics, technicals, load orchestration
│   ├── analytics.R       # DuPont, common-size, peer stats, screener, composite scores
│   ├── valuation.R       # assumptions, DCF, reverse DCF, DDM, RIM, justified P/B,
│   │                     # relative valuation, scenarios, sensitivities, football field
│   ├── charts.R          # plotly chart library (price, rebased, bars, scatter, football
│   │                     # field, heatmap, scenarios, waterfall, dividends, FCFF path)
│   ├── ui_components.R   # tiles, cards, DT helper, metric tooltips, statement tables
│   ├── exports.R         # research workbook, formula-driven model, ratio guide, sector
│   │                     # workbook, research note, zip bundle
│   └── server_*.R        # core / overview / market / financials / ratios / peers /
│                         # valuation / sector / benchmarks / export partials
├── www/mbs.css, mbs.js, mbs_logo_transparent.png
├── tests/
│   ├── smoke.R           # shiny::testServer drive of every output
│   ├── test_exports.R    # live build of every export for a bank and a miner
│   └── validate_universe.R
└── SCOPE.md
```

**Design principles**

* Analytics are pure functions over plain data; the UI and the exports call the same code.
* Sector-aware methodology chosen from the company's valuation family, never applied
  uniformly.
* Graceful degradation: a missing input removes a method or a panel, never produces a
  zero.
* Content separated from presentation, matching the Fund's Word pipeline.
* Charts decimate long daily series to a few hundred points before they reach plotly
  (`thin()` in `charts.R`). Plotly serialises JSON per point, so an undecimated 1,200-day
  line costs seconds per trace; statistics are always computed on the full series.
* Every saved workbook is passed through `xl_finalise()`, which strips the orphaned
  drawing relationships openxlsx writes for sheets without drawings and re-zips the file.
  Without it, strict readers (openpyxl, Power Query, some Excel builds) refuse to open
  the export.

---

## 7. Using the application

```r
# from the repository root
Rscript -e 'shiny::runApp("app", launch.browser = TRUE)'
```

1. Pick a company (grouped by sector) or type any ticker, choose the price window, press
   **Update data** (or Enter). The company loads first, then its peer set.
2. **Overview** shows the tiles, investment view, profile, latest-year summary, trailing
   performance, valuation methods, developments and related securities.
3. **Market**: chart controls, technical levels, risk and return, drawdown, dividends.
4. **Financials**: reported, common-size or growth views of the three statements,
   per-share and payout history, and the Appendix A key financial summary.
5. **Ratios**: every ratio by fiscal year with historical multiples, DuPont, definitions.
6. **Peers**: change the universe and reload; tiles show the subject's percentile rank.
7. **Valuation**: edit cost of capital, terminal and franking assumptions, method weights
   and recommendation bands in the sidebar; edit the per-year driver grid and the
   scenario table in place; review the intrinsic model, football field, scenarios and
   sensitivities.
8. **Sector & Screener**: load the sector (or everything), screen with the sliders,
   export.
9. **Benchmarks**: market board and rebased charts.
10. **Notes & Export**: write the thesis, case, risks, catalysts and ESG notes; download
    the research workbook, the financial model, the ratio guide, the sector workbook, the
    research note or the whole bundle.

Run the tests from `app/` with `Rscript tests/smoke.R` and `Rscript tests/test_exports.R`
(both need network access).

---

## 8. Acceptance criteria

| # | Requirement | Status |
|---|---|---|
| 1 | Load any ASX company and see quote, profile, statements, multi-year ratios | ✅ |
| 2 | Interactive price history with technicals, benchmark comparison and risk metrics | ✅ |
| 3 | Peer comparables with selectable universes, percentiles and charts | ✅ |
| 4 | Sector-appropriate valuation with editable per-year drivers and weights | ✅ |
| 5 | Scenario weighting and 1-D / 2-D sensitivity, ex- and incl. franking | ✅ |
| 6 | Sector screener with composite scores and export | ✅ |
| 7 | Benchmark indices, sector indices, rates, commodities and FX | ✅ |
| 8 | Junior Analyst model exported with live formulas across all template sheets | ✅ |
| 9 | Ratio Guide exported for the subject and its peers with formula-driven ratios | ✅ |
| 10 | Research workbook and research-note draft carrying analyst notes | ✅ |
| 11 | Dashboard and exports consistent with the MBS brand system | ✅ |
| 12 | Graceful handling of missing data, bad tickers and ad-hoc names | ✅ |

---

## 9. Known limitations

* Yahoo fundamentals are annual, can lag the latest result, and occasionally omit a year;
  cross-check against the annual report before publishing a figure.
* Bank cash-flow statements are not comparable to industrials; FCF-based metrics are not
  meaningful for financials and the DCF is not applied to them.
* Beta is estimated from the selected price window; the Fund's reports use beta judgement
  (e.g. 1.07 for Westpac) — override it in the sidebar.
* Inferred dividends depend on Yahoo's adjustment factors; unusual corporate actions can
  produce spurious entries.
* The exported model's historical columns use Yahoo line items; inventory, other current
  items and debt flows are blank or plugged and must be completed from the annual report.
* Loading is synchronous (single R process); long sector loads lock the UI for the session.

---

## 10. Roadmap

| Priority | Item |
|---|---|
| High | Persist analyst notes and assumptions per company (SQLite) so work survives a restart |
| High | Async loading with `ExtendedTask` so sector loads do not block other users |
| Medium | Bank-specific driver grid (NIM × average interest-earning assets, cost-to-income, impairments, CET1 retention) replicating the Westpac FCFE model |
| Medium | Direct `.docx` generation from the Markdown note through `build_mbs_docx.py` |
| Medium | Portfolio view of the Fund's holdings, active weights and limit checks against the IPS |
| Low | Alternative fundamentals source for half-yearly statements and consensus |

---

## 11. Governance and disclaimer

Prepared for the Melbourne Business School Student Investment Fund for educational use.
The application is not licensed to provide financial product advice under the
*Corporations Act 2001* (Cth). Outputs do not constitute financial product advice and must
not be relied upon as such. Data is sourced from Yahoo Finance and is not warranted as
accurate or complete.

Melbourne Business School · The University of Melbourne · 200 Leicester Street,
Carlton VIC 3053 · CRICOS Provider No. 00116K
