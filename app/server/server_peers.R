# --- Peers tab --------------------------------------------------------------------------
peer_cols <- c(code = "Code", name = "Company", industry = "Industry", price = "Price", market_cap = "Mkt cap ($m)", pe_ratio = "P/E", pb_ratio = "P/B",
               ev_ebitda = "EV/EBITDA", ev_revenue = "EV/Rev", dividend_yield = "Div yield", grossed_yield = "Gross yield", roe = "ROE", roa = "ROA",
               net_margin = "Net margin", ebit_margin = "EBIT margin", net_debt_ebitda = "ND/EBITDA", payout = "Payout",
               revenue_cagr = "Rev CAGR", eps_cagr = "EPS CAGR", return_1y = "1y return", fy_label = "FY")
peer_kinds <- c(Price = "money", `Mkt cap ($m)` = "num0", `P/E` = "x", `P/B` = "x2", `EV/EBITDA` = "x", `EV/Rev` = "x2", `Div yield` = "pct", `Gross yield` = "pct",
                ROE = "pct", ROA = "pct2", `Net margin` = "pct", `EBIT margin` = "pct", `ND/EBITDA` = "x", Payout = "pct", `Rev CAGR` = "pct", `EPS CAGR` = "pct", `1y return` = "pct")

peer_display <- function(tbl, subject_code, with_median = TRUE) {
  if (is.null(tbl) || nrow(tbl) == 0) return(NULL)
  d <- tbl %>% mutate(market_cap = market_cap / 1e6) %>% select(any_of(names(peer_cols)))
  if (with_median) {
    peers_only <- d[d$code != subject_code, ]
    med <- peers_only %>% summarise(across(where(is.numeric), ~ stats::median(.x, na.rm = TRUE)))
    med$code <- "MEDIAN"; med$name <- "Peer median (excl. subject)"; med$industry <- ""; med$fy_label <- ""
    d <- bind_rows(d, med)
  }
  names(d) <- unname(peer_cols[names(d)])
  d
}

output$peer_status <- renderUI({
  p <- peers_rv(); b <- bd()
  if (is.null(p)) return(muted("Peers load automatically after the company; use the button to apply a different universe."))
  div(class = "mbs-banner", style = "font-size:12px;", strong(rv$peers_label %||% "Peers"), br(),
      paste(nrow(p$table), "companies ·", paste(setdiff(p$table$code, b$code), collapse = ", ")))
})

output$peer_summary <- renderUI({
  b <- bd(); p <- peers_tbl(); req(b)
  if (is.null(p)) return(empty_state("Peer set loading…", "spinner"))
  pc <- peer_percentiles(p, b$code, c("pe_ratio", "pb_ratio", "ev_ebitda", "dividend_yield", "roe", "net_margin", "revenue_cagr", "return_1y"))
  row <- function(metric, label, fmt) {
    r <- pc[pc$metric == metric, ]
    if (nrow(r) == 0) return(NULL)
    summary_row(label, fmt(r$value),
                note = paste0("Peer median ", fmt(r$peer_median), " · ",
                              if (is.na(r$percentile)) "–" else paste0(round(r$percentile * 100), "th pct")))
  }
  rows <- purrr::compact(list(
    row("pe_ratio", "P/E", fmt_ratio),
    row("pb_ratio", "P/B", function(x) fmt_ratio(x, 2)),
    row("ev_ebitda", "EV/EBITDA", fmt_ratio),
    row("dividend_yield", "Dividend yield", fmt_pct),
    row("roe", "ROE", fmt_pct),
    row("net_margin", "Net margin", fmt_pct),
    row("revenue_cagr", "Revenue CAGR", fmt_pct),
    row("return_1y", "1y return", fmt_pct)
  ))
  mbs_card("Peer summary", subtitle = paste0("Subject company vs ", rv$peers_label %||% "peer set", " — latest fiscal year at the latest close"),
           summary_table(rows), full_screen = FALSE)
})

output$peer_dt <- renderDT({
  b <- bd(); p <- peers_tbl(); req(b, p)
  d <- peer_display(p, b$code)
  dt_mbs(d, kinds = peer_kinds, highlight_col = "Code", highlight_val = b$code, page = 50, dom = "t", buttons = TRUE,
         colour_cols = c("1y return"), bold_rows = nrow(d) - 1)
})

peer_chart <- function(col, fmt, title = NULL) renderPlotly({
  b <- bd(); p <- peers_tbl(); req(b, p)
  chart_hbar(p, "code", col, subject = b$code, fmt = fmt, title = title)
})
output$peer_pe_chart  <- peer_chart("pe_ratio", "x")
output$peer_pb_chart  <- peer_chart("pb_ratio", "x")
output$peer_ev_chart  <- peer_chart("ev_ebitda", "x")
output$peer_dy_chart  <- peer_chart("dividend_yield", "pct")
output$peer_roe_chart <- peer_chart("roe", "pct")
output$peer_nm_chart  <- peer_chart("net_margin", "pct")

output$peer_scatter_pb <- renderPlotly({ b <- bd(); p <- peers_tbl(); req(b, p)
  chart_scatter(p, "roe", "pb_ratio", subject = b$code, xlab = "ROE", ylab = "P/B", xfmt = ".0%", yfmt = ".1f") })
output$peer_scatter_pe <- renderPlotly({ b <- bd(); p <- peers_tbl(); req(b, p)
  chart_scatter(p, "eps_cagr", "pe_ratio", subject = b$code, xlab = "EPS CAGR", ylab = "P/E", xfmt = ".0%", yfmt = ".1f") })

output$peer_perf_chart <- renderPlotly({
  b <- bd(); p <- peers_rv(); req(b, p, p$prices)
  long <- rebase_long(p$prices)
  long$series <- sub("\\.AX$", "", long$symbol)
  chart_rebased(long, subject = b$code, bench = character(0))
})
