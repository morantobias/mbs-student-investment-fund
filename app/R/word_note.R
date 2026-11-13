# ===========================================================================
# Word research-note pipeline.
#
# The .docx is built by a bundled python-docx script (py/build_note.py) that the
# Shiny app invokes directly — the analyst does not need a separate Word
# pipeline. research_note_data() assembles the company tables and auto text;
# research_note_docx() serialises them to JSON and calls the Python builder.
# ===========================================================================

research_note_data <- function(pkg) {
  b <- pkg$bd; r <- b$ratios; q <- b$quote; v <- pkg$v; a <- pkg$a; h <- pkg$headline; info <- b$info; fin <- b$fin
  rec <- h$rec %||% "n/a"
  action <- switch(rec, Buy = "initiate (or add to) a position in", Sell = "sell its position in",
                   Hold = "hold its existing position in", "review")

  key <- tibble::tibble(
    Item = c("ASX code", paste0("Price (", format(b$loaded_at, "%d/%m/%Y"), ")"),
             "Valuation (exc. FC)", "Margin of safety (MoS) (exc. FC)",
             "Valuation (inc. FC)", "Margin of safety (MoS) (inc. FC)",
             "Ordinary cash dividend yield", "Dividend yield (inc FC)",
             "GICS", "52-week range", "Recommendation", "Cost of equity"),
    Value = c(b$code, fmt_price(q$price), fmt_price(h$value_ex), fmt_pct(h$mos_ex, 2),
              fmt_price(h$value_fc), fmt_pct(h$mos_fc, 2), fmt_pct(r$dividend_yield, 2),
              fmt_pct(r$grossed_yield, 2), info$sector,
              paste0(fmt_price(q$week52_low), " - ", fmt_price(q$week52_high)),
              rec, fmt_pct(h$ke, 2))
  )

  methods <- v$methods %>% dplyr::filter(available) %>%
    dplyr::transmute(Method = label, `Value (exc. FC)` = fmt_price(value_ex), `Value (inc. FC)` = fmt_price(value_fc),
                     Weight = fmt_pct(weight_used, 0), MoS = fmt_pct(if (v$headline_basis == "fc") upside_fc else upside_ex, 1))

  sc <- pkg$scen
  scen_tbl <- if (!is.null(sc)) sc %>%
    dplyr::transmute(Scenario = scenario, Weight = fmt_pct(weight, 0),
                     `Valuation (excl. FC)` = paste0(fmt_price(value_ex), " (MoS: ", fmt_pct(mos_ex, 2), ")"),
                     `Valuation (incl. FC)` = paste0(fmt_price(value_fc), " (MoS: ", fmt_pct(mos_fc, 2), ")")) else NULL

  ke_tbl <- if (!is.null(pkg$sens$ke)) pkg$sens$ke %>%
    dplyr::transmute(Ke = fmt_pct(delta, 2, signed = TRUE), `Valuation w/o FC` = fmt_price(value_ex),
                     `MoS w/o FC` = fmt_pct(mos_ex, 2), `Valuation w/ FC` = fmt_price(value_fc),
                     `MoS w/ FC` = fmt_pct(mos_fc, 2)) else NULL
  g_tbl <- if (!is.null(pkg$sens$growth)) pkg$sens$growth %>%
    dplyr::transmute(Growth = fmt_pct(delta, 1, signed = TRUE), `Valuation w/o FC` = fmt_price(value_ex),
                     `MoS w/o FC` = fmt_pct(mos_ex, 2), `Valuation w/ FC` = fmt_price(value_fc),
                     `MoS w/ FC` = fmt_pct(mos_fc, 2)) else NULL

  fin_tbl <- if (!is.null(fin)) {
    mk <- function(lab, vals) c(list(`Financial year (AUD million)` = lab),
                                setNames(as.list(vals), paste0(fin$fy, "(A)")))
    dplyr::bind_rows(mk("Revenue", fmt_num(fin$revenue / 1e6, 0)), mk("Revenue growth", fmt_pct(fin$revenue_growth)),
                     mk("Operating expenses", fmt_num(fin$operating_expense / 1e6, 0)), mk("EBITDA margin", fmt_pct(fin$ebitda_margin)),
                     mk("NPAT", fmt_num(fin$net_income / 1e6, 0)), mk("NPAT growth", fmt_pct(fin$ni_growth)),
                     mk("EPS", fmt_num(fin$eps, 3)), mk("DPS", fmt_num(fin$dps, 3)), mk("ROE", fmt_pct(fin$roe)),
                     mk("Equity / assets", fmt_pct(fin$equity_assets)), mk("Free cash flow", fmt_num(fin$fcf / 1e6, 0)))
  } else NULL

  proj <- if (v$family == "industrial" && !is.null(v$dcf)) v$dcf$schedule %>%
    dplyr::transmute(Year = label, `Revenue ($m)` = fmt_num(revenue / 1e6, 0), Growth = fmt_pct(revenue_growth),
                     `EBIT ($m)` = fmt_num(ebit / 1e6, 0), `EBIT margin` = fmt_pct(ebit_margin),
                     `FCFF ($m)` = fmt_num(fcff / 1e6, 0), `PV FCFF ($m)` = fmt_num(pv_fcff / 1e6, 0)) else
    if (!is.null(v$ddm)) v$ddm$schedule %>%
      dplyr::transmute(Year = label, EPS = fmt_num(eps, 3), Growth = fmt_pct(eps_growth), Payout = fmt_pct(payout),
                       DPS = fmt_num(dps, 3), `DPS incl. FC` = fmt_num(dps_grossed, 3), BVPS = fmt_num(bvps, 2),
                       ROE = fmt_pct(roe)) else NULL

  model_text <- if (v$family == "industrial")
    paste0("Revenue is forecast top-down from a base of ", fmt_money(a$base_revenue), " with growth of ",
           fmt_pct(a$grid$revenue_growth[1]), " in year one fading to ", fmt_pct(a$grid$revenue_growth[nrow(a$grid)]),
           ". EBIT margins are held near ", fmt_pct(a$grid$ebit_margin[1]), ", capex at ", fmt_pct(a$grid$capex_pct[1]),
           " of revenue and the effective tax rate at ", fmt_pct(a$grid$tax_rate[1]), ". FCFF is discounted at a WACC of ",
           fmt_pct(v$wacc, 2), " (cost of equity ", fmt_pct(v$ke, 2), ", debt weight ", fmt_pct(a$debt_weight, 0),
           ") with terminal growth of ", fmt_pct(a$terminal_growth, 2), "; the terminal value represents ",
           fmt_pct(v$dcf$tv_share %||% NA, 0), " of enterprise value.")
  else paste0("Earnings are forecast from a base EPS of ", fmt_price(a$base_eps, 3), " growing ",
              fmt_pct(a$grid$eps_growth[1]), " in year one and fading to ", fmt_pct(a$grid$eps_growth[nrow(a$grid)]),
              ", with a payout ratio of ", fmt_pct(a$grid$payout[1], 0), ". Dividends are grossed up for franking at ",
              fmt_pct(a$franking, 0), " (factor ", round(v$franking_factor, 3), "x) and discounted at a cost of equity of ",
              fmt_pct(v$ke, 2), " (risk-free ", fmt_pct(a$rf, 2), ", beta ", a$beta, ", MRP ", fmt_pct(a$mrp, 2),
              ") with ", fmt_pct(a$terminal_growth, 2), " terminal growth. The residual income model and the justified P/B ",
              "relationship (ROE ", fmt_pct(r$roe), " against Ke ", fmt_pct(v$ke, 2),
              ") provide cross-checks, and peer P/E and P/B multiples complete the weighted valuation.")

  rec_text <- paste0("The ", info$sector, " team recommends that the Student Investment Fund (SIF) ", action, " ",
                     info$name, " (", b$code, "). ", info$name, " is an ASX-listed ", tolower(info$industry),
                     " company. At ", fmt_price(q$price), " the stock trades on ", fmt_ratio(r$pe_ratio),
                     " trailing earnings and ", fmt_ratio(r$pb_ratio, 2), " book value, with a ",
                     fmt_pct(r$dividend_yield), " cash dividend yield (", fmt_pct(r$grossed_yield),
                     " including franking). Our weighted valuation of ", fmt_price(h$value), " (",
                     if (h$basis == "fc") "including" else "excluding",
                     " franking credits) implies a margin of safety of ", fmt_pct(h$mos, 2), ".")

  val_text <- paste0("Weighted fair value: ", fmt_price(h$value_ex), " excluding franking credits (MoS ",
                     fmt_pct(h$mos_ex, 2), ") and ", fmt_price(h$value_fc), " including franking credits (MoS ",
                     fmt_pct(h$mos_fc, 2), "). Recommendation: ", rec, ".")

  references <- paste0("Yahoo Finance (via yahoofinancer): annual financial statements, prices and quotes for ",
                       b$code, " and peers, accessed ", format(b$loaded_at, "%d %B %Y"),
                       ". MBS SIF equity research workstation v", APP_VERSION,
                       " — valuation engine, scenario and sensitivity analysis. Analyst assumptions: risk-free rate ",
                       fmt_pct(a$rf, 2), ", market risk premium ", fmt_pct(a$mrp, 2), ", beta ", a$beta, ".")

  list(
    code = b$code, name = info$name, sector = info$sector, industry = info$industry,
    family = info$family %||% "financial", price = fmt_price(q$price), rec = rec,
    loaded_at = format(b$loaded_at, "%d/%m/%Y"), generated = format(Sys.time(), "%d/%m/%Y"),
    recommendation_text = rec_text, model_text = model_text, methodology = v$methodology,
    valuation_text = val_text, references = references, version = paste("v", APP_VERSION),
    key = key, methods = methods, scen = scen_tbl, sens_ke = ke_tbl, sens_growth = g_tbl,
    fin = fin_tbl, proj = proj
  )
}

research_note_docx <- function(pkg, file) {
  d <- research_note_data(pkg)
  jf <- tempfile("mbs_note_", fileext = ".json")
  on.exit(unlink(jf), add = TRUE)
  jsonlite::write_json(d, jf, auto_unbox = TRUE, na = "null", null = "null", digits = 10, dataframe = "rows")
  script <- file.path(getwd(), "py", "build_note.py")
  if (!file.exists(script)) stop("Word pipeline not found: ", script)
  out <- suppressWarnings(system2("python3", c(shQuote(script), shQuote(jf), shQuote(file)),
                                  stdout = TRUE, stderr = TRUE))
  if (!file.exists(file) || file.size(file) == 0)
    stop("Word note generation failed: ", paste(out, collapse = "\n"))
  invisible(file)
}
