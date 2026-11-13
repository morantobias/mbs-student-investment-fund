# ===========================================================================
# UI building blocks — stat tiles, cards, tables, badges, metric definitions.
# ===========================================================================

# Metric definitions (from the Fund's Ratio Guide) for tooltips and exports.
metric_defs <- list(
  pe_ratio = "P/E — share price / trailing diluted EPS. Positive earnings only.",
  forward_pe = "Forward P/E — share price / forecast EPS (analyst FY1 estimate).",
  pb_ratio = "P/B — market capitalisation / book equity (price / book value per share).",
  p_tbv = "P/TBV — price / tangible book value per share (equity less goodwill & intangibles).",
  ev_ebitda = "EV/EBITDA — enterprise value / EBITDA. EV = market cap + net debt.",
  ev_ebit = "EV/EBIT — enterprise value / EBIT.",
  ev_revenue = "EV/Revenue — enterprise value / revenue.",
  fcf_yield = "FCF yield — free cash flow / market capitalisation.",
  dividend_yield = "Dividend yield — trailing 12-month dividends per share / price (ex franking).",
  grossed_yield = "Grossed-up yield — dividend yield including franking credits at 100% franking (÷ 0.7).",
  peg = "PEG — P/E divided by historical EPS CAGR (in percentage points).",
  roic = "ROIC — NOPAT / average invested capital (EBIT × (1 − tax rate)).",
  roe = "ROE — net income / average book equity.",
  roa = "ROA — net income / average total assets.",
  ebit_margin = "Operating (EBIT) margin — EBIT / revenue.",
  net_margin = "Net margin — net income / revenue.",
  cash_conversion = "Cash conversion — operating cash flow / net income.",
  net_debt_ebitda = "Net debt / EBITDA — (total debt − cash) / EBITDA. Not meaningful for banks.",
  interest_coverage = "Interest coverage — EBIT / net interest expense.",
  payout = "Payout ratio — dividends paid / net income.",
  equity_assets = "Equity / assets — book equity as a share of total assets (bank leverage proxy).",
  revenue_cagr = "Revenue CAGR — (latest / base)^(1 / years) − 1 over the reported history.",
  eps_cagr = "EPS CAGR — compound annual growth in diluted EPS over the reported history.",
  beta = "Beta — covariance of daily returns with the S&P/ASX 200 over the selected window.",
  sharpe = "Sharpe ratio — (annualised return − risk-free) / annualised volatility.",
  max_drawdown = "Maximum drawdown — largest peak-to-trough fall in adjusted price over the window.",
  mos = "Margin of safety — weighted fair value / current price − 1."
)

metric_tip <- function(key, label) {
  d <- metric_defs[[key]]
  if (is.null(d)) return(label)
  bslib::tooltip(span(label, icon("circle-info", class = "mbs-tip")), d, placement = "top")
}

stat_tile <- function(label, value, note = NULL, delta = NULL, delta_fmt = fmt_pct, up_is_good = TRUE,
                      class = "", tip = NULL, icon_name = NULL) {
  value <- if (is.null(value) || length(value) == 0 || is.na(value) || !nzchar(value)) "–" else value
  delta_tag <- NULL
  if (!is.null(delta) && length(delta) == 1 && !is.na(delta)) {
    good <- if (up_is_good) delta >= 0 else delta <= 0
    delta_tag <- span(class = paste("delta", if (good) "good" else "bad"),
                      if (delta >= 0) HTML("&#9650;") else HTML("&#9660;"), " ", delta_fmt(abs(delta)))
  }
  long <- is.character(value) && nchar(value) > 9
  div(class = paste("mbs-tile", class),
      div(class = "tile-label", title = label, if (!is.null(tip)) metric_tip(tip, label) else label),
      div(class = paste("tile-value", if (long) "sm"), value, delta_tag),
      if (!is.null(note)) div(class = "tile-note", note))
}

tile_row <- function(..., widths = NULL) {
  items <- list(...)
  items <- items[!vapply(items, is.null, logical(1))]
  n <- length(items)
  if (n == 0) return(NULL)
  bslib::layout_columns(col_widths = widths %||% rep(floor(12 / n), n), gap = "10px", !!!items)
}

mbs_card <- function(title, ..., subtitle = NULL, tools = NULL, class = "", full_screen = TRUE, padding = NULL, min_height = NULL) {
  bslib::card(
    class = paste("mbs-card", class), full_screen = full_screen, min_height = min_height,
    bslib::card_header(
      div(class = "mbs-card-head",
          div(div(class = "mbs-card-title", title), if (!is.null(subtitle)) div(class = "mbs-card-sub", subtitle)),
          if (!is.null(tools)) div(class = "mbs-card-tools", tools))
    ),
    bslib::card_body(padding = padding, ...)
  )
}

section_heading <- function(text, sub = NULL) {
  tagList(div(class = "mbs-h1", text), if (!is.null(sub)) div(class = "mbs-sub", sub))
}

rec_badge <- function(rec) {
  cls <- switch(rec %||% "n/a", Buy = "buy", Sell = "sell", Hold = "hold", "na")
  span(class = paste("mbs-rec", cls), rec %||% "n/a")
}

banner <- function(..., class = "") div(class = paste("mbs-banner", class), ...)

muted <- function(...) div(class = "mbs-muted", ...)

empty_state <- function(msg, icon_name = "circle-info") {
  div(class = "mbs-empty", icon(icon_name), span(msg))
}

# Key-value table from a named list / two-column data
kv_table <- function(pairs, class = "") {
  rows <- purrr::imap(pairs, function(v, k) tags$tr(tags$td(class = "k", k), tags$td(class = "v", v %||% "–")))
  tags$table(class = paste("mbs-kv", class), tags$tbody(rows))
}

# Company summary table — Metric | Value | Context. Replaces the stat-tile grid
# on the Overview tab with a single, scannable table.
summary_row <- function(label, value, note = NULL, tip = NULL, class = "") {
  list(label = label, value = value, note = note, tip = tip, class = class)
}

summary_table <- function(rows) {
  trs <- lapply(rows, function(r) {
    lab <- if (!is.null(r$tip) && nzchar(r$tip)) metric_tip(r$tip, r$label) else r$label
    tags$tr(
      class = r$class %||% "",
      tags$td(class = "mbs-sum-label", lab),
      tags$td(class = "mbs-sum-value", r$value),
      tags$td(class = "mbs-sum-note", r$note %||% "")
    )
  })
  tags$table(
    class = "mbs-summary",
    tags$thead(tags$tr(tags$th("Metric"), tags$th("Value"), tags$th("Context"))),
    tags$tbody(trs)
  )
}

# --- DT helpers ----------------------------------------------------------------------
# kinds: named character vector column -> "money" | "moneym" | "pct" | "x" | "num0" | "num2" | "num3" | "int" | "text"
dt_mbs <- function(df, kinds = NULL, highlight_col = NULL, highlight_val = NULL, page = 25, dom = "t",
                   buttons = FALSE, order = NULL, colour_cols = NULL, bar_cols = NULL, scroll_x = TRUE,
                   escape = TRUE, selection = "none", bold_rows = NULL, caption = NULL, ...) {
  if (is.null(df) || nrow(df) == 0) return(NULL)
  opts <- list(pageLength = page, dom = if (buttons) paste0("B", dom) else dom, scrollX = scroll_x,
               autoWidth = FALSE, ordering = !is.null(order) || dom != "t",
               columnDefs = list(list(className = "dt-right", targets = unname(which(vapply(df, is.numeric, logical(1)))) - 1)))
  if (!is.null(order)) opts$order <- order
  ext <- character(0)
  if (buttons) {
    ext <- "Buttons"
    opts$buttons <- list(list(extend = "copy", text = "Copy"), list(extend = "csv", text = "CSV"),
                         list(extend = "excel", text = "Excel"))
  }
  d <- DT::datatable(df, options = opts, rownames = FALSE, class = "compact stripe hover mbs-dt", extensions = ext,
                     escape = escape, selection = selection, caption = caption, ...)
  if (!is.null(kinds)) {
    for (col in names(kinds)) {
      if (!col %in% names(df)) next
      k <- kinds[[col]]
      d <- switch(k,
        money  = DT::formatCurrency(d, col, currency = "$", digits = 2),
        moneym = DT::formatCurrency(d, col, currency = "$", digits = 0),
        pct    = DT::formatPercentage(d, col, digits = 1),
        pct2   = DT::formatPercentage(d, col, digits = 2),
        x      = DT::formatRound(d, col, digits = 1),
        x2     = DT::formatRound(d, col, digits = 2),
        num0   = DT::formatRound(d, col, digits = 0),
        num2   = DT::formatRound(d, col, digits = 2),
        num3   = DT::formatRound(d, col, digits = 3),
        int    = DT::formatRound(d, col, digits = 0),
        d)
    }
  }
  if (!is.null(highlight_col) && !is.null(highlight_val)) {
    d <- DT::formatStyle(d, highlight_col, target = "row",
                         backgroundColor = DT::styleEqual(highlight_val, MBS$tint),
                         fontWeight = DT::styleEqual(highlight_val, "bold"))
  }
  if (!is.null(colour_cols)) {
    for (col in colour_cols) if (col %in% names(df))
      d <- DT::formatStyle(d, col, color = DT::styleInterval(0, c(MBS$negative, MBS$positive)))
  }
  if (!is.null(bar_cols)) {
    for (col in bar_cols) if (col %in% names(df)) {
      rng <- range(df[[col]], na.rm = TRUE)
      if (all(is.finite(rng))) d <- DT::formatStyle(d, col, background = DT::styleColorBar(rng, "rgba(163,0,70,0.18)"), backgroundSize = "95% 70%", backgroundRepeat = "no-repeat", backgroundPosition = "center")
    }
  }
  if (!is.null(bold_rows)) d <- DT::formatStyle(d, 0, target = "row", fontWeight = DT::styleRow(bold_rows, "bold"))
  d
}

# Transposed statement table: rows = line items, cols = years; values already formatted.
statement_table <- function(fin, items, scale = 1e6, digits = 0, pct_rows = character(0), per_share_rows = character(0)) {
  if (is.null(fin) || nrow(fin) == 0) return(NULL)
  rows <- purrr::imap(items, function(lab, col) {
    v <- if (col %in% names(fin)) fin[[col]] else rep(NA_real_, nrow(fin))
    txt <- if (col %in% pct_rows) fmt_pct(v, 1) else if (col %in% per_share_rows) fmt_num(v, 3) else fmt_num(v / scale, digits)
    c(`Line item` = lab, setNames(as.list(txt), fin$label))
  })
  dplyr::bind_rows(rows)
}

# Period choices
period_choices <- c("6M" = "6mo", "1Y" = "1y", "2Y" = "2y", "5Y" = "5y", "10Y" = "10y", "YTD" = "ytd", "Max" = "max")
