# --- Sector & screener tab ------------------------------------------------------------------
# Run the same valuation engine used on the Valuation tab for every row of a
# sector/universe table, using the table itself as the peer set, so the screener
# can filter on recommendation and margin of safety.
screen_valuation <- function(tbl, fins = NULL) {
  if (is.null(tbl) || nrow(tbl) == 0) return(tbl)
  rows <- lapply(seq_len(nrow(tbl)), function(i) {
    r <- tbl[i, , drop = FALSE]
    sym <- r$ticker[1]
    bd_i <- list(ratios = r, fin = fins[[sym]], info = lookup_company(sym), metrics = list(beta = NA_real_))
    a <- tryCatch(default_assumptions(bd_i), error = function(e) NULL)
    v <- if (is.null(a)) NULL else tryCatch(run_valuation(bd_i, peers = tbl, a = a), error = function(e) NULL)
    data.frame(
      recommendation = if (is.null(v)) NA_character_ else v$recommendation %||% NA_character_,
      margin_of_safety = if (is.null(v)) NA_real_ else as.numeric(v$upside %||% NA_real_),
      stringsAsFactors = FALSE
    )
  })
  dplyr::bind_cols(tbl, dplyr::bind_rows(rows))
}

observeEvent(bd(), {
  b <- bd(); if (is.null(b)) return()
  if (b$info$sector %in% asx_universe$sector) updateSelectInput(session, "sector_pick", selected = b$info$sector)
}, ignoreNULL = FALSE)

# Keep the Industry dropdown in sync with the selected GICS sector (or the whole
# universe), so it lists every industry in that sector before a screen is run.
observeEvent(input$sector_pick, {
  pick <- input$sector_pick
  if (is.null(pick) || !nzchar(pick)) return()
  inds <- if (pick == "ALL") sort(unique(asx_universe$industry)) else sort(unique(asx_universe$industry[asx_universe$sector == pick]))
  updateSelectInput(session, "scr_industry", choices = c("All industries", inds), selected = "All industries")
}, ignoreNULL = FALSE)

observeEvent(input$sector_load, {
  pick <- input$sector_pick
  codes <- if (pick == "ALL") asx_universe$code else sector_codes(pick)
  set_busy(TRUE); on.exit(set_busy(FALSE), add = TRUE)
  res <- withProgress(message = paste0("Loading ", if (pick == "ALL") "whole universe" else pick, " (", length(codes), " names)"), value = 0, {
    tryCatch(load_peer_set(codes, period = "1y", progress = function(f, m) setProgress(f, detail = m)), error = function(e) NULL)
  })
  if (is.null(res)) { showNotification("Sector data unavailable.", type = "warning"); return() }
  tbl <- composite_scores(res$table)
  tbl <- screen_valuation(tbl, fins = res$fins)
  sector_rv(list(name = if (pick == "ALL") "All sectors" else pick, table = tbl, loaded_at = Sys.time()))
  # Jump straight to the results tab so the screen is visible immediately
  bslib::nav_select("main_nav", selected = "sector", session = session)
  session$sendCustomMessage("mbs-nav", "sector")
  session$sendCustomMessage("mbs-scroll-top", TRUE)
})

screened <- reactive({
  s <- sector_rv(); req(s)
  t <- s$table
  rng <- list(pe_ratio = input$scr_pe, pb_ratio = input$scr_pb, dividend_yield = input$scr_dy / 100, roe = input$scr_roe / 100, market_cap = input$scr_mcap * 1e9)
  # Open-ended upper bounds when the slider sits at its maximum
  if (!is.null(rng$pe_ratio) && rng$pe_ratio[2] >= 80) rng$pe_ratio[2] <- Inf
  if (!is.null(rng$pb_ratio) && rng$pb_ratio[2] >= 20) rng$pb_ratio[2] <- Inf
  if (!is.null(rng$market_cap) && rng$market_cap[2] >= 300e9) rng$market_cap[2] <- Inf
  if (!is.null(rng$dividend_yield) && rng$dividend_yield[2] >= 0.15) rng$dividend_yield[2] <- Inf
  out <- screen_table(t, rng)
  if (!is.null(input$scr_industry) && !identical(input$scr_industry, "All industries") && nzchar(input$scr_industry)) {
    out <- out[out$industry == input$scr_industry, ]
  }
  if (!is.null(input$scr_rec) && !identical(input$scr_rec, "any")) {
    out <- out[!is.na(out$recommendation) & out$recommendation == input$scr_rec, ]
  }
  if (!is.null(input$scr_mos) && length(input$scr_mos) == 2) {
    at_full <- input$scr_mos[1] <= -100 && input$scr_mos[2] >= 100
    if (!at_full) {
      # Slider is in percent; the table stores margin of safety as a fraction
      mos_lo <- input$scr_mos[1] / 100
      mos_hi <- input$scr_mos[2] / 100
      out <- out[!is.na(out$margin_of_safety) & out$margin_of_safety >= mos_lo & out$margin_of_safety <= mos_hi, ]
    }
  }
  if (isTRUE(input$scr_div_only)) out <- out[!is.na(out$dividend_yield) & out$dividend_yield > 0, ]
  out
})

output$sector_header <- renderUI({
  s <- sector_rv()
  if (is.null(s)) return(empty_state("Choose a sector (or the whole universe) and press Run screen."))
  t <- screened()
  mbs_card("Screen summary", subtitle = paste0(s$name, " · ", nrow(s$table), " companies loaded · ", format(s$loaded_at, "%H:%M")),
    summary_table(list(
      summary_row("Universe", s$name, note = paste0(nrow(s$table), " companies")),
      summary_row("After screen", nrow(t), note = "companies"),
      summary_row("Median P/E", fmt_ratio(stats::median(t$pe_ratio, na.rm = TRUE))),
      summary_row("Median P/B", fmt_ratio(stats::median(t$pb_ratio, na.rm = TRUE), 2)),
      summary_row("Median yield", fmt_pct(stats::median(t$dividend_yield, na.rm = TRUE))),
      summary_row("Median ROE", fmt_pct(stats::median(t$roe, na.rm = TRUE))),
      summary_row("Aggregate market cap", fmt_money(sum(t$market_cap, na.rm = TRUE)))
    )), full_screen = FALSE)
})

output$screen_count <- renderUI({
  s <- sector_rv()
  if (!is.null(s)) {
    # A screen has been run: count from the loaded table with every filter applied.
    value <- paste0(nrow(screened()), " of ", nrow(s$table))
  } else {
    # No screen yet — respond immediately to the sector + industry selections
    # using the curated universe (metrics need live data, so only these two
    # dimensions are known before a screen is run).
    pick <- input$sector_pick %||% "ALL"
    u <- asx_universe
    if (!is.null(pick) && !identical(pick, "ALL")) u <- u[u$sector == pick, , drop = FALSE]
    ind <- input$scr_industry
    if (!is.null(ind) && !identical(ind, "All industries") && nzchar(ind)) u <- u[u$industry == ind, , drop = FALSE]
    value <- as.character(nrow(u))
  }
  div(class = "mbs-screen-count",
      span(class = "mbs-screen-count-label", "Number of companies meeting criteria:"),
      span(class = "mbs-screen-count-value", value))
})

output$sector_dt <- renderDT({
  t <- screened(); req(t); b <- bd()
  d <- t %>% mutate(market_cap = market_cap / 1e6) %>%
    select(code, name, industry, price, market_cap, pe_ratio, pb_ratio, ev_ebitda, dividend_yield, roe, net_margin, revenue_cagr, eps_cagr, return_1y, recommendation, margin_of_safety, score_quality, score_value, score_growth, score_momentum, score_total) %>%
    arrange(desc(score_total))
  names(d) <- c("Code", "Company", "Industry", "Price", "Mkt cap ($m)", "P/E", "P/B", "EV/EBITDA", "Div yield", "ROE", "Net margin", "Rev CAGR", "EPS CAGR", "1y return", "Rec", "Margin of safety", "Quality", "Value", "Growth", "Momentum", "Composite")
  dt_mbs(d, kinds = c(Price = "money", `Mkt cap ($m)` = "num0", `P/E` = "x", `P/B` = "x2", `EV/EBITDA` = "x", `Div yield` = "pct", ROE = "pct", `Net margin` = "pct", `Rev CAGR` = "pct", `EPS CAGR` = "pct", `1y return` = "pct", `Margin of safety` = "pct",
                      Quality = "pct", Value = "pct", Growth = "pct", Momentum = "pct", Composite = "pct"),
         highlight_col = "Code", highlight_val = if (!is.null(b)) b$code else "", page = 25, dom = "ftip", buttons = TRUE, colour_cols = c("1y return", "Margin of safety"), bar_cols = "Composite")
})

output$sector_scatter1 <- renderPlotly({ t <- screened(); b <- bd(); req(t); chart_scatter(t, "roe", "pb_ratio", subject = if (!is.null(b)) b$code else NULL, xlab = "ROE", ylab = "P/B") })
output$sector_scatter2 <- renderPlotly({ t <- screened(); b <- bd(); req(t); chart_scatter(t, "revenue_cagr", "ev_ebitda", subject = if (!is.null(b)) b$code else NULL, xlab = "Revenue CAGR", ylab = "EV/EBITDA") })
output$sector_mcap_chart <- renderPlotly({ t <- screened(); b <- bd(); req(t); chart_hbar(t %>% mutate(mc = market_cap / 1e6), "code", "mc", subject = if (!is.null(b)) b$code else NULL, fmt = "money", median_line = FALSE) })
output$sector_ret_chart <- renderPlotly({ t <- screened(); b <- bd(); req(t); chart_hbar(t, "code", "return_1y", subject = if (!is.null(b)) b$code else NULL, fmt = "pct") })

output$sector_median_dt <- renderDT({
  t <- screened(); req(t)
  m <- t %>% group_by(Industry = industry) %>% summarise(Companies = n(), `Mkt cap ($m)` = sum(market_cap, na.rm = TRUE) / 1e6,
                                                           `P/E` = median(pe_ratio, na.rm = TRUE), `P/B` = median(pb_ratio, na.rm = TRUE), `EV/EBITDA` = median(ev_ebitda, na.rm = TRUE),
                                                           `Div yield` = median(dividend_yield, na.rm = TRUE), ROE = median(roe, na.rm = TRUE), `Net margin` = median(net_margin, na.rm = TRUE),
                                                           `Rev CAGR` = median(revenue_cagr, na.rm = TRUE), `1y return` = median(return_1y, na.rm = TRUE), .groups = "drop") %>% arrange(desc(`Mkt cap ($m)`))
  dt_mbs(m, kinds = c(`Mkt cap ($m)` = "num0", `P/E` = "x", `P/B` = "x2", `EV/EBITDA` = "x", `Div yield` = "pct", ROE = "pct", `Net margin` = "pct", `Rev CAGR` = "pct", `1y return` = "pct"), page = 20)
})
