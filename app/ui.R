# ===========================================================================
# UI — bslib page_navbar shell with a persistent company header strip.
# ===========================================================================

sidebar_num <- function(id, label, value, min, max, step, suffix = "%", tip = NULL) {
  div(class = "mbs-input",
      tags$label(`for` = id, class = "mbs-input-label", if (!is.null(tip)) metric_tip(tip, label) else label),
      div(class = "input-group input-group-sm",
          numericInput(id, label = NULL, value = value, min = min, max = max, step = step, width = "100%"),
          if (!is.null(suffix)) span(class = "input-group-text", suffix)))
}

control_bar <- div(class = "mbs-controlbar",
  div(class = "mbs-controls",
    div(class = "ctrl ctrl-company",
        selectizeInput("company", label = NULL, choices = universe_choices(), selected = "WBC.AX", width = "100%",
                       options = list(create = TRUE, placeholder = "Search the ASX universe or type any ticker (e.g. WBC.AX)",
                                      createOnBlur = TRUE, maxOptions = 300))),
    div(class = "ctrl ctrl-period", selectInput("period", label = NULL, choices = period_choices, selected = "5y", width = "100%")),
    div(class = "ctrl", actionButton("go", "Update data", class = "btn-primary btn-sm", icon = icon("magnifying-glass-chart"))),
    div(class = "ctrl", bslib::tooltip(actionButton("refresh", NULL, class = "btn-outline-secondary btn-sm", icon = icon("rotate")),
                                       "Clear the data cache and reload from Yahoo Finance")),
    div(class = "ctrl ctrl-status",
        uiOutput("clock", inline = TRUE),
        uiOutput("load_status", inline = TRUE))
  ),
  uiOutput("company_strip")
)

# ---------------------------------------------------------------------------
# Sidebar navigation — mirrors the web app shell: brand block, grouped nav and
# footer. Each link drives navset_hidden("main_nav") via the `nav_page` input.
# ---------------------------------------------------------------------------
NAV_GROUPS <- list(
  Company = list(
    list("Overview", "house", "overview"),
    list("Market & risk", "chart-line", "market"),
    list("Financials", "table-list", "financials"),
    list("Ratios", "percent", "ratios"),
    list("Peer comparison", "people-group", "peers", children = list(list("Peer universe", "list-ul", "peer_universe"))),
    list("Valuation", "scale-balanced", "valuation", children = list(list("Assumptions", "sliders", "valuation_assumptions")))
  ),
  `Cross-section` = list(
    list("Sector & screener", "layer-group", "sector", children = list(list("Universe options", "filter", "sector_universe"))),
    list("Benchmarks", "globe", "bench")
  ),
  Output = list(
    list("Downloads", "file-export", "export")
  )
)

nav_link <- function(page, label, icon_name, active = FALSE, sub = FALSE) {
  js <- paste0(
    "document.querySelectorAll('.mbs-nav-item').forEach(function(e){e.classList.toggle('active', e.getAttribute('data-page')==='", page, "');});",
    "Shiny.setInputValue('nav_page', '", page, "', {priority: 'event'}); return false;"
  )
  tags$a(
    class = paste0("mbs-nav-item", if (sub) " sub" else "", if (active) " active" else ""),
    href = "#", `data-page` = page, onclick = js,
    shiny::icon(icon_name), tags$span(class = "nav-label", label)
  )
}

mbs_sidebar <- function() {
  blocks <- lapply(names(NAV_GROUPS), function(g) {
    kids <- lapply(NAV_GROUPS[[g]], function(it) {
      parent <- nav_link(it[[3]], it[[1]], it[[2]], active = it[[3]] == "overview")
      children <- it$children
      if (length(children)) {
        tagList(parent, tags$div(class = "mbs-subnav",
          lapply(children, function(ch) nav_link(ch[[3]], ch[[1]], ch[[2]], sub = TRUE))))
      } else parent
    })
    tags$div(class = "mbs-nav-group", tags$div(class = "nav-group-label", g), kids)
  })
  sidebar(
    id = "nav_sidebar", width = 250, open = TRUE, class = "mbs-nav-sidebar",
    div(class = "mbs-brand-block",
        div(class = "brand-badge", "MBS"),
        div(class = "brand-text",
            div(class = "brand-title", "Student Investment Fund"),
            div(class = "brand-sub", "Equity Research"))),
    div(class = "mbs-nav", blocks)
  )
}

# ------------------------------------------------------------------ Tab: Overview
tab_overview <- nav_panel("Overview", value = "overview", icon = icon("house"),
  withSpinner(uiOutput("overview_ui"), proxy.height = "400px")
)

# ------------------------------------------------------------------ Tab: Market
tab_market <- nav_panel("Market", value = "market", icon = icon("chart-line"),
  layout_columns(col_widths = c(9, 3), gap = "12px",
    mbs_card("Price history", subtitle = "Daily OHLC with moving averages, Bollinger bands, volume and RSI",
      tools = div(class = "d-flex gap-2 align-items-center flex-wrap",
        checkboxGroupInput("px_overlays", NULL, c("SMA 20" = "sma20", "SMA 50" = "sma50", "SMA 200" = "sma200", "Bollinger" = "bb"),
                           selected = c("sma50", "sma200"), inline = TRUE),
        checkboxInput("px_volume", "Volume", TRUE), checkboxInput("px_rsi", "RSI", FALSE), checkboxInput("px_log", "Log", FALSE)),
      withSpinner(plotlyOutput("price_chart", height = "520px"), proxy.height = "520px")),
    div(
      mbs_card("Technical levels", withSpinner(uiOutput("tech_panel"), proxy.height = "260px"), full_screen = FALSE),
      mbs_card("Risk & return", subtitle = "Over the selected history window", withSpinner(uiOutput("risk_panel"), proxy.height = "200px"), full_screen = FALSE)
    )
  ),
  layout_columns(col_widths = c(5, 7), gap = "12px",
    mbs_card("Trailing performance", subtitle = "Total-return proxy (adjusted close) vs the S&P/ASX 200",
             withSpinner(DTOutput("perf_dt"), proxy.height = "260px")),
    mbs_card("Relative performance", subtitle = "Rebased to 100 — company, sector index and S&P/ASX 200",
             withSpinner(plotlyOutput("relative_chart", height = "300px"), proxy.height = "300px"))
  ),
  layout_columns(col_widths = c(4, 4, 4), gap = "12px",
    mbs_card("Drawdown from peak", plotlyOutput("drawdown_chart", height = "260px")),
    mbs_card("Rolling 60-day volatility", plotlyOutput("vol_chart", height = "260px")),
    mbs_card("Distribution of daily returns", plotlyOutput("hist_chart", height = "260px"))
  ),
  layout_columns(col_widths = c(7, 5), gap = "12px",
    mbs_card("Dividend history", subtitle = "Cash dividends per share inferred from Yahoo's adjusted-close series (ex-dates)",
             plotlyOutput("div_chart", height = "260px")),
    mbs_card("Dividend register", DTOutput("div_dt"), full_screen = FALSE)
  ),
  mbs_card("Significant developments", subtitle = "Headline events reported by Yahoo Finance", DTOutput("news_dt"), full_screen = FALSE)
)

# ------------------------------------------------------------------ Tab: Financials
tab_financials <- nav_panel("Financials", value = "financials", icon = icon("table-list"),
  div(class = "mbs-toolbar",
      radioButtons("fin_view", NULL, c("Reported ($m)" = "reported", "Common-size (%)" = "common", "YoY growth" = "growth"), inline = TRUE),
      muted("Annual statements in reporting currency, as published by Yahoo Finance. Empty fiscal years are dropped, not zeroed.")),
  navset_card_tab(id = "fin_tabs",
    nav_panel("Income statement",
      layout_columns(col_widths = c(7, 5), gap = "12px",
        withSpinner(DTOutput("income_dt"), proxy.height = "400px"),
        div(plotlyOutput("rev_ni_chart", height = "240px"), plotlyOutput("margin_chart", height = "240px")))),
    nav_panel("Balance sheet",
      layout_columns(col_widths = c(7, 5), gap = "12px",
        withSpinner(DTOutput("balance_dt"), proxy.height = "400px"),
        div(plotlyOutput("bs_chart", height = "240px"), plotlyOutput("leverage_chart", height = "240px")))),
    nav_panel("Cash flow",
      layout_columns(col_widths = c(7, 5), gap = "12px",
        withSpinner(DTOutput("cashflow_dt"), proxy.height = "400px"),
        div(plotlyOutput("cf_chart", height = "240px"), plotlyOutput("capex_chart", height = "240px")))),
    nav_panel("Per share & payout",
      layout_columns(col_widths = c(7, 5), gap = "12px",
        withSpinner(DTOutput("pershare_dt"), proxy.height = "300px"),
        div(plotlyOutput("eps_dps_chart", height = "240px"), plotlyOutput("payout_chart", height = "240px")))),
    nav_panel("Key financial summary",
      muted("Appendix A format from the Fund's research reports: volume, margin, cost, profitability and capital lines by fiscal year."),
      withSpinner(DTOutput("summary_dt"), proxy.height = "300px"))
  )
)

# ------------------------------------------------------------------ Tab: Ratios
tab_ratios <- nav_panel("Ratios", value = "ratios", icon = icon("percent"),
  layout_columns(col_widths = c(7, 5), gap = "12px",
    mbs_card("Ratio analysis by fiscal year", subtitle = "Valuation uses the current price; quality, risk and growth use reported statements",
             withSpinner(DTOutput("ratio_hist_dt"), proxy.height = "500px")),
    div(
      mbs_card("Returns & margins", plotlyOutput("ratio_returns_chart", height = "230px")),
      mbs_card("DuPont decomposition", subtitle = "ROE = net margin × asset turnover × equity multiplier",
               DTOutput("dupont_dt"), full_screen = FALSE),
      mbs_card("Leverage & coverage", plotlyOutput("ratio_lev_chart", height = "230px"))
    )
  ),
  bslib::accordion(open = FALSE, bslib::accordion_panel("Formula guide — definitions used throughout the workstation",
    DTOutput("formula_dt")))
)

# ------------------------------------------------------------------ Tab: Peers
tab_peers <- nav_panel("Peer comparison", value = "peers", icon = icon("people-group"),
  withSpinner(uiOutput("peer_summary"), proxy.height = "180px"),
  mbs_card("Trading comparables", subtitle = "Latest fiscal year fundamentals with live prices; medians exclude the subject company",
           tools = muted("Export via the buttons above the table"),
           withSpinner(DTOutput("peer_dt"), proxy.height = "320px")),
  layout_columns(col_widths = c(4, 4, 4), gap = "12px",
    mbs_card("P/E (trailing)", plotlyOutput("peer_pe_chart", height = "280px")),
    mbs_card("P/B", plotlyOutput("peer_pb_chart", height = "280px")),
    mbs_card("EV / EBITDA", plotlyOutput("peer_ev_chart", height = "280px"))),
  layout_columns(col_widths = c(4, 4, 4), gap = "12px",
    mbs_card("Dividend yield", plotlyOutput("peer_dy_chart", height = "280px")),
    mbs_card("Return on equity", plotlyOutput("peer_roe_chart", height = "280px")),
    mbs_card("Net margin", plotlyOutput("peer_nm_chart", height = "280px"))),
  layout_columns(col_widths = c(6, 6), gap = "12px",
    mbs_card("P/B vs ROE", subtitle = "The excess-returns relationship the justified P/B model formalises",
             plotlyOutput("peer_scatter_pb", height = "320px")),
    mbs_card("P/E vs EPS growth", subtitle = "Growth-adjusted valuation (PEG intuition)",
             plotlyOutput("peer_scatter_pe", height = "320px"))),
  mbs_card("One-year relative performance", subtitle = "Rebased to 100 at the start of the window",
           plotlyOutput("peer_perf_chart", height = "320px"))
)

tab_peer_universe <- nav_panel("Peer universe", value = "peer_universe", icon = icon("list-ul"),
  mbs_card("Peer universe", subtitle = "Choose the comparables set that feeds relative valuation and the football field",
    radioButtons("peer_mode", NULL, c("Industry peers (curated)" = "auto", "Full GICS sector" = "sector", "Custom tickers" = "custom"), selected = "auto"),
    conditionalPanel("input.peer_mode == 'custom'",
      textAreaInput("custom_peers", "ASX codes (comma or space separated)", placeholder = "CBA, NAB, ANZ, MQG", rows = 3)),
    actionButton("peer_load", "Load / refresh peers", class = "btn-primary btn-sm", icon = icon("download")),
    hr(),
    muted("Peer multiples feed the relative valuation and the football field on the Valuation tab. Subject company is highlighted."),
    uiOutput("peer_status")
  )
)

# ------------------------------------------------------------------ Tab: Valuation
valuation_assumptions_ui <- tagList(
  bslib::accordion(multiple = TRUE, open = c("Cost of capital"),
    bslib::accordion_panel("Cost of capital",
      sidebar_num("rf", "Risk-free rate", FUND_DEFAULTS$rf, 0, 15, 0.1),
      sidebar_num("beta", "Equity beta", 1.0, 0, 3, 0.01, suffix = NULL, tip = "beta"),
      sidebar_num("mrp", "Market risk premium", FUND_DEFAULTS$mrp, 0, 15, 0.1),
      sidebar_num("kd", "Pre-tax cost of debt", FUND_DEFAULTS$kd, 0, 20, 0.1),
      sidebar_num("dw", "Debt / capital (WACC)", 20, 0, 90, 1),
      sidebar_num("tax", "Tax rate", FUND_DEFAULTS$tax, 0, 50, 0.5),
      uiOutput("ke_readout")),
    bslib::accordion_panel("Terminal value & franking",
      sidebar_num("tg", "Terminal growth", FUND_DEFAULTS$tg, -2, 6, 0.1),
      sidebar_num("franking", "Franking level", FUND_DEFAULTS$franking, 0, 100, 5),
      checkboxInput("midyear", "Mid-year discounting (DCF)", FALSE),
      selectInput("horizon", "Explicit forecast years", choices = 3:10, selected = 5),
      radioButtons("basis", "Headline basis", c("Including franking credits" = "fc", "Excluding franking credits" = "ex"), selected = "fc")),
    bslib::accordion_panel("Method weights",
      muted("Weights are re-normalised across the methods that are available for this company."),
      sidebar_num("w_dcf", "FCFF DCF", 50, 0, 100, 5),
      sidebar_num("w_ddm", "Dividend discount", 40, 0, 100, 5),
      sidebar_num("w_rim", "Residual income", 20, 0, 100, 5),
      sidebar_num("w_pe", "Peer P/E", 20, 0, 100, 5),
      sidebar_num("w_pb", "Peer P/B", 20, 0, 100, 5),
      sidebar_num("w_ev", "Peer EV/EBITDA", 20, 0, 100, 5)),
    bslib::accordion_panel("Recommendation bands",
      sidebar_num("rec_buy", "Buy at MoS ≥", FUND_DEFAULTS$buy, 0, 50, 1),
      sidebar_num("rec_sell", "Sell at MoS ≤", FUND_DEFAULTS$sell, -50, 0, 1))
  ),
  actionButton("reset_assumptions", "Reset to defaults", class = "btn-outline-secondary btn-sm", icon = icon("arrow-rotate-left"))
)

tab_valuation <- nav_panel("Valuation", value = "valuation", icon = icon("scale-balanced"),
  withSpinner(uiOutput("val_header"), proxy.height = "120px"),
    layout_columns(col_widths = c(6, 6), gap = "12px",
      mbs_card("Valuation summary", subtitle = "Every method, its weight and implied value", withSpinner(DTOutput("methods_dt"), proxy.height = "260px")),
      mbs_card("Football field", subtitle = "Value ranges by method against the current price", plotlyOutput("football_chart", height = "320px"))),
    navset_card_tab(id = "val_tabs",
      nav_panel("Forecast drivers",
        layout_columns(col_widths = c(5, 7), gap = "12px",
          div(muted("Edit the yellow cells directly. Growth, margins and ratios are decimals (0.05 = 5%). Changes recalculate every model instantly."),
              rHandsontableOutput("grid_hot"),
              div(class = "mt-2", actionButton("grid_reset", "Reset drivers", class = "btn-outline-secondary btn-sm", icon = icon("arrow-rotate-left")))),
          div(plotlyOutput("proj_chart", height = "300px"), withSpinner(DTOutput("proj_dt"), proxy.height = "200px")))),
      nav_panel("Intrinsic model",
        withSpinner(uiOutput("intrinsic_ui"), proxy.height = "300px")),
      nav_panel("Scenarios",
        layout_columns(col_widths = c(5, 7), gap = "12px",
          div(muted("Bear / base / bull deltas are applied on top of the base-case drivers; weights are probabilities and should sum to 100%."),
              rHandsontableOutput("scen_hot"),
              div(class = "mt-2", actionButton("scen_reset", "Reset scenarios", class = "btn-outline-secondary btn-sm", icon = icon("arrow-rotate-left"))),
              br(), withSpinner(DTOutput("scen_dt"), proxy.height = "160px")),
          plotlyOutput("scen_chart", height = "380px"))),
      nav_panel("Sensitivity",
        layout_columns(col_widths = c(7, 5), gap = "12px",
          mbs_card("Two-way sensitivity", subtitle = "Primary intrinsic method per share; cells show value and margin of safety",
                   plotlyOutput("sens2d_chart", height = "360px")),
          div(
            mbs_card("Cost of equity", DTOutput("sens_ke_dt"), full_screen = FALSE),
            mbs_card("Growth", DTOutput("sens_g_dt"), full_screen = FALSE))),
        layout_columns(col_widths = c(6, 6), gap = "12px",
          mbs_card("Terminal growth", DTOutput("sens_tg_dt"), full_screen = FALSE),
          mbs_card("Margin / payout", DTOutput("sens_m_dt"), full_screen = FALSE)))
  )
)

tab_valuation_assumptions <- nav_panel("Assumptions", value = "valuation_assumptions", icon = icon("sliders"),
  mbs_card("Valuation assumptions", subtitle = "Changes recalculate every model instantly across the Valuation tab",
    valuation_assumptions_ui)
)

# ------------------------------------------------------------------ Tab: Sector & screener
tab_sector <- nav_panel("Sector & screener", value = "sector", icon = icon("layer-group"),
  withSpinner(uiOutput("sector_header"), proxy.height = "280px"),
  mbs_card("Sector table", subtitle = "Ranked comparables with composite quality / value / growth / momentum scores",
           withSpinner(DTOutput("sector_dt"), proxy.height = "400px")),
  layout_columns(col_widths = c(6, 6), gap = "12px",
    mbs_card("P/B vs ROE", plotlyOutput("sector_scatter1", height = "320px")),
    mbs_card("EV/EBITDA vs revenue growth", plotlyOutput("sector_scatter2", height = "320px"))),
  layout_columns(col_widths = c(6, 6), gap = "12px",
    mbs_card("Market capitalisation", plotlyOutput("sector_mcap_chart", height = "360px")),
    mbs_card("One-year total return", plotlyOutput("sector_ret_chart", height = "360px"))),
  mbs_card("Industry medians", DTOutput("sector_median_dt"), full_screen = FALSE)
)

tab_sector_universe <- nav_panel("Universe options", value = "sector_universe", icon = icon("filter"),
  mbs_card("Universe & screen", subtitle = "Choose the universe and screening bands, then run the screen",
    uiOutput("screen_count"),
    selectInput("sector_pick", "GICS sector", choices = c("All sectors (whole universe)" = "ALL", sort(unique(asx_universe$sector)))),
    selectInput("scr_industry", "Industry", choices = "All industries", selected = "All industries", selectize = FALSE),
    selectInput("scr_rec", "Recommendation", choices = c("Any" = "any", "Buy", "Hold", "Sell"), selected = "any", selectize = FALSE),
    checkboxInput("scr_div_only", "Dividend payers only", FALSE),
    sliderInput("scr_pe", "P/E", 0, 80, c(0, 80), step = 1),
    sliderInput("scr_pb", "P/B", 0, 20, c(0, 20), step = 0.5),
    sliderInput("scr_dy", "Dividend yield (%)", 0, 15, c(0, 15), step = 0.5),
    sliderInput("scr_roe", "ROE (%)", -50, 100, c(-50, 100), step = 5),
    sliderInput("scr_mcap", "Market cap ($bn)", 0, 300, c(0, 300), step = 5),
    sliderInput("scr_mos", "Margin of safety (%)", -100, 100, c(-100, 100), step = 5),
    actionButton("sector_load", "Run screen", class = "btn-primary btn-sm", icon = icon("magnifying-glass-chart")),
    muted("Pre-filters the universe on sector, industry and market cap (listing snapshot) first, then loads live quotes, statements and one-year prices only for those candidates. Ratio, yield, dividend and valuation filters are applied to the loaded data because they need live statements.")
  )
)

# ------------------------------------------------------------------ Tab: Benchmarks
tab_bench <- nav_panel("Benchmarks", value = "bench", icon = icon("globe"),
  layout_columns(col_widths = c(7, 5), gap = "12px",
    mbs_card("Market board", subtitle = "Indices, sector indices, yields, commodities and FX — position within 52-week range shown as a bar",
             withSpinner(DTOutput("bench_dt"), proxy.height = "500px")),
    div(
      mbs_card("Equity benchmarks (1Y, rebased)", plotlyOutput("bench_chart", height = "260px")),
      mbs_card("S&P/ASX 200 sector indices (1Y, rebased)", plotlyOutput("bench_sector_chart", height = "300px")),
      mbs_card("AUD / USD (1Y)", plotlyOutput("fx_chart", height = "220px"))
    )
  ),
  bslib::accordion(open = FALSE, bslib::accordion_panel("Cost-of-capital reference",
    p("The Fund's research uses the Australian 10-year government bond yield as the risk-free rate (4.3–4.7% through 2026) and a 6% market risk premium, consistent with IPART's long-run estimate. Yahoo Finance does not carry Australian government bond yields; the US Treasury curve above is shown as a global reference. Enter the current AGB 10-year yield on the Valuation tab.")))
)

# ------------------------------------------------------------------ Tab: Downloads
tab_export <- nav_panel("Downloads", value = "export", icon = icon("file-export"),
  layout_columns(col_widths = c(6, 6), gap = "12px",
    mbs_card("Downloads", subtitle = "MBS-branded Excel workbooks and the Word research-note template",
      div(class = "d-grid gap-2",
        downloadButton("dl_company", "Company research workbook", class = "btn-download"),
        downloadButton("dl_model", "Junior Analyst financial model (formula-driven, 14 sheets)", class = "btn-download"),
        downloadButton("dl_ratio", "Ratio Guide workbook (company + peers)", class = "btn-download"),
        downloadButton("dl_sector", "Sector / screener workbook", class = "btn-download"),
        downloadButton("dl_note", "Investment recommendation — Word template (.docx)", class = "btn-download"),
        downloadButton("dl_bundle", "Everything (zip)", class = "btn-download-dark")),
      full_screen = FALSE)
  )
)

# ------------------------------------------------------------------ Page
ui <- page_fluid(
  title = NULL,
  theme = mbs_bs_theme(),
  lang = "en-AU",
  tags$head(
    tags$title("MBS SIF — Equity Research"),
    tags$meta(name = "viewport", content = "width=device-width, initial-scale=1"),
    tags$link(rel = "stylesheet", type = "text/css", href = "mbs.css"),
    tags$script(src = "mbs.js")
  ),
  layout_sidebar(
    fillable = FALSE,
    border = FALSE,
    sidebar = mbs_sidebar(),
    control_bar,
    navset_hidden(
      id = "main_nav",
      tab_overview, tab_market, tab_financials, tab_ratios, tab_peers, tab_peer_universe,
      tab_valuation, tab_valuation_assumptions, tab_sector, tab_sector_universe, tab_bench, tab_export
    )
  )
)
