# --- Overview tab -------------------------------------------------------------------
output$overview_ui <- renderUI({
  b <- bd()
  if (is.null(b)) return(empty_state("Load a company to begin. Type any ASX code — names outside the curated universe work too."))
  q <- b$quote; r <- b$ratios; m <- b$metrics; info <- b$info
  h <- tryCatch(headline(), error = function(e) NULL)
  mos <- h$mos %||% NA
  delta_tag <- NULL
  if (!is.null(q$change_pct) && length(q$change_pct) == 1 && !is.na(q$change_pct)) {
    good <- q$change_pct >= 0
    delta_tag <- span(class = paste("delta", if (good) "good" else "bad"),
                      if (good) HTML("&#9650;") else HTML("&#9660;"),
                      " ", fmt_pct(abs(q$change_pct), 2))
  }
  tagList(
    mbs_card("About the company", full_screen = FALSE,
      div(class = "mbs-description",
          if (nzchar(b$meta$summary %||% "")) b$meta$summary else
            muted("No company description available from Yahoo Finance for this security."))),
    mbs_card("Company summary", subtitle = "Key valuation and quality metrics at the latest close",
      summary_table(list(
        summary_row("Price", tagList(span(fmt_price(q$price)), delta_tag), note = paste0("Prev close ", fmt_price(q$previous_close))),
        summary_row("Market cap", fmt_money(r$market_cap), note = paste0(fmt_int(r$shares_out / 1e6), "m shares")),
        summary_row("P/E (trailing)", fmt_ratio(r$pe_ratio), note = paste0("EPS ", fmt_price(r$eps, 3)), tip = "pe_ratio"),
        summary_row("P/B", fmt_ratio(r$pb_ratio, 2), note = paste0("BVPS ", fmt_price(r$bvps)), tip = "pb_ratio"),
        summary_row("Dividend yield", fmt_pct(r$dividend_yield), note = paste0("Grossed-up ", fmt_pct(r$grossed_yield)), tip = "dividend_yield"),
        summary_row("ROE", fmt_pct(r$roe), note = paste0("ROA ", fmt_pct(r$roa, 2)), tip = "roe"),
        summary_row("Weighted fair value", if (!is.null(h)) fmt_price(h$value) else "–",
                    note = if (!is.null(h) && h$basis == "fc") "Incl. franking credits" else "Excl. franking credits", class = "accent"),
        summary_row("Margin of safety", fmt_pct(mos, 1, signed = TRUE),
                    note = if (!is.null(h)) paste0("Recommendation: ", h$rec) else NULL,
                    class = if (is.na(mos)) "" else if (mos >= 0) "pos" else "neg", tip = "mos")
      )), full_screen = FALSE),
    layout_columns(col_widths = c(8, 4), gap = "12px",
      mbs_card("Price performance", subtitle = "Rebased to 100 against the S&P/ASX 200 over the selected window",
               plotlyOutput("ov_price_chart", height = "300px")),
      mbs_card("Investment view", subtitle = valuation()$methodology,
        div(class = "text-center mb-2", rec_badge(h$rec %||% "n/a") %>% tagAppendAttributes(class = "lg")),
        kv_table(list(
          "Fair value (excl. franking)" = fmt_price(h$value_ex), "Fair value (incl. franking)" = fmt_price(h$value_fc),
          "Margin of safety (excl. / incl.)" = paste0(fmt_pct(h$mos_ex, 1, signed = TRUE), " / ", fmt_pct(h$mos_fc, 1, signed = TRUE)),
          "Cost of equity (CAPM)" = fmt_pct(h$ke, 2), "WACC" = if (info$family == "industrial") fmt_pct(h$wacc, 2) else "n/a (financial)",
          "52-week range" = paste0(fmt_price(q$week52_low), " – ", fmt_price(q$week52_high)),
          "Beta vs ASX 200" = fmt_ratio(m$beta, 2, suffix = ""), "Peer set" = rv$peers_label %||% "loading…")),
        muted("Adjust assumptions, forecast drivers and scenarios on the Valuation tab."), full_screen = FALSE)
    ),
    layout_columns(col_widths = c(4, 4, 4), gap = "12px",
      mbs_card("Company profile", kv_table(list(
        "ASX code" = b$code, "Company" = info$name, "GICS sector" = info$sector, "Industry" = info$industry,
        "Exchange" = b$meta$full_exchange_name %||% "ASX", "Listed since" = fmt_date(b$meta$first_trade_date),
        "Fiscal year end" = format(r$period_end, "%d %B"), "Latest reported year" = r$fy_label,
        "Valuation family" = stringr::str_to_sentence(info$family), "In curated universe" = if (info$in_universe) "Yes" else "No (ad hoc ticker)")), full_screen = FALSE),
      mbs_card("Latest fiscal year", subtitle = paste0(r$fy_label, " · period end ", fmt_date(r$period_end)), kv_table(list(
        "Revenue" = fmt_money(r$revenue), "EBITDA" = fmt_money(r$ebitda), "EBIT" = fmt_money(r$ebit),
        "Net income" = fmt_money(r$net_income), "EPS (diluted)" = fmt_price(r$eps, 3), "DPS (TTM)" = fmt_price(r$dps, 3),
        "Operating cash flow" = fmt_money(r$ocf), "Free cash flow" = fmt_money(r$fcf), "Total assets" = fmt_money(r$total_assets),
        "Book equity" = fmt_money(r$equity), "Net debt" = fmt_money(r$net_debt))), full_screen = FALSE),
      mbs_card("Quality & growth", kv_table(list(
        "Net margin" = fmt_pct(r$net_margin), "EBIT margin" = fmt_pct(r$ebit_margin),
        "ROIC" = if (info$family %in% c("bank", "insurer", "financial")) "n/a (financial)" else fmt_pct(r$roic),
        "Cash conversion" = if (info$family %in% c("bank", "insurer", "financial")) "n/a (financial)" else fmt_ratio(r$cash_conversion, 2), "Payout ratio" = fmt_pct(r$payout),
        "Net debt / EBITDA" = if (info$family %in% c("bank", "insurer", "financial")) "n/a" else fmt_ratio(r$net_debt_ebitda),
        "Equity / assets" = fmt_pct(r$equity_assets),
        "Revenue CAGR" = paste0(fmt_pct(r$revenue_cagr), " (", r$cagr_years, "y)"), "EPS CAGR" = paste0(fmt_pct(r$eps_cagr), " (", r$cagr_years, "y)"),
        "DPS CAGR" = paste0(fmt_pct(r$dps_cagr), " (", r$cagr_years, "y)"))), full_screen = FALSE)
    ),
    layout_columns(col_widths = c(5, 7), gap = "12px",
      mbs_card("Trailing performance vs S&P/ASX 200", DTOutput("ov_perf_dt"), full_screen = FALSE),
      mbs_card("Valuation methods", subtitle = "Implied value per share and weight in the fair value", DTOutput("ov_methods_dt"), full_screen = FALSE)
    ),
    layout_columns(col_widths = c(7, 5), gap = "12px",
      mbs_card("Significant developments", DTOutput("ov_news_dt"), full_screen = FALSE),
      mbs_card("Related securities", subtitle = "Same-industry comparables from the curated universe", DTOutput("ov_related_dt"), full_screen = FALSE)
    )
  )
})

output$ov_price_chart <- renderPlotly({
  b <- bd(); req(b, b$history)
  px <- bind_rows(b$history, b$bench)
  long <- rebase_long(px)
  long$series <- ifelse(long$symbol == "^AXJO", "S&P/ASX 200", b$code)
  chart_rebased(long, subject = b$code)
})

output$ov_perf_dt <- renderDT({
  b <- bd(); req(b, b$perf)
  dt_mbs(b$perf %>% rename(Period = period, Company = stock, `ASX 200` = benchmark, Relative = relative),
         kinds = c(Company = "pct", `ASX 200` = "pct", Relative = "pct"), colour_cols = c("Company", "ASX 200", "Relative"), page = 12)
})

output$ov_methods_dt <- renderDT({
  v <- valuation(); req(v)
  m <- v$methods %>% filter(available | weight > 0) %>%
    transmute(Method = label, `Value (ex FC)` = value_ex, `Value (inc FC)` = value_fc, Weight = weight_used, `Upside` = if (v$headline_basis == "fc") upside_fc else upside_ex, Note = note)
  dt_mbs(m, kinds = c(`Value (ex FC)` = "money", `Value (inc FC)` = "money", Weight = "pct", Upside = "pct"), colour_cols = "Upside", page = 10)
})

output$ov_news_dt <- renderDT({
  b <- bd(); req(b)
  n <- b$meta$news
  if (is.null(n) || nrow(n) == 0) return(dt_mbs(tibble(Date = "–", Headline = "No developments reported by Yahoo Finance for this security.")))
  dt_mbs(n %>% rename(Date = date, Headline = headline), page = 8)
})

output$ov_related_dt <- renderDT({
  b <- bd(); req(b)
  info <- b$info
  peers <- asx_universe %>%
    dplyr::filter(industry == info$industry, code != b$code) %>%
    dplyr::arrange(name)
  if (nrow(peers) == 0)
    return(dt_mbs(tibble(Code = "—", Company = "No other securities in this industry.")))
  d <- peers %>% transmute(Code = code, Company = name, Industry = industry)
  dt_mbs(d, page = 10, dom = "tp")
})
