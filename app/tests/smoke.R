# Drive the whole server headlessly with shiny::testServer and probe every output.
suppressPackageStartupMessages({ library(shiny) })
source("global.R"); source("ui.R"); source("server.R")
cat("global/ui/server sourced OK\n")
fails <- 0L
probe <- function(name, expr) {
  r <- tryCatch({ x <- expr; if (is.null(x)) "NULL" else "ok" }, error = function(e) paste("ERR:", conditionMessage(e)))
  if (startsWith(r, "ERR")) fails <<- fails + 1L
  cat(sprintf("  %-22s %s\n", name, r))
}
testServer(server, {
  session$setInputs(company = "WBC.AX", period = "2y", horizon = "5", rf = 4.5, beta = 1, mrp = 6, kd = 6, dw = 20, tax = 30, tg = 2.5, franking = 100,
                    midyear = FALSE, basis = "fc", w_dcf = 50, w_ddm = 40, w_rim = 20, w_pe = 20, w_pb = 20, w_ev = 20, rec_buy = 10, rec_sell = -5,
                    note_rec = "auto", note_analysts = "", note_thesis = "", note_case = "", note_risks = "", note_catalysts = "", note_esg = "",
                    px_type = "line", px_overlays = c("sma50", "sma200"), px_volume = TRUE, px_rsi = TRUE, px_log = FALSE, fin_view = "reported",
                    peer_mode = "auto", custom_peers = "", sector_pick = "Financials", scr_pe = c(0, 80), scr_pb = c(0, 20), scr_dy = c(0, 15), scr_roe = c(-50, 100), scr_mcap = c(0, 300), scr_industry = NULL, scr_div_only = FALSE)
  session$setInputs(go = 1)
  b <- bd(); stopifnot(isTRUE(b$ok)); cat("company loaded:", b$code, "\n")
  later::run_now(1); session$flushReact()
  if (is.null(peers_tbl())) { session$setInputs(peer_load = 1) }
  cat("peers loaded:", !is.null(peers_tbl()), " n =", nrow(peers_tbl() %||% tibble()), "\n")
  v <- valuation(); cat("valuation:", v$recommendation, fmt_price(v$weighted_value), fmt_pct(v$upside), "\n")
  outs <- c("company_strip", "load_status", "overview_ui", "ov_price_chart", "ov_perf_dt", "ov_methods_dt", "ov_news_dt", "ov_related_dt",
            "price_chart", "tech_panel", "risk_panel", "perf_dt", "relative_chart", "drawdown_chart", "vol_chart", "hist_chart", "div_chart", "div_dt", "news_dt",
            "income_dt", "balance_dt", "cashflow_dt", "pershare_dt", "summary_dt", "rev_ni_chart", "margin_chart", "bs_chart", "leverage_chart", "cf_chart", "capex_chart", "eps_dps_chart", "payout_chart",
            "ratio_hist_dt", "dupont_dt", "ratio_returns_chart", "ratio_lev_chart", "formula_dt",
            "peer_status", "peer_tiles", "peer_dt", "peer_pe_chart", "peer_pb_chart", "peer_ev_chart", "peer_dy_chart", "peer_roe_chart", "peer_nm_chart", "peer_scatter_pb", "peer_scatter_pe", "peer_perf_chart",
            "ke_readout", "val_header", "methods_dt", "football_chart", "grid_hot", "proj_chart", "proj_dt", "intrinsic_ui", "scen_hot", "scen_dt", "scen_chart", "sens2d_chart", "sens_ke_dt", "sens_g_dt", "sens_tg_dt", "sens_m_dt",
            "note_preview")
  for (o in outs) probe(o, output[[o]])
  # Common-size and growth views
  session$setInputs(fin_view = "common"); probe("income_dt (common)", output$income_dt)
  session$setInputs(fin_view = "growth"); probe("balance_dt (growth)", output$balance_dt)
  # Edit the grid through hot_to_r path: simulate rv$grid change
  g <- assumptions()$grid; g[[3]][1] <- g[[3]][1] + 0.01; rv$grid <- g
  v2 <- valuation(); cat("grid edit changed value:", !isTRUE(all.equal(v$weighted_value, v2$weighted_value)), "\n")
  # Sector load (Financials ~ 29 names)
  session$setInputs(sector_load = 1)
  cat("sector loaded:", !is.null(sector_rv()), " rows:", nrow(sector_rv()$table %||% tibble()), "\n")
  for (o in c("sector_header", "sector_dt", "sector_scatter1", "sector_scatter2", "sector_mcap_chart", "sector_ret_chart", "sector_median_dt")) probe(o, output[[o]])
  session$setInputs(scr_pe = c(0, 15)); cat("screen P/E<=15 rows:", tryCatch(nrow(screened()), error = function(e) "n/a"), "\n")
  # Benchmarks
  for (o in c("bench_dt", "bench_chart", "bench_sector_chart", "fx_chart")) probe(o, output[[o]])
  # Switch to an industrial and re-probe the valuation outputs
  session$setInputs(company = "BHP.AX", go = 2)
  b2 <- bd(); cat("second company:", b2$code, b2$info$family, "\n")
  session$setInputs(peer_load = 2)
  for (o in c("overview_ui", "val_header", "methods_dt", "football_chart", "grid_hot", "proj_chart", "proj_dt", "intrinsic_ui", "bridge_chart", "scen_hot", "scen_dt", "sens2d_chart", "sens_m_dt", "leverage_chart", "ratio_lev_chart", "note_preview")) probe(paste0("BHP ", o), output[[o]])
  # Ad hoc ticker outside the universe
  session$setInputs(company = "QAN", go = 3)
  b3 <- bd(); cat("ad hoc ticker:", b3$code, b3$info$name, b3$info$in_universe, "\n")
  probe("QAN overview_ui", output$overview_ui)
  # Bad ticker degrades gracefully
  session$setInputs(company = "ZZZZZZ.AX", go = 4)
  cat("bad ticker -> bd NULL:", is.null(bd()), "\n")
  probe("bad company_strip", output$company_strip)
})
cat("\nFAILURES:", fails, "\n")
if (fails > 0) quit(status = 1)
