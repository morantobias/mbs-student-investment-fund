# --- Core reactives: company load, peers, assumptions, valuation chain ----------

rv <- reactiveValues(grid = NULL, scen = NULL, grid_version = 0L, peers_label = NULL)
peers_rv <- reactiveVal(NULL)
sector_rv <- reactiveVal(NULL)

set_busy <- function(on) session$sendCustomMessage("mbs-busy", isTRUE(on))

# --- Sidebar navigation ------------------------------------------------------
# Links in the left sidebar set `nav_page` and toggle their own active class
# client-side; this just selects the matching hidden tab.
observeEvent(input$nav_page, {
  p <- input$nav_page
  if (is.null(p) || !nzchar(p)) return()
  bslib::nav_select("main_nav", selected = p, session = session)
}, ignoreNULL = TRUE)

# Defer the first load until the client has bound all outputs.
load_trigger <- reactiveVal(0L)
session$onFlushed(function() isolate(load_trigger(load_trigger() + 1L)), once = TRUE)

observeEvent(input$refresh, {
  cache_clear_all()
  showNotification("Cache cleared — reloading from Yahoo Finance.", type = "message", duration = 4)
  load_trigger(load_trigger() + 1L)
})

bd <- eventReactive(list(load_trigger(), input$go), {
  symbol <- normalise_ticker(isolate(input$company))
  if (!nzchar(symbol)) return(NULL)
  set_busy(TRUE); on.exit(set_busy(FALSE), add = TRUE)
  res <- withProgress(message = paste0("Loading ", symbol), value = 0, {
    tryCatch(load_company(symbol, isolate(input$period),
                          progress = function(f, m) setProgress(f, detail = m)),
             error = function(e) list(ok = FALSE, symbol = symbol, error = conditionMessage(e)))
  })
  if (!isTRUE(res$ok)) {
    showNotification(res$error %||% "Load failed.", type = "error", duration = 12)
    return(NULL)
  }
  # New company: reset editable model state and sync sidebar defaults
  a0 <- default_assumptions(res, horizon = as.integer(isolate(input$horizon) %||% 5))
  rv$grid <- NULL; rv$scen <- NULL; rv$grid_version <- isolate(rv$grid_version) + 1L
  peers_rv(NULL)
  updateNumericInput(session, "beta", value = a0$beta)
  updateNumericInput(session, "dw", value = round(a0$debt_weight * 100))
  updateNumericInput(session, "tax", value = round(a0$tax_rate * 100, 1))
  updateNumericInput(session, "franking", value = a0$franking * 100)
  updateRadioButtons(session, "basis", selected = a0$headline_basis)
  w <- a0$weights
  updateNumericInput(session, "w_dcf", value = (w$dcf %||% 0) * 100)
  updateNumericInput(session, "w_ddm", value = (w$ddm %||% 0) * 100)
  updateNumericInput(session, "w_rim", value = (w$rim %||% 0) * 100)
  updateNumericInput(session, "w_pe", value = (w$pe %||% 0) * 100)
  updateNumericInput(session, "w_pb", value = (w$pb %||% 0) * 100)
  updateNumericInput(session, "w_ev", value = (w$ev_ebitda %||% 0) * 100)
  updateTextAreaInput(session, "custom_peers", value = paste(default_peers(res$symbol, 10), collapse = ", "))
  session$sendCustomMessage("mbs-scroll-top", TRUE)
  res
}, ignoreNULL = FALSE)

output$load_status <- renderUI({
  b <- bd()
  if (is.null(b)) return(span(class = "text-danger", icon("triangle-exclamation"), " No company loaded"))
  span(icon("circle-check", style = "color:#1E7A46"), " ", b$code, " loaded ", format(b$loaded_at, "%H:%M:%S"),
       " · ", nrow(b$fin %||% tibble()), " fiscal years · ", fmt_int(nrow(b$history %||% tibble())), " trading days")
})

output$clock <- renderUI({
  invalidateLater(60000)
  span(class = "mbs-clock", icon("clock"), " ", format(Sys.time(), "%a %d %b %Y %H:%M %Z", tz = "Australia/Melbourne"))
})

# --- Peers ---------------------------------------------------------------------
peer_codes <- reactive({
  b <- bd(); req(b)
  mode <- input$peer_mode %||% "auto"
  if (mode == "sector") return(sector_codes(b$info$sector, exclude = b$code))
  if (mode == "custom") {
    parts <- toupper(trimws(strsplit(input$custom_peers %||% "", "[,;\\s]+")[[1]]))
    parts <- setdiff(parts[nzchar(parts)], b$code)
    if (length(parts)) return(parts)
  }
  default_peers(b$symbol, 10)
})

peer_trigger <- reactiveVal(0L)
observeEvent(bd(), {
  if (is.null(bd())) return()
  # Schedule after the current flush so the Overview paints before peers load.
  # `later` callbacks are global, so they can fire after the session ends —
  # guard against touching a destroyed reactive domain, which would throw and
  # halt the whole app.
  later::later(function() {
    tryCatch(isolate(peer_trigger(peer_trigger() + 1L)), error = function(e) NULL)
  }, 0.25)
}, ignoreNULL = FALSE)
observeEvent(input$peer_load, peer_trigger(peer_trigger() + 1L))

observeEvent(peer_trigger(), {
  b <- bd(); if (is.null(b)) return()
  codes <- isolate(peer_codes())
  set_busy(TRUE); on.exit(set_busy(FALSE), add = TRUE)
  res <- withProgress(message = "Loading peer set", value = 0, {
    tryCatch(load_peer_set(codes, include = b$symbol, period = "1y",
                           progress = function(f, m) setProgress(f, detail = m)),
             error = function(e) NULL)
  })
  if (is.null(res)) { showNotification("Peer data unavailable.", type = "warning", duration = 6); return() }
  rv$peers_label <- switch(isolate(input$peer_mode) %||% "auto", sector = paste("GICS sector:", b$info$sector),
                           custom = "Custom peer set", paste("Industry peers:", b$info$industry))
  peers_rv(res)
}, ignoreInit = TRUE)

peers_tbl <- reactive({ p <- peers_rv(); if (is.null(p)) NULL else p$table })

# --- Assumptions (sidebar inputs + editable grids) -----------------------------
pct <- function(x, default) (x %||% default) / 100

assumptions <- reactive({
  b <- bd(); req(b)
  a <- default_assumptions(b, horizon = as.integer(input$horizon %||% 5))
  a$rf <- pct(input$rf, FUND_DEFAULTS$rf); a$beta <- input$beta %||% a$beta; a$mrp <- pct(input$mrp, FUND_DEFAULTS$mrp)
  a$cost_of_debt <- pct(input$kd, FUND_DEFAULTS$kd); a$debt_weight <- pct(input$dw, 20); a$tax_rate <- pct(input$tax, FUND_DEFAULTS$tax)
  a$terminal_growth <- pct(input$tg, FUND_DEFAULTS$tg); a$franking <- pct(input$franking, FUND_DEFAULTS$franking)
  a$midyear <- isTRUE(input$midyear); a$headline_basis <- input$basis %||% a$headline_basis
  a$rec_buy <- pct(input$rec_buy, FUND_DEFAULTS$buy); a$rec_sell <- pct(input$rec_sell, FUND_DEFAULTS$sell)
  a$weights <- list(dcf = pct(input$w_dcf, 0), ddm = pct(input$w_ddm, 0), rim = pct(input$w_rim, 0),
                    pe = pct(input$w_pe, 0), pb = pct(input$w_pb, 0), ev_ebitda = pct(input$w_ev, 0))
  g <- rv$grid
  if (!is.null(g) && nrow(g) == nrow(a$grid) && identical(names(g), names(a$grid))) a$grid <- g
  s <- rv$scen
  if (!is.null(s) && identical(names(s), names(a$scenarios))) a$scenarios <- s
  a
})

observeEvent(input$horizon, { rv$grid <- NULL; rv$grid_version <- rv$grid_version + 1L }, ignoreInit = TRUE)
observeEvent(input$grid_reset, { rv$grid <- NULL; rv$grid_version <- rv$grid_version + 1L })
observeEvent(input$scen_reset, { rv$scen <- NULL; rv$grid_version <- rv$grid_version + 1L })
observeEvent(input$reset_assumptions, {
  b <- bd(); req(b)
  a0 <- default_assumptions(b)
  updateNumericInput(session, "rf", value = FUND_DEFAULTS$rf); updateNumericInput(session, "mrp", value = FUND_DEFAULTS$mrp)
  updateNumericInput(session, "kd", value = FUND_DEFAULTS$kd); updateNumericInput(session, "tg", value = FUND_DEFAULTS$tg)
  updateNumericInput(session, "beta", value = a0$beta); updateNumericInput(session, "dw", value = round(a0$debt_weight * 100))
  updateNumericInput(session, "tax", value = round(a0$tax_rate * 100, 1)); updateNumericInput(session, "franking", value = a0$franking * 100)
  updateCheckboxInput(session, "midyear", value = FALSE); updateSelectInput(session, "horizon", selected = 5)
  updateRadioButtons(session, "basis", selected = a0$headline_basis)
  updateNumericInput(session, "rec_buy", value = FUND_DEFAULTS$buy); updateNumericInput(session, "rec_sell", value = FUND_DEFAULTS$sell)
  w <- a0$weights
  updateNumericInput(session, "w_dcf", value = (w$dcf %||% 0) * 100); updateNumericInput(session, "w_ddm", value = (w$ddm %||% 0) * 100)
  updateNumericInput(session, "w_rim", value = (w$rim %||% 0) * 100); updateNumericInput(session, "w_pe", value = (w$pe %||% 0) * 100)
  updateNumericInput(session, "w_pb", value = (w$pb %||% 0) * 100); updateNumericInput(session, "w_ev", value = (w$ev_ebitda %||% 0) * 100)
  rv$grid <- NULL; rv$scen <- NULL; rv$grid_version <- rv$grid_version + 1L
})

# --- Valuation chain -------------------------------------------------------------
valuation <- reactive({ b <- bd(); req(b); run_valuation(b, peers_tbl(), assumptions()) })
scenarios <- reactive({ b <- bd(); req(b); run_scenarios(b, peers_tbl(), assumptions()) })
sens_ke   <- reactive({ b <- bd(); req(b); sensitivity_1d(b, peers_tbl(), assumptions(), "ke") })
sens_g    <- reactive({ b <- bd(); req(b); sensitivity_1d(b, peers_tbl(), assumptions(), "growth") })
sens_tg   <- reactive({ b <- bd(); req(b); sensitivity_1d(b, peers_tbl(), assumptions(), "tg") })
sens_m    <- reactive({ b <- bd(); req(b); a <- assumptions()
  if (a$family == "industrial") sensitivity_1d(b, peers_tbl(), a, "margin") else
    purrr::map_dfr(seq(-0.15, 0.15, 0.05), function(d) { v <- run_valuation(b, peers_tbl(), a, payout_delta = d)
      tibble(delta = d, ke = v$ke, value_ex = v$weighted_value_ex, mos_ex = v$mos_ex, value_fc = v$weighted_value_fc, mos_fc = v$mos_fc) }) })
sens2d    <- reactive({ b <- bd(); req(b); sensitivity_2d(b, assumptions(), basis = input$basis %||% "fc") })
football  <- reactive({ b <- bd(); req(b); football_field(b, valuation(), scenarios(), sens_ke()) })

# Headline helpers
headline <- reactive({
  v <- valuation(); b <- bd()
  list(value = v$weighted_value, mos = v$upside, rec = v$recommendation, basis = v$headline_basis, ke = v$ke, wacc = v$wacc,
       value_ex = v$weighted_value_ex, value_fc = v$weighted_value_fc, mos_ex = v$mos_ex, mos_fc = v$mos_fc)
})

# --- Persistent company strip ----------------------------------------------------
output$company_strip <- renderUI({
  b <- bd()
  if (is.null(b)) return(div(class = "mbs-strip", muted("Choose a company and press Load.")))
  q <- b$quote; r <- b$ratios; h <- tryCatch(headline(), error = function(e) NULL)
  chg_cls <- if (!is.na(q$change) && q$change >= 0) "pos" else "neg"
  pos52 <- if (!is.na(q$week52_high) && !is.na(q$week52_low) && q$week52_high > q$week52_low) (q$price - q$week52_low) / (q$week52_high - q$week52_low) else NA
  div(class = "mbs-strip",
    div(span(class = "code", b$code), span(class = "name", b$info$name),
        div(class = "meta", b$info$sector, " › ", b$info$industry, " · ", b$meta$full_exchange_name %||% "ASX", " · ", q$currency %||% "AUD",
            " · as of ", format(b$loaded_at, "%d %b %Y %H:%M"))),
    div(span(class = "px", fmt_price(q$price)),
        span(class = paste("chg", chg_cls), fmt_price(q$change, 2), " (", fmt_pct(q$change_pct, 2, signed = TRUE), ")")),
    div(class = "mbs-range",
        div(class = "ends", span("52w ", fmt_price(q$week52_low)), span(fmt_price(q$week52_high))),
        div(class = "bar", if (!is.na(pos52)) div(class = "dot", style = paste0("left:", round(pos52 * 100, 1), "%")))),
    div(class = "kv", span(class = "k", "Market cap"), span(class = "v", fmt_money(r$market_cap))),
    div(class = "kv", span(class = "k", "P/E"), span(class = "v", fmt_ratio(r$pe_ratio))),
    div(class = "kv", span(class = "k", "P/B"), span(class = "v", fmt_ratio(r$pb_ratio, 2))),
    div(class = "kv", span(class = "k", "Yield"), span(class = "v", fmt_pct(r$dividend_yield))),
    div(class = "kv", span(class = "k", "Fair value"), span(class = "v", if (!is.null(h)) fmt_price(h$value) else "–")),
    div(class = "kv", span(class = "k", "Margin of safety"), span(class = "v", style = if (!is.null(h) && !is.na(h$mos)) paste0("color:", if (h$mos >= 0) MBS$positive else MBS$negative), if (!is.null(h)) fmt_pct(h$mos, 1, signed = TRUE) else "–")),
    div(if (!is.null(h)) rec_badge(h$rec) else rec_badge("n/a"))
  )
})
