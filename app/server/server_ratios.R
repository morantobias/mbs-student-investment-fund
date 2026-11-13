# --- Ratios tab -------------------------------------------------------------------------
ratio_history <- reactive({
  b <- bd(); req(b, b$fin)
  f <- b$fin
  px <- vapply(seq_len(nrow(f)), function(i) price_at(b$history, f$date[i]), numeric(1))
  px[nrow(f)] <- b$quote$price   # latest year at the live price
  mcap <- px * f$shares; ev <- mcap + coalesce(f$net_debt, 0)
  val <- list(
    "Share price at period end ($)" = fmt_price(px),
    "P/E" = fmt_ratio(ifelse(f$eps > 0, px / f$eps, NA)),
    "P/B" = fmt_ratio(ifelse(f$bvps > 0, px / f$bvps, NA), 2),
    "P/TBV" = fmt_ratio(ifelse(f$tbvps > 0, px / f$tbvps, NA), 2),
    "EV / Revenue" = fmt_ratio(ifelse(f$revenue > 0, ev / f$revenue, NA), 2),
    "EV / EBITDA" = fmt_ratio(ifelse(f$ebitda > 0, ev / f$ebitda, NA)),
    "EV / EBIT" = fmt_ratio(ifelse(f$ebit > 0, ev / f$ebit, NA)),
    "Dividend yield" = fmt_pct(f$dps / px), "Grossed-up yield (100% franked)" = fmt_pct(f$dps / px / 0.7),
    "Earnings yield" = fmt_pct(f$eps / px), "FCF yield" = fmt_pct(f$fcf / mcap))
  qual <- list("ROE" = fmt_pct(f$roe), "ROA" = fmt_pct(f$roa, 2), "ROIC" = fmt_pct(f$roic),
               "Gross margin" = fmt_pct(f$gross_margin), "EBITDA margin" = fmt_pct(f$ebitda_margin), "EBIT margin" = fmt_pct(f$ebit_margin),
               "Pre-tax margin" = fmt_pct(f$pretax_margin), "Net margin" = fmt_pct(f$net_margin), "FCF margin" = fmt_pct(f$fcf_margin),
               "Cash conversion (OCF / NI)" = fmt_ratio(f$cash_conversion, 2), "FCF / NI" = fmt_ratio(f$fcf_conversion, 2),
               "Effective tax rate" = fmt_pct(f$tax_rate_eff), "Payout ratio" = fmt_pct(f$payout), "Dividend cover" = fmt_ratio(f$dividend_cover))
  risk <- list("Net debt / EBITDA" = fmt_ratio(f$net_debt_ebitda), "Debt / equity" = fmt_ratio(f$debt_equity, 2),
               "Equity / assets" = fmt_pct(f$equity_assets), "Interest coverage (EBIT / interest)" = fmt_ratio(f$interest_coverage),
               "Capex / revenue" = fmt_pct(f$capex_revenue), "Capex / D&A" = fmt_ratio(f$capex_da, 2), "Asset turnover" = fmt_ratio(f$asset_turnover, 2))
  grow <- list("Revenue growth" = fmt_pct(f$revenue_growth), "EBITDA growth" = fmt_pct(f$ebitda_growth), "EBIT growth" = fmt_pct(f$ebit_growth),
               "Net income growth" = fmt_pct(f$ni_growth), "EPS growth" = fmt_pct(f$eps_growth), "DPS growth" = fmt_pct(f$dps_growth),
               "Book value per share growth" = fmt_pct(f$bvps_growth), "Asset growth" = fmt_pct(f$assets_growth))
  sec <- function(title, lst) bind_rows(c(list(`Metric` = title), setNames(as.list(rep("", nrow(f))), f$label)),
                                        bind_rows(purrr::imap(lst, function(v, k) c(list(Metric = k), setNames(as.list(v), f$label)))))
  bind_rows(sec("VALUATION", val), sec("QUALITY", qual), sec("RISK & EFFICIENCY", risk), sec("GROWTH", grow))
})

output$ratio_hist_dt <- renderDT({
  t <- ratio_history(); req(t)
  dt_mbs(t, page = 60, bold_rows = which(t[[2]] == "") - 1)
})

output$dupont_dt <- renderDT({
  b <- bd(); req(b)
  d <- dupont_table(b$fin); req(d)
  dt_mbs(d %>% rename(Year = label, `Net margin` = net_margin, `Asset turnover` = asset_turnover, `Equity multiplier` = leverage, `ROE (DuPont)` = roe_dupont, `ROE (reported)` = roe),
         kinds = c(`Net margin` = "pct", `Asset turnover` = "x2", `Equity multiplier` = "x2", `ROE (DuPont)` = "pct", `ROE (reported)` = "pct"), page = 10)
})

output$ratio_returns_chart <- renderPlotly({ b <- bd(); req(b); chart_lines(b$fin, c("roe", "roic", "net_margin"), c("ROE", "ROIC", "Net margin")) })
output$ratio_lev_chart <- renderPlotly({ b <- bd(); req(b)
  if (b$info$family %in% c("bank", "insurer", "financial")) chart_lines(b$fin, c("equity_assets", "payout"), c("Equity / assets", "Payout"))
  else chart_lines(b$fin, c("net_debt_ebitda", "interest_coverage"), c("Net debt / EBITDA", "Interest coverage"), fmt = "x") })

output$formula_dt <- renderDT({
  d <- tibble(Metric = c("P/E", "Forward P/E", "P/B", "EV/EBITDA", "EV/EBIT", "FCF yield", "Dividend yield", "PEG", "ROIC", "ROE", "ROA",
                         "Operating margin", "Net margin", "Cash conversion", "ROIC less WACC", "Net debt / EBITDA", "Interest coverage", "Current ratio", "Quick ratio",
                         "Historical CAGR", "Forecast CAGR", "Company vs sector sales growth", "Margin expansion", "Beta", "Sharpe ratio", "Maximum drawdown", "Margin of safety"),
              `Formula / treatment` = c("Share price / LTM diluted EPS", "Share price / forecast EPS", "Market capitalisation / book equity", "Enterprise value / EBITDA (EV = market cap + debt − cash + minorities + preferreds)",
                                        "Enterprise value / EBIT", "Levered free cash flow / equity market cap", "Dividends per share / share price", "P/E / (EPS growth rate in percentage points)",
                                        "NOPAT / invested capital", "Net income / book equity", "Net income / total assets", "EBIT / revenue", "Net income / revenue", "Operating cash flow / net income",
                                        "ROIC − WACC", "(Total debt − cash) / EBITDA", "EBIT / interest expense", "Current assets / current liabilities", "(Current assets − inventory) / current liabilities",
                                        "(Latest / base)^(1 / elapsed years) − 1", "(Forecast ending value / latest)^(1 / forecast years) − 1", "Company sales CAGR − sector sales CAGR",
                                        "Current EBIT / net margin less historical base margin", "Cov(stock, index) / Var(index) on daily returns", "(Annualised return − rf) / annualised volatility",
                                        "Largest peak-to-trough decline in adjusted price", "Weighted fair value / price − 1"),
              `Interpretation and notes` = c("Positive earnings only; trailing.", "Disclose the forecast year.", "Book equity should be positive.", "Not meaningful for banks and insurers.",
                                             "Use normalised earnings where relevant.", "Clarify levered vs unlevered.", "Use annualised dividends; show grossed-up yield for franked payers.",
                                             "E.g. P/E 15 with 10% EPS CAGR → PEG 1.5.", "Prefer average invested capital.", "Prefer average equity (used here).", "Prefer average assets (used here).",
                                             "Comparable EBIT and revenue periods.", "Net earnings margin.", "Negative earnings distort interpretation.", "Percentage-point spread.",
                                             "Net debt may be negative; compare sector norms.", "Positive interest expense input.", "Liquidity.", "Adjust for other illiquid current assets.",
                                             "Only for positive base and latest values.", "Analyst-entered forecast period.", "Check data windows match.", "Consider cyclicality and one-offs.",
                                             "Window-dependent; the Valuation tab lets you override.", "Risk-free 4.5% in this workstation.", "On the selected history window.", "Buy / Hold / Sell bands are editable."))
  dt_mbs(d, page = 30)
})
