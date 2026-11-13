# --- Benchmarks tab -------------------------------------------------------------------------
bench_board <- reactive({
  input$refresh
  withProgress(message = "Loading market board", value = 0.5, load_benchmark_board())
})

output$bench_dt <- renderDT({
  b <- bench_board(); req(b)
  d <- b %>% transmute(Instrument = label, Kind = kind, Symbol = symbol, Last = price, Change = change, `Change %` = change_pct, `52w low` = week52_low, `52w high` = week52_high, `52w position` = pos52)
  dt_mbs(d, kinds = c(Last = "num2", Change = "num2", `Change %` = "pct2", `52w low` = "num2", `52w high` = "num2", `52w position` = "pct"),
         colour_cols = c("Change", "Change %"), bar_cols = "52w position", page = 40)
})

bench_px <- reactive({
  input$refresh
  fetch_prices(c("^AXJO", "^GSPC", "^IXIC", "URTH", "EEM"), period = "1y")
})
sector_px_all <- reactive({
  input$refresh
  fetch_prices(unname(sector_index_map), period = "1y")
})

output$bench_chart <- renderPlotly({
  px <- bench_px(); req(px)
  chart_benchmarks(px, c("^AXJO" = "S&P/ASX 200", "^GSPC" = "S&P 500", "^IXIC" = "Nasdaq", "URTH" = "MSCI World", "EEM" = "MSCI EM"))
})
output$bench_sector_chart <- renderPlotly({
  px <- sector_px_all(); req(px)
  chart_benchmarks(px, setNames(names(sector_index_map), unname(sector_index_map)))
})
output$fx_chart <- renderPlotly({
  input$refresh
  fx <- fetch_prices("AUDUSD=X", period = "1y"); req(fx)
  p <- plot_ly(fx, x = ~date, y = ~close, type = "scatter", mode = "lines", line = list(color = MBS$primary, width = 2), hovertemplate = "%{y:.4f}<extra>AUD/USD</extra>")
  mbs_layout(p, yfmt = ".3f", legend = FALSE)
})
