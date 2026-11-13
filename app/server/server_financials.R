# --- Financials tab ---------------------------------------------------------------------
income_items <- c(revenue = "Total revenue", cost_of_revenue = "Cost of revenue", gross_profit = "Gross profit",
                  operating_expense = "Operating expenses", ebitda = "EBITDA", da = "Depreciation & amortisation", ebit = "EBIT",
                  interest_net = "Net interest income / (expense)", other_income = "Other income / (expense)",
                  pretax_income = "Pre-tax income", tax = "Income tax", net_income = "Net income", normalised_income = "Normalised income",
                  eps = "Diluted EPS ($)", dps = "Dividends per share ($)", shares = "Diluted shares (m)")
balance_items <- c(cash = "Cash & equivalents", st_investments = "Short-term investments", receivables = "Receivables",
                   net_ppe = "Net PP&E", goodwill_intang = "Goodwill & intangibles", total_assets = "Total assets",
                   payables = "Payables & accruals", current_debt = "Current debt", long_term_debt = "Long-term debt",
                   total_debt = "Total debt", total_liabilities = "Total liabilities", equity = "Shareholders' equity",
                   net_debt = "Net debt / (cash)", invested_capital = "Invested capital", bvps = "Book value per share ($)")
cashflow_items <- c(net_income = "Net income", da = "Depreciation & amortisation", change_nwc = "Change in working capital",
                    ocf = "Operating cash flow", capex = "Capital expenditure", investing_cf = "Investing cash flow",
                    fcf = "Free cash flow", dividends_paid = "Dividends paid", financing_cf = "Financing cash flow",
                    begin_cash = "Opening cash", end_cash = "Closing cash")

fin_table <- function(fin, items, view, base_col = "revenue") {
  if (is.null(fin) || nrow(fin) == 0) return(NULL)
  per_share <- names(items)[grepl("eps|dps|bvps", names(items))]
  if (view == "reported") {
    out <- statement_table(fin, items, per_share_rows = per_share)
    out$`Line item`[out$`Line item` == "Diluted shares (m)"] <- "Diluted shares (m)"
    if ("shares" %in% names(items)) out[out$`Line item` == items[["shares"]], -1] <- as.list(fmt_num(fin$shares / 1e6, 0))
    return(bind_rows(tibble(`Line item` = "Period end", !!!setNames(as.list(format(fin$date, "%d %b %Y")), fin$label)), out))
  }
  if (view == "common") {
    base <- fin[[base_col]]
    rows <- purrr::imap(items, function(lab, col) {
      v <- if (col %in% names(fin) && !col %in% per_share) fin[[col]] / base else rep(NA_real_, nrow(fin))
      c(`Line item` = lab, setNames(as.list(fmt_pct(v, 1)), fin$label))
    })
    return(bind_rows(rows))
  }
  rows <- purrr::imap(items, function(lab, col) {
    v <- if (col %in% names(fin)) fin[[col]] else rep(NA_real_, nrow(fin))
    p <- dplyr::lag(v); g <- v / p - 1; g[is.na(p) | p <= 0] <- NA_real_
    c(`Line item` = lab, setNames(as.list(fmt_pct(g, 1, signed = TRUE)), fin$label))
  })
  bind_rows(rows)
}

render_fin <- function(items, base_col) renderDT({
  b <- bd(); req(b, b$fin)
  t <- fin_table(b$fin, items, input$fin_view %||% "reported", base_col)
  dt_mbs(t, page = 40, scroll_x = TRUE)
})
output$income_dt   <- render_fin(income_items, "revenue")
output$balance_dt  <- render_fin(balance_items, "total_assets")
output$cashflow_dt <- render_fin(cashflow_items, "revenue")

output$pershare_dt <- renderDT({
  b <- bd(); req(b, b$fin)
  items <- c(eps = "EPS (diluted)", eps_basic = "EPS (basic)", dps = "DPS", bvps = "Book value per share", tbvps = "Tangible book value per share",
             ocf_ps = "Operating cash flow per share", fcf_ps = "Free cash flow per share")
  t <- statement_table(b$fin, items, per_share_rows = names(items))
  pay <- purrr::imap(c(payout = "Payout ratio", dividend_cover = "Dividend cover (x)", roe = "ROE", eps_growth = "EPS growth", dps_growth = "DPS growth"),
                     function(lab, col) c(`Line item` = lab, setNames(as.list(if (col == "dividend_cover") fmt_ratio(b$fin[[col]]) else fmt_pct(b$fin[[col]])), b$fin$label)))
  dt_mbs(bind_rows(t, bind_rows(pay)), page = 20)
})

output$summary_dt <- renderDT({
  b <- bd(); req(b, b$fin)
  f <- b$fin; fam <- b$info$family
  rows <- list(
    c(`Line item` = "VOLUME & REVENUE", setNames(as.list(rep("", nrow(f))), f$label)),
    c(`Line item` = "Total assets ($m)", setNames(as.list(fmt_num(f$total_assets / 1e6, 0)), f$label)),
    c(`Line item` = "Asset growth", setNames(as.list(fmt_pct(f$assets_growth)), f$label)),
    c(`Line item` = "Revenue ($m)", setNames(as.list(fmt_num(f$revenue / 1e6, 0)), f$label)),
    c(`Line item` = "Revenue growth", setNames(as.list(fmt_pct(f$revenue_growth)), f$label)),
    c(`Line item` = "COSTS & MARGIN", setNames(as.list(rep("", nrow(f))), f$label)),
    c(`Line item` = "Operating expenses ($m)", setNames(as.list(fmt_num(f$operating_expense / 1e6, 0)), f$label)),
    c(`Line item` = if (fam %in% c("bank", "insurer", "financial")) "Cost-to-income (opex / revenue)" else "Opex / revenue", setNames(as.list(fmt_pct(f$operating_expense / f$revenue)), f$label)),
    c(`Line item` = "EBITDA margin", setNames(as.list(fmt_pct(f$ebitda_margin)), f$label)),
    c(`Line item` = "Pre-tax margin", setNames(as.list(fmt_pct(f$pretax_margin)), f$label)),
    c(`Line item` = "PROFITABILITY", setNames(as.list(rep("", nrow(f))), f$label)),
    c(`Line item` = "Net profit after tax ($m)", setNames(as.list(fmt_num(f$net_income / 1e6, 0)), f$label)),
    c(`Line item` = "NPAT growth", setNames(as.list(fmt_pct(f$ni_growth)), f$label)),
    c(`Line item` = "ROE", setNames(as.list(fmt_pct(f$roe)), f$label)),
    c(`Line item` = "ROA", setNames(as.list(fmt_pct(f$roa, 2)), f$label)),
    c(`Line item` = "CAPITAL & DISTRIBUTIONS", setNames(as.list(rep("", nrow(f))), f$label)),
    c(`Line item` = "Shareholders' equity ($m)", setNames(as.list(fmt_num(f$equity / 1e6, 0)), f$label)),
    c(`Line item` = "Equity / assets", setNames(as.list(fmt_pct(f$equity_assets)), f$label)),
    c(`Line item` = "Dividends paid ($m)", setNames(as.list(fmt_num(f$dividends_paid / 1e6, 0)), f$label)),
    c(`Line item` = "Payout ratio", setNames(as.list(fmt_pct(f$payout)), f$label)),
    c(`Line item` = "Free cash flow ($m)", setNames(as.list(fmt_num(f$fcf / 1e6, 0)), f$label))
  )
  t <- bind_rows(rows)
  dt_mbs(t, page = 30, bold_rows = which(t[[2]] == "") - 1)
})

output$rev_ni_chart <- renderPlotly({ b <- bd(); req(b); chart_columns(b$fin, c("revenue", "net_income"), c("Revenue", "Net income"), title = "Revenue and net income ($m)") })
output$margin_chart <- renderPlotly({ b <- bd(); req(b)
  cols <- if (b$info$family %in% c("bank", "insurer", "financial")) c("net_margin", "pretax_margin") else c("gross_margin", "ebitda_margin", "ebit_margin", "net_margin")
  labs <- c(gross_margin = "Gross", ebitda_margin = "EBITDA", ebit_margin = "EBIT", net_margin = "Net", pretax_margin = "Pre-tax")[cols]
  chart_lines(b$fin, cols, unname(labs), title = "Margins") })
output$bs_chart <- renderPlotly({ b <- bd(); req(b); chart_columns(b$fin, c("total_assets", "total_liabilities", "equity"), c("Total assets", "Total liabilities", "Equity"), title = "Balance sheet ($m)", colours = c("#2a78d6", "#eb6834", MBS$primary)) })
output$leverage_chart <- renderPlotly({ b <- bd(); req(b)
  if (b$info$family %in% c("bank", "insurer", "financial")) chart_lines(b$fin, c("equity_assets"), "Equity / assets", title = "Capital intensity (equity / assets)")
  else chart_lines(b$fin, c("net_debt_ebitda", "debt_equity"), c("Net debt / EBITDA", "Debt / equity"), fmt = "x", title = "Leverage") })
output$cf_chart <- renderPlotly({ b <- bd(); req(b); chart_columns(b$fin, c("ocf", "fcf", "dividends_paid"), c("Operating cash flow", "Free cash flow", "Dividends paid"), title = "Cash flows ($m)") })
output$capex_chart <- renderPlotly({ b <- bd(); req(b); chart_columns(b$fin, c("capex", "da"), c("Capex", "D&A"), title = "Capex vs D&A ($m)", colours = c("#eb6834", "#1baf7a")) })
output$eps_dps_chart <- renderPlotly({ b <- bd(); req(b); chart_columns(b$fin, c("eps", "dps"), c("EPS", "DPS"), fmt = "num", title = "EPS and DPS ($)") })
output$payout_chart <- renderPlotly({ b <- bd(); req(b); chart_lines(b$fin, c("payout", "roe"), c("Payout ratio", "ROE"), title = "Payout and ROE") })
