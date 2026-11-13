# --- Valuation tab ----------------------------------------------------------------------
output$ke_readout <- renderUI({
  a <- tryCatch(assumptions(), error = function(e) NULL)
  if (is.null(a)) return(NULL)
  ke <- cost_of_equity(a$rf, a$beta, a$mrp); w <- wacc_calc(ke, a$cost_of_debt, a$tax_rate, a$debt_weight)
  div(class = "mbs-banner", style = "font-size:12px;margin:4px 0;",
      HTML(paste0("<b>Ke</b> ", fmt_pct(ke, 2), " = ", fmt_pct(a$rf, 2), " + ", a$beta, " × ", fmt_pct(a$mrp, 2),
                  "<br><b>WACC</b> ", fmt_pct(w, 2), if (a$family != "industrial") " (not used for financials)" else "")))
})

output$val_header <- renderUI({
  b <- bd(); v <- valuation(); h <- headline(); req(b, v)
  a <- v$assumptions
  basis_lbl <- if (v$headline_basis == "fc") "incl. franking" else "excl. franking"
  tagList(
    banner(HTML(paste0("<b>Methodology:</b> ", v$methodology, " &nbsp;·&nbsp; <b>Headline basis:</b> ", basis_lbl,
                       " &nbsp;·&nbsp; <b>Peers:</b> ", rv$peers_label %||% "loading", " (", v$rel$n_peers[1], ")"))),
    mbs_card("Valuation snapshot", subtitle = "Weighted fair value across every available method",
      summary_table(list(
        summary_row("Current price", fmt_price(v$price), note = fmt_date(b$loaded_at)),
        summary_row("Fair value (excl. franking)", fmt_price(v$weighted_value_ex), note = fmt_pct(v$mos_ex, 1, signed = TRUE),
                    class = if (v$headline_basis == "ex") "accent" else ""),
        summary_row("Fair value (incl. franking)", fmt_price(v$weighted_value_fc), note = fmt_pct(v$mos_fc, 1, signed = TRUE),
                    class = if (v$headline_basis == "fc") "accent" else ""),
        summary_row("Margin of safety", fmt_pct(h$mos, 1, signed = TRUE),
                    class = if (is.na(h$mos)) "" else if (h$mos >= 0) "pos" else "neg",
                    note = paste0("Buy ≥ ", fmt_pct(a$rec_buy, 0), " · Sell ≤ ", fmt_pct(a$rec_sell, 0))),
        summary_row("Recommendation", rec_badge(h$rec), note = "Model-derived"),
        summary_row("Cost of equity", fmt_pct(v$ke, 2),
                    note = paste0("β ", a$beta, " · rf ", fmt_pct(a$rf, 1), " · MRP ", fmt_pct(a$mrp, 1))),
        summary_row(if (v$family == "industrial") "WACC" else "Franking gross-up",
                    if (v$family == "industrial") fmt_pct(v$wacc, 2) else paste0(round(v$franking_factor, 3), "x"),
                    note = if (v$family == "industrial") paste0("D/V ", fmt_pct(a$debt_weight, 0)) else paste0(fmt_pct(a$franking, 0), " franked"))
      )), full_screen = FALSE)
  )
})

output$methods_dt <- renderDT({
  v <- valuation(); req(v)
  m <- v$methods %>% transmute(Method = label, `Value (ex FC)` = value_ex, `Value (inc FC)` = value_fc, `Low` = low, `High` = high,
                               `Weight` = weight_used, `Upside` = if (v$headline_basis == "fc") upside_fc else upside_ex, Status = ifelse(in_use, "In fair value", ifelse(available, "Reference", "Unavailable")), Note = note)
  dt_mbs(m, kinds = c(`Value (ex FC)` = "money", `Value (inc FC)` = "money", Low = "money", High = "money", Weight = "pct", Upside = "pct"), colour_cols = "Upside", page = 10)
})

output$football_chart <- renderPlotly({ v <- valuation(); ff <- football(); req(v, ff); chart_football(ff, v$price) })

# --- Forecast driver grid --------------------------------------------------------------
output$grid_hot <- renderRHandsontable({
  b <- bd(); req(b)
  rv$grid_version
  g <- isolate(assumptions())$grid
  fam <- b$info$family
  pct_cols <- setdiff(names(g), c("year", "label"))
  h <- rhandsontable(g, rowHeaders = NULL, stretchH = "all", height = 60 + 24 * nrow(g), useTypes = TRUE) %>%
    hot_col("year", readOnly = TRUE, width = 40) %>% hot_col("label", readOnly = TRUE, width = 60)
  for (cn in pct_cols) h <- h %>% hot_col(cn, format = "0.0000", renderer = "function(instance, td, row, col, prop, value, cellProperties) { Handsontable.renderers.NumericRenderer.apply(this, arguments); td.style.background = '#FFF9DB'; }")
  h %>% hot_cols(columnSorting = FALSE)
})
observeEvent(input$grid_hot, {
  g <- tryCatch(hot_to_r(input$grid_hot), error = function(e) NULL)
  if (!is.null(g) && nrow(g) > 0) rv$grid <- as.data.frame(g)
})

projection <- reactive({
  v <- valuation(); req(v)
  if (v$family == "industrial") v$dcf$schedule else if (!is.null(v$ddm)) v$ddm$schedule else NULL
})

output$proj_chart <- renderPlotly({ v <- valuation(); req(v); if (v$family == "industrial") chart_fcff(v$dcf) else chart_dividend_path(v$ddm) })

output$proj_dt <- renderDT({
  v <- valuation(); p <- projection(); req(v)
  if (is.null(p)) return(dt_mbs(tibble(Note = "Projection unavailable — the company needs a positive revenue (industrial) or EPS and dividend (financial) base.")))
  if (v$family == "industrial") {
    t <- p %>% transmute(Year = label, `Revenue ($m)` = revenue / 1e6, `Growth` = revenue_growth, `EBIT ($m)` = ebit / 1e6, `EBIT margin` = ebit_margin,
                         `NOPAT ($m)` = nopat / 1e6, `D&A ($m)` = da / 1e6, `Capex ($m)` = capex / 1e6, `ΔNWC ($m)` = delta_nwc / 1e6, `FCFF ($m)` = fcff / 1e6,
                         `Discount factor` = discount_factor, `PV FCFF ($m)` = pv_fcff / 1e6)
    dt_mbs(t, kinds = c(`Revenue ($m)` = "num0", Growth = "pct", `EBIT ($m)` = "num0", `EBIT margin` = "pct", `NOPAT ($m)` = "num0", `D&A ($m)` = "num0", `Capex ($m)` = "num0",
                        `ΔNWC ($m)` = "num0", `FCFF ($m)` = "num0", `Discount factor` = "num3", `PV FCFF ($m)` = "num0"), page = 12)
  } else {
    t <- p %>% transmute(Year = label, `EPS ($)` = eps, `EPS growth` = eps_growth, `Payout` = payout, `DPS ($)` = dps, `DPS incl. FC ($)` = dps_grossed,
                         `Opening BVPS ($)` = bvps_open, `Closing BVPS ($)` = bvps, `ROE` = roe, `Discount factor` = discount_factor, `PV of DPS ($)` = pv_dps)
    dt_mbs(t, kinds = c(`EPS ($)` = "num3", `EPS growth` = "pct", Payout = "pct", `DPS ($)` = "num3", `DPS incl. FC ($)` = "num3", `Opening BVPS ($)` = "num2", `Closing BVPS ($)` = "num2",
                        ROE = "pct", `Discount factor` = "num3", `PV of DPS ($)` = "num3"), page = 12)
  }
})

# --- Intrinsic model detail --------------------------------------------------------------
output$intrinsic_ui <- renderUI({
  v <- valuation(); b <- bd(); req(v, b)
  a <- v$assumptions
  if (v$family == "industrial") {
    d <- v$dcf
    if (is.null(d)) return(empty_state("DCF unavailable: no positive revenue base."))
    rd <- tryCatch(reverse_dcf(a), error = function(e) NULL)
    tagList(
      layout_columns(col_widths = c(4, 8), gap = "12px",
        mbs_card("WACC build", kv_table(list(
          "Risk-free rate" = fmt_pct(a$rf, 2), "Beta" = a$beta, "Market risk premium" = fmt_pct(a$mrp, 2), "Cost of equity" = fmt_pct(d$ke, 2),
          "Pre-tax cost of debt" = fmt_pct(a$cost_of_debt, 2), "Tax rate" = fmt_pct(a$tax_rate, 1), "After-tax cost of debt" = fmt_pct(a$cost_of_debt * (1 - a$tax_rate), 2),
          "Debt / capital" = fmt_pct(a$debt_weight, 0), "WACC" = fmt_pct(d$wacc, 2), "Terminal growth" = fmt_pct(d$terminal_growth, 2),
          "Discounting" = if (a$midyear) "Mid-year" else "End-of-year")), full_screen = FALSE),
        mbs_card("Enterprise value to equity bridge", plotlyOutput("bridge_chart", height = "300px"))),
      layout_columns(col_widths = c(6, 6), gap = "12px",
        mbs_card("Valuation output", kv_table(list(
          "PV of forecast FCFF" = fmt_money(d$pv_fcff_sum), "Terminal FCFF" = fmt_money(d$terminal_fcff), "Terminal value" = fmt_money(d$terminal_value),
          "PV of terminal value" = fmt_money(d$pv_terminal), "Terminal value share of EV" = fmt_pct(d$tv_share, 0), "Enterprise value" = fmt_money(d$enterprise_value),
          "Less net debt" = fmt_money(a$net_debt), "Equity value" = fmt_money(d$equity_value), "Shares outstanding" = paste0(fmt_int(a$shares / 1e6), "m"),
          "DCF value per share" = fmt_price(d$per_share), "Upside / (downside)" = fmt_pct(d$upside, 1, signed = TRUE), "Implied EV / FY1 EBITDA" = fmt_ratio(d$implied_ev_ebitda))), full_screen = FALSE),
        mbs_card("Reverse DCF", subtitle = "What the current share price implies", kv_table(list(
          "Implied uniform revenue growth" = if (is.null(rd) || is.na(rd$implied_growth)) "Not solvable in range" else fmt_pct(rd$implied_growth, 1),
          "Implied terminal growth (base drivers)" = if (is.null(rd) || is.na(rd$implied_terminal_growth)) "Not solvable in range" else fmt_pct(rd$implied_terminal_growth, 2),
          "Model revenue growth (yr 1)" = fmt_pct(a$grid$revenue_growth[1], 1), "Model terminal growth" = fmt_pct(a$terminal_growth, 2))),
          muted("If the implied growth is far above the historical CAGR, the market is pricing in more than the base case delivers."), full_screen = FALSE))
    )
  } else {
    dd <- v$ddm; rm <- v$rim; jp <- v$jpb
    tagList(
      layout_columns(col_widths = c(4, 4, 4), gap = "12px",
        mbs_card("Dividend discount model", subtitle = "Two-stage: explicit dividends then Gordon terminal", if (is.null(dd)) empty_state("Needs positive EPS and DPS") else kv_table(list(
          "Cost of equity" = fmt_pct(dd$ke, 2), "Terminal growth" = fmt_pct(dd$terminal_growth, 2), "Franking factor" = paste0(round(dd$franking_factor, 3), "x"),
          "PV explicit dividends" = fmt_price(dd$pv_explicit), "Terminal value (ex FC)" = fmt_price(dd$terminal_value), "PV terminal" = fmt_price(dd$pv_terminal),
          "TV share of value" = fmt_pct(dd$tv_share, 0), "Value excl. franking" = fmt_price(dd$value_ex), "Value incl. franking" = fmt_price(dd$value_fc),
          "MoS excl. / incl." = paste0(fmt_pct(dd$upside_ex, 1, signed = TRUE), " / ", fmt_pct(dd$upside_fc, 1, signed = TRUE)),
          "Cash yield / grossed-up" = paste0(fmt_pct(dd$yield_ex, 2), " / ", fmt_pct(dd$yield_fc, 2)))), full_screen = FALSE),
        mbs_card("Residual income model", subtitle = "Book value plus PV of returns above the cost of equity", if (is.null(rm)) empty_state("Needs positive EPS and book value") else kv_table(list(
          "Opening book value per share" = fmt_price(rm$book_value), "PV of residual income" = fmt_price(rm$pv_ri), "Terminal residual income value" = fmt_price(rm$terminal_value),
          "PV terminal" = fmt_price(rm$pv_terminal), "Value per share" = fmt_price(rm$value), "Upside / (downside)" = fmt_pct(rm$upside, 1, signed = TRUE))), full_screen = FALSE),
        mbs_card("Justified P/B (excess returns)", subtitle = "(ROE − g) / (Ke − g) on current book value", if (is.null(jp)) empty_state("Needs ROE and book value") else kv_table(list(
          "ROE (latest)" = fmt_pct(jp$roe), "Cost of equity" = fmt_pct(jp$ke, 2), "ROE − Ke spread" = fmt_pct(jp$spread, 1, signed = TRUE), "Growth" = fmt_pct(jp$growth, 2),
          "Justified P/B" = fmt_ratio(jp$justified_pb, 2), "Current P/B" = fmt_ratio(b$ratios$pb_ratio, 2), "Book value per share" = fmt_price(jp$bvps),
          "Implied value" = fmt_price(jp$value), "Upside / (downside)" = fmt_pct(jp$upside, 1, signed = TRUE))), full_screen = FALSE)),
      banner(class = "warn", HTML("<b>Why no DCF?</b> For banks, insurers and other financials interest is an operating item and capital is regulated, so free cash flow to the firm is not meaningful. The Fund values financials on distributable earnings: dividends (grossed up for franking), residual income and the excess-returns P/B relationship, cross-checked against peer multiples."))
    )
  }
})
output$bridge_chart <- renderPlotly({ v <- valuation(); req(v, v$dcf); chart_bridge(v$dcf, v$assumptions$shares) })

# --- Scenarios ------------------------------------------------------------------------------
output$scen_hot <- renderRHandsontable({
  b <- bd(); req(b)
  rv$grid_version
  s <- isolate(assumptions())$scenarios
  fam <- b$info$family
  s <- if (fam == "industrial") s[, c("scenario", "weight", "growth_delta", "margin_delta", "ke_delta", "tg_delta")] else s[, c("scenario", "weight", "growth_delta", "payout_delta", "ke_delta", "tg_delta")]
  h <- rhandsontable(s, rowHeaders = NULL, stretchH = "all", height = 130, useTypes = TRUE) %>% hot_col("scenario", readOnly = TRUE)
  for (cn in setdiff(names(s), "scenario")) h <- h %>% hot_col(cn, format = "0.000", renderer = "function(instance, td, row, col, prop, value, cellProperties) { Handsontable.renderers.NumericRenderer.apply(this, arguments); td.style.background = '#FFF9DB'; }")
  h
})
observeEvent(input$scen_hot, {
  s <- tryCatch(as.data.frame(hot_to_r(input$scen_hot)), error = function(e) NULL)
  if (is.null(s) || nrow(s) == 0) return()
  base <- isolate(assumptions())$scenarios
  for (cn in names(s)) if (cn %in% names(base)) base[[cn]] <- s[[cn]]
  rv$scen <- base
})

output$scen_dt <- renderDT({
  s <- scenarios(); req(s)
  t <- s %>% transmute(Scenario = scenario, Weight = weight, `Value (ex FC)` = value_ex, `MoS (ex FC)` = mos_ex, `Value (inc FC)` = value_fc, `MoS (inc FC)` = mos_fc)
  dt_mbs(t, kinds = c(Weight = "pct", `Value (ex FC)` = "money", `MoS (ex FC)` = "pct", `Value (inc FC)` = "money", `MoS (inc FC)` = "pct"),
         colour_cols = c("MoS (ex FC)", "MoS (inc FC)"), bold_rows = nrow(t) - 1, page = 6)
})
output$scen_chart <- renderPlotly({ s <- scenarios(); v <- valuation(); req(s, v); chart_scenarios(s, v$price, basis = v$headline_basis, title = "Scenario values vs current price") })

# --- Sensitivity ----------------------------------------------------------------------------
sens_dt <- function(s, label, fmt_delta = function(x) fmt_bps(x)) {
  if (is.null(s) || nrow(s) == 0) return(NULL)
  t <- s %>% transmute(!!label := fmt_delta(delta), `Ke` = ke, `Value (ex FC)` = value_ex, `MoS (ex FC)` = mos_ex, `Value (inc FC)` = value_fc, `MoS (inc FC)` = mos_fc)
  dt_mbs(t, kinds = c(Ke = "pct2", `Value (ex FC)` = "money", `MoS (ex FC)` = "pct", `Value (inc FC)` = "money", `MoS (inc FC)` = "pct"),
         colour_cols = c("MoS (ex FC)", "MoS (inc FC)"), bold_rows = which(s$delta == 0) - 1, page = 12)
}
output$sens_ke_dt <- renderDT(sens_dt(sens_ke(), "Δ Ke"))
output$sens_g_dt  <- renderDT(sens_dt(sens_g(), "Δ growth", function(x) fmt_pct(x, 1, signed = TRUE)))
output$sens_tg_dt <- renderDT(sens_dt(sens_tg(), "Δ terminal g", function(x) fmt_pct(x, 2, signed = TRUE)))
output$sens_m_dt  <- renderDT({ v <- valuation(); sens_dt(sens_m(), if (v$family == "industrial") "Δ EBIT margin" else "Δ payout", function(x) fmt_pct(x, 1, signed = TRUE)) })
output$sens2d_chart <- renderPlotly({ s <- sens2d(); v <- valuation(); req(v); chart_heatmap(s, v$price, title = s$method) })
