# --- Market tab ------------------------------------------------------------------------
output$price_chart <- renderPlotly({
  b <- bd(); req(b)
  chart_price(b, type = "line", overlays = input$px_overlays %||% character(0),
              show_volume = isTRUE(input$px_volume), show_rsi = isTRUE(input$px_rsi), log_scale = isTRUE(input$px_log))
})

output$tech_panel <- renderUI({
  b <- bd(); req(b)
  t <- b$tech$latest
  if (is.null(t)) return(empty_state("Not enough history for technical indicators"))
  trend <- if (isTRUE(t$golden_cross)) "Golden cross (SMA50 > SMA200)" else "SMA50 below SMA200"
  rsi_note <- if (is.na(t$rsi14)) "" else if (t$rsi14 > 70) "Overbought" else if (t$rsi14 < 30) "Oversold" else "Neutral"
  tagList(
    kv_table(list(
      "Last close" = fmt_price(t$close), "SMA 20 / 50 / 200" = paste(fmt_price(t$sma20), fmt_price(t$sma50), fmt_price(t$sma200), sep = " / "),
      "Price vs SMA 50" = fmt_pct(t$pct_vs_sma50, 1, signed = TRUE), "Price vs SMA 200" = fmt_pct(t$pct_vs_sma200, 1, signed = TRUE),
      "Trend" = trend, "RSI (14)" = paste0(fmt_num(t$rsi14, 1), " · ", rsi_note),
      "Bollinger band" = paste0(fmt_price(t$bb_lower), " – ", fmt_price(t$bb_upper)),
      "52-week position" = fmt_pct(t$pos52, 0), "Drawdown from peak" = fmt_pct(t$drawdown),
      "Volume vs 20-day avg" = fmt_pct(t$vol_vs_avg, 0, signed = TRUE)))
  )
})

output$risk_panel <- renderUI({
  b <- bd(); req(b)
  m <- b$metrics
  if (is.null(m)) return(empty_state("Price history unavailable"))
  kv_table(list(
    "Window" = paste0(fmt_date(m$first_date), " – ", fmt_date(m$last_date)),
    "Total return" = fmt_pct(m$total_return), "ASX 200 total return" = fmt_pct(m$bench_total_return),
    "Annualised return" = fmt_pct(m$ann_return), "Annualised volatility" = fmt_pct(m$ann_vol),
    "Sharpe (rf 4.5%)" = fmt_ratio(m$sharpe, 2, suffix = ""), "Sortino" = fmt_ratio(m$sortino, 2, suffix = ""),
    "Beta / correlation" = paste0(fmt_ratio(m$beta, 2, suffix = ""), " / ", fmt_ratio(m$correlation, 2, suffix = "")),
    "Jensen alpha (ann.)" = fmt_pct(m$alpha, 1, signed = TRUE), "Tracking error" = fmt_pct(m$tracking_error),
    "Max drawdown" = fmt_pct(m$max_drawdown), "Best / worst day" = paste0(fmt_pct(m$best_day), " / ", fmt_pct(m$worst_day))))
})

output$perf_dt <- renderDT({
  b <- bd(); req(b, b$perf)
  dt_mbs(b$perf %>% rename(Period = period, Company = stock, `S&P/ASX 200` = benchmark, Relative = relative),
         kinds = c(Company = "pct", `S&P/ASX 200` = "pct", Relative = "pct"), colour_cols = c("Company", "S&P/ASX 200", "Relative"), page = 12)
})

output$relative_chart <- renderPlotly({
  b <- bd(); req(b, b$history)
  px <- bind_rows(b$history, b$bench, b$sector_px)
  long <- rebase_long(px)
  lab <- c(setNames("S&P/ASX 200", "^AXJO"), setNames(b$code, b$symbol))
  if (!is.null(b$sector_index) && !is.na(b$sector_index)) lab[b$sector_index] <- benchmark_indices$label[match(b$sector_index, benchmark_indices$symbol)]
  long$series <- unname(lab[long$symbol])
  chart_rebased(long, subject = b$code)
})

output$drawdown_chart <- renderPlotly({ b <- bd(); req(b); chart_drawdown(b$tech$series) })
output$vol_chart <- renderPlotly({ b <- bd(); req(b); chart_rolling_vol(b$tech$series) })
output$hist_chart <- renderPlotly({ b <- bd(); req(b); chart_return_hist(b$tech$series) })
output$div_chart <- renderPlotly({ b <- bd(); req(b); chart_dividends(b$dividends) })

output$div_dt <- renderDT({
  b <- bd(); req(b)
  d <- b$dividends
  if (is.null(d) || nrow(d) == 0) return(dt_mbs(tibble(`Ex-date` = "–", DPS = NA_real_)))
  d <- d %>% mutate(yr = format(ex_date, "%Y")) %>% group_by(yr) %>% mutate(`Calendar-year total` = sum(dps)) %>% ungroup() %>%
    transmute(`Ex-date` = format(ex_date, "%d %b %Y"), `DPS ($)` = dps, `Calendar-year total ($)` = `Calendar-year total`)
  dt_mbs(d, kinds = c(`DPS ($)` = "num3", `Calendar-year total ($)` = "num3"), page = 8, dom = "tp")
})

output$news_dt <- renderDT({
  b <- bd(); req(b)
  n <- b$meta$news
  if (is.null(n) || nrow(n) == 0) return(dt_mbs(tibble(Date = "–", Headline = "No developments reported by Yahoo Finance for this security.")))
  dt_mbs(n %>% rename(Date = date, Headline = headline), page = 10)
})
