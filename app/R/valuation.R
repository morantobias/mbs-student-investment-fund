# ===========================================================================
# Valuation engine — sector-aware, assumption-driven, pure functions.
#
#   industrial : unlevered FCFF DCF (per-year driver grid) + peer multiples
#                + dividend cross-check; reverse DCF; EV bridge
#   financial  : two-stage dividend discount model with franking gross-up,
#   (bank /      residual-income model, justified P/B (excess returns) and
#    insurer)    peer multiples — the Westpac S1 2026 methodology
#   reit       : distribution model + NTA (P/B) + multiples
#
# Everything reports both ex- and including franking credits where dividends
# are involved, plus scenario weighting and 1-D / 2-D sensitivities.
# ===========================================================================

CORP_TAX_AU <- 0.30

# --- Cost of capital ------------------------------------------------------------
cost_of_equity <- function(rf, beta, mrp) rf + beta * mrp
wacc_calc <- function(ke, kd, tax, dw) ke * (1 - dw) + kd * (1 - tax) * dw
franking_factor <- function(franking = 1, corp_tax = CORP_TAX_AU) 1 + franking * corp_tax / (1 - corp_tax)

# --- Default assumptions derived from the loaded company ------------------------
default_assumptions <- function(bd, horizon = 5) {
  r <- bd$ratios; fin <- bd$fin; info <- bd$info
  family <- info$family %||% "industrial"
  price <- n1(r$price)
  beta_hist <- n1(bd$metrics$beta)
  beta <- if (!is.na(beta_hist)) round(clamp(beta_hist, 0.4, 2.0), 2) else 1.0
  mcap <- n1(r$market_cap); debt <- n1(r$total_debt); if (is.na(debt)) debt <- 0
  dw <- if (!is.na(mcap) && mcap > 0 && family == "industrial") clamp(debt / (debt + mcap), 0, 0.6) else 0.2
  tax_eff <- n1(r$tax_rate_eff)
  tax <- if (!is.na(tax_eff) && tax_eff > 0.05 && tax_eff < 0.45) round(tax_eff, 3) else CORP_TAX_AU

  has_div <- !is.na(n1(r$dps)) && n1(r$dps) > 0
  tg <- 0.025
  n <- horizon
  yrs <- seq_len(n)
  last_fy <- n1(r$fy); if (is.na(last_fy)) last_fy <- as.integer(format(Sys.Date(), "%Y"))
  labels <- paste0("FY", substr(as.character(last_fy + yrs), 3, 4), "E")

  fade <- function(start, end, n) if (n == 1) end else seq(start, end, length.out = n)

  if (family == "industrial") {
    g0 <- n1(r$revenue_cagr); g0 <- if (is.na(g0)) 0.04 else clamp(g0, -0.05, 0.15)
    m0 <- n1(r$ebit_margin); m0 <- if (is.na(m0)) 0.12 else clamp(m0, -0.2, 0.7)
    da0 <- n1(r$da_revenue); da0 <- if (is.na(da0)) 0.03 else clamp(da0, 0, 0.3)
    cx0 <- n1(r$capex_revenue); cx0 <- if (is.na(cx0)) max(da0, 0.03) else clamp(cx0, 0, 0.4)
    nwc0 <- n1(r$nwc_revenue); nwc0 <- if (is.na(nwc0)) 0.02 else clamp(nwc0, -0.3, 0.4)
    grid <- data.frame(
      year = yrs, label = labels,
      revenue_growth = round(fade(g0, max(tg, min(g0, 0.05)), n), 4),
      ebit_margin = round(rep(m0, n), 4),
      da_pct = round(rep(da0, n), 4),
      capex_pct = round(fade(cx0, (cx0 + da0) / 2, n), 4),
      nwc_pct = round(rep(nwc0, n), 4),
      tax_rate = round(rep(tax, n), 4),
      stringsAsFactors = FALSE
    )
  } else {
    g0 <- n1(r$eps_cagr); if (is.na(g0)) g0 <- n1(r$ni_cagr); g0 <- if (is.na(g0)) 0.03 else clamp(g0, -0.05, 0.12)
    p0 <- n1(r$payout); p0 <- if (is.na(p0) || p0 <= 0) (if (family == "bank") 0.75 else 0.6) else clamp(p0, 0.2, 1.0)
    grid <- data.frame(
      year = yrs, label = labels,
      eps_growth = round(fade(g0, max(tg, min(g0, 0.04)), n), 4),
      payout = round(rep(p0, n), 4),
      stringsAsFactors = FALSE
    )
  }

  weights <- switch(family,
    bank      = list(ddm = 0.40, rim = 0.20, pe = 0.20, pb = 0.20, dcf = 0, ev_ebitda = 0),
    insurer   = list(ddm = 0.35, rim = 0.15, pe = 0.30, pb = 0.20, dcf = 0, ev_ebitda = 0),
    financial = list(ddm = 0.35, rim = 0.15, pe = 0.30, pb = 0.20, dcf = 0, ev_ebitda = 0),
    reit      = list(ddm = 0.40, rim = 0, pe = 0.15, pb = 0.30, dcf = 0, ev_ebitda = 0.15),
    list(dcf = 0.50, pe = 0.20, ev_ebitda = 0.20, pb = 0, ddm = if (has_div) 0.10 else 0, rim = 0)
  )

  scenarios <- data.frame(
    scenario = c("Bear", "Base", "Bull"),
    weight = c(0.25, 0.50, 0.25),
    growth_delta = c(-0.02, 0, 0.02),
    margin_delta = c(-0.02, 0, 0.02),
    payout_delta = c(-0.05, 0, 0.05),
    ke_delta = c(0.005, 0, -0.005),
    tg_delta = c(-0.005, 0, 0.005),
    stringsAsFactors = FALSE
  )

  list(
    family = family, price = price, shares = n1(r$shares_out),
    net_debt = n1(r$net_debt) %||% 0, cash = n1(r$cash), nonop_assets = 0, minority_interest = 0,
    rf = 0.045, beta = beta, mrp = 0.06, cost_of_debt = 0.06, debt_weight = round(dw, 3),
    tax_rate = tax, terminal_growth = tg, franking = if (has_div) 1.0 else 0, corp_tax = CORP_TAX_AU,
    midyear = FALSE, horizon = n,
    base_revenue = n1(r$revenue), base_eps = n1(r$eps), base_dps = n1(r$dps),
    base_bvps = n1(r$bvps), base_roe = n1(r$roe),
    grid = grid, weights = weights, scenarios = scenarios,
    headline_basis = if (has_div && family != "industrial") "fc" else "ex",
    rec_buy = 0.10, rec_sell = -0.05
  )
}

# --- Industrial: FCFF projection & DCF ----------------------------------------------
project_industrial <- function(a) {
  g <- a$grid; n <- nrow(g)
  rev0 <- a$base_revenue; if (is.na(rev0) || rev0 <= 0) return(NULL)
  revenue <- numeric(n); prev <- rev0
  for (i in seq_len(n)) { revenue[i] <- prev * (1 + g$revenue_growth[i]); prev <- revenue[i] }
  ebit <- revenue * g$ebit_margin
  tax <- g$tax_rate
  nopat <- ebit * (1 - tax)
  da <- revenue * g$da_pct
  capex <- revenue * g$capex_pct
  nwc <- revenue * g$nwc_pct
  nwc0 <- rev0 * g$nwc_pct[1]
  delta_nwc <- c(nwc[1] - nwc0, diff(nwc))
  fcff <- nopat + da - capex - delta_nwc
  tibble::tibble(year = g$year, label = g$label, revenue = revenue, revenue_growth = g$revenue_growth,
                 ebit = ebit, ebit_margin = g$ebit_margin, tax = ebit * tax, nopat = nopat,
                 da = da, capex = capex, delta_nwc = delta_nwc, fcff = fcff,
                 ebitda = ebit + da, fcff_margin = fcff / revenue)
}

run_dcf <- function(a, wacc_override = NULL, tg_override = NULL, proj = NULL) {
  proj <- proj %||% project_industrial(a)
  if (is.null(proj)) return(NULL)
  ke <- cost_of_equity(a$rf, a$beta, a$mrp)
  w <- wacc_override %||% wacc_calc(ke, a$cost_of_debt, a$tax_rate, a$debt_weight)
  tg <- tg_override %||% a$terminal_growth
  n <- nrow(proj)
  t <- if (isTRUE(a$midyear)) proj$year - 0.5 else proj$year
  disc <- 1 / (1 + w)^t
  pv <- proj$fcff * disc
  tv_fcff <- proj$fcff[n] * (1 + tg)
  tv <- if (w > tg) tv_fcff / (w - tg) else NA_real_
  pv_tv <- tv / (1 + w)^proj$year[n]
  ev <- sum(pv) + pv_tv
  equity <- ev - (a$net_debt %||% 0) + (a$nonop_assets %||% 0) - (a$minority_interest %||% 0)
  ps <- if (!is.na(a$shares) && a$shares > 0) equity / a$shares else NA_real_
  proj$discount_factor <- disc; proj$pv_fcff <- pv
  list(
    schedule = proj, ke = ke, wacc = w, terminal_growth = tg,
    terminal_fcff = tv_fcff, terminal_value = tv, pv_terminal = pv_tv, pv_fcff_sum = sum(pv),
    tv_share = if (!is.na(ev) && ev != 0) pv_tv / ev else NA_real_,
    enterprise_value = ev, equity_value = equity, per_share = ps,
    upside = if (!is.na(a$price) && a$price > 0) ps / a$price - 1 else NA_real_,
    implied_ev_ebitda = if (!is.na(proj$ebitda[1]) && proj$ebitda[1] > 0) ev / proj$ebitda[1] else NA_real_
  )
}

# Reverse DCF: the uniform revenue growth (and separately the terminal growth)
# that reconciles the DCF to the current share price.
reverse_dcf <- function(a) {
  if (is.null(a$price) || is.na(a$price) || a$price <= 0) return(NULL)
  f_growth <- function(gg) {
    b <- a; b$grid$revenue_growth <- rep(gg, nrow(b$grid))
    d <- run_dcf(b); if (is.null(d) || is.na(d$per_share)) return(NA_real_)
    d$per_share - a$price
  }
  f_tg <- function(tg) {
    d <- run_dcf(a, tg_override = tg); if (is.null(d) || is.na(d$per_share)) return(NA_real_)
    d$per_share - a$price
  }
  solve <- function(f, lo, hi) {
    v <- tryCatch({
      flo <- f(lo); fhi <- f(hi)
      if (is.na(flo) || is.na(fhi) || sign(flo) == sign(fhi)) NA_real_ else stats::uniroot(f, c(lo, hi))$root
    }, error = function(e) NA_real_)
    v
  }
  w <- wacc_calc(cost_of_equity(a$rf, a$beta, a$mrp), a$cost_of_debt, a$tax_rate, a$debt_weight)
  list(implied_growth = solve(f_growth, -0.3, 0.6),
       implied_terminal_growth = solve(f_tg, -0.05, w - 0.002))
}

# --- Financials: earnings / dividend / book value projection --------------------------
project_financial <- function(a) {
  g <- a$grid; n <- nrow(g)
  eps0 <- a$base_eps; b0 <- a$base_bvps
  if (is.na(eps0) || eps0 <= 0) return(NULL)
  if (is.na(b0)) b0 <- 0
  eps <- numeric(n); dps <- numeric(n); bvps <- numeric(n); roe <- numeric(n)
  prev_eps <- eps0; prev_b <- b0
  for (i in seq_len(n)) {
    eps[i] <- prev_eps * (1 + g$eps_growth[i])
    dps[i] <- eps[i] * g$payout[i]
    bvps[i] <- prev_b + eps[i] - dps[i]
    roe[i] <- if (prev_b > 0) eps[i] / prev_b else NA_real_
    prev_eps <- eps[i]; prev_b <- bvps[i]
  }
  tibble::tibble(year = g$year, label = g$label, eps = eps, eps_growth = g$eps_growth,
                 payout = g$payout, dps = dps, bvps_open = c(b0, bvps[-n]), bvps = bvps, roe = roe)
}

# Two-stage DDM: explicit dividends (grossed up for franking) + Gordon terminal.
run_ddm <- function(a, proj = NULL, ke_override = NULL, g_override = NULL) {
  proj <- proj %||% project_financial(a)
  if (is.null(proj)) return(NULL)
  ke <- ke_override %||% cost_of_equity(a$rf, a$beta, a$mrp)
  g <- g_override %||% a$terminal_growth
  ff <- franking_factor(a$franking %||% 0, a$corp_tax %||% CORP_TAX_AU)
  n <- nrow(proj)
  disc <- 1 / (1 + ke)^proj$year
  pv_ex <- proj$dps * disc
  tv_ex <- if (ke > g) proj$dps[n] * (1 + g) / (ke - g) else NA_real_
  pv_tv_ex <- tv_ex * disc[n]
  value_ex <- sum(pv_ex) + pv_tv_ex
  value_fc <- value_ex * ff
  proj$discount_factor <- disc; proj$pv_dps <- pv_ex; proj$dps_grossed <- proj$dps * ff
  list(
    schedule = proj, ke = ke, terminal_growth = g, franking_factor = ff,
    pv_explicit = sum(pv_ex), terminal_value = tv_ex, pv_terminal = pv_tv_ex,
    tv_share = if (!is.na(value_ex) && value_ex != 0) pv_tv_ex / value_ex else NA_real_,
    value_ex = value_ex, value_fc = value_fc,
    upside_ex = if (!is.na(a$price) && a$price > 0) value_ex / a$price - 1 else NA_real_,
    upside_fc = if (!is.na(a$price) && a$price > 0) value_fc / a$price - 1 else NA_real_,
    yield_ex = if (!is.na(a$price) && a$price > 0) a$base_dps / a$price else NA_real_,
    yield_fc = if (!is.na(a$price) && a$price > 0) a$base_dps * ff / a$price else NA_real_
  )
}

# Residual income model: B0 + PV(EPS_t - ke * B_{t-1}) + terminal residual income.
run_rim <- function(a, proj = NULL, ke_override = NULL, g_override = NULL) {
  proj <- proj %||% project_financial(a)
  if (is.null(proj) || is.na(a$base_bvps) || a$base_bvps <= 0) return(NULL)
  ke <- ke_override %||% cost_of_equity(a$rf, a$beta, a$mrp)
  g <- g_override %||% a$terminal_growth
  n <- nrow(proj)
  ri <- proj$eps - ke * proj$bvps_open
  disc <- 1 / (1 + ke)^proj$year
  pv_ri <- ri * disc
  tv <- if (ke > g) ri[n] * (1 + g) / (ke - g) else NA_real_
  pv_tv <- tv * disc[n]
  value <- a$base_bvps + sum(pv_ri) + pv_tv
  proj$residual_income <- ri; proj$pv_ri <- pv_ri
  list(schedule = proj, ke = ke, terminal_growth = g, book_value = a$base_bvps,
       pv_ri = sum(pv_ri), terminal_value = tv, pv_terminal = pv_tv, value = value,
       upside = if (!is.na(a$price) && a$price > 0) value / a$price - 1 else NA_real_)
}

run_justified_pb <- function(roe, g, ke, bvps, price) {
  jpb <- if (!is.na(roe) && !is.na(ke) && ke > g) (roe - g) / (ke - g) else NA_real_
  value <- if (!is.na(jpb) && !is.na(bvps) && jpb > 0) jpb * bvps else NA_real_
  list(roe = roe, growth = g, ke = ke, bvps = bvps, justified_pb = jpb, value = value,
       spread = roe - ke,
       upside = if (!is.na(price) && price > 0 && !is.na(value)) value / price - 1 else NA_real_)
}

# --- Relative valuation ---------------------------------------------------------------
peer_stat <- function(x, f = stats::median) { x <- x[!is.na(x) & is.finite(x) & x > 0]; if (length(x) == 0) NA_real_ else f(x) }

run_relative <- function(r, peers) {
  peers <- if (is.null(peers)) tibble::tibble() else peers[peers$ticker != r$ticker, ]
  n <- nrow(peers)
  q <- function(col, p) if (n == 0) NA_real_ else peer_stat(peers[[col]], function(x) stats::quantile(x, p, names = FALSE))
  med <- function(col) if (n == 0) NA_real_ else peer_stat(peers[[col]])
  eps <- n1(r$eps); bvps <- n1(r$bvps); ebitda <- n1(r$ebitda); dps <- n1(r$dps)
  shares <- n1(r$shares_out); nd <- n1(r$net_debt); if (is.na(nd)) nd <- 0
  v_from_ev <- function(mult) if (!is.na(mult) && !is.na(ebitda) && ebitda > 0 && !is.na(shares) && shares > 0) (mult * ebitda - nd) / shares else NA_real_
  v_pe <- function(m) if (!is.na(m) && !is.na(eps) && eps > 0) eps * m else NA_real_
  v_pb <- function(m) if (!is.na(m) && !is.na(bvps) && bvps > 0) bvps * m else NA_real_
  v_dy <- function(y) if (!is.na(y) && y > 0 && !is.na(dps) && dps > 0) dps / y else NA_real_
  tibble::tibble(
    method = c("pe", "pb", "ev_ebitda", "div_yield"),
    label = c("Peer P/E", "Peer P/B", "Peer EV/EBITDA", "Peer dividend yield"),
    multiple_low = c(q("pe_ratio", .25), q("pb_ratio", .25), q("ev_ebitda", .25), q("dividend_yield", .75)),
    multiple = c(med("pe_ratio"), med("pb_ratio"), med("ev_ebitda"), med("dividend_yield")),
    multiple_high = c(q("pe_ratio", .75), q("pb_ratio", .75), q("ev_ebitda", .75), q("dividend_yield", .25)),
    company_multiple = c(n1(r$pe_ratio), n1(r$pb_ratio), n1(r$ev_ebitda), n1(r$dividend_yield)),
    value_low = c(v_pe(q("pe_ratio", .25)), v_pb(q("pb_ratio", .25)), v_from_ev(q("ev_ebitda", .25)), v_dy(q("dividend_yield", .75))),
    value = c(v_pe(med("pe_ratio")), v_pb(med("pb_ratio")), v_from_ev(med("ev_ebitda")), v_dy(med("dividend_yield"))),
    value_high = c(v_pe(q("pe_ratio", .75)), v_pb(q("pb_ratio", .75)), v_from_ev(q("ev_ebitda", .75)), v_dy(q("dividend_yield", .25))),
    n_peers = n
  )
}

# --- Master orchestration --------------------------------------------------------------
recommendation <- function(mos, buy = 0.10, sell = -0.05) {
  if (is.null(mos) || is.na(mos)) return("n/a")
  if (mos >= buy) "Buy" else if (mos <= sell) "Sell" else "Hold"
}

run_valuation <- function(bd, peers = NULL, a = NULL, ke_delta = 0, g_delta = 0, tg_delta = 0,
                          margin_delta = 0, payout_delta = 0) {
  a <- a %||% default_assumptions(bd)
  r <- bd$ratios
  price <- a$price
  fam <- a$family
  # Apply scenario / sensitivity deltas to a copy of the assumptions
  b <- a
  b$rf <- a$rf + ke_delta
  b$terminal_growth <- a$terminal_growth + tg_delta
  if (fam == "industrial") {
    b$grid$revenue_growth <- a$grid$revenue_growth + g_delta
    b$grid$ebit_margin <- a$grid$ebit_margin + margin_delta
  } else {
    b$grid$eps_growth <- a$grid$eps_growth + g_delta
    b$grid$payout <- clamp(a$grid$payout + payout_delta, 0, 1.2)
  }
  ke <- cost_of_equity(b$rf, b$beta, b$mrp)
  wacc <- wacc_calc(ke, b$cost_of_debt, b$tax_rate, b$debt_weight)
  is_fin <- fam %in% c("bank", "insurer", "financial", "reit")

  dcf <- if (fam == "industrial") tryCatch(run_dcf(b), error = function(e) NULL) else NULL
  # The earnings/book-value projection only needs a positive EPS base. The DDM
  # additionally needs a dividend (base_dps > 0), but the residual-income model
  # is valid for non-dividend payers (all earnings are retained).
  proj_eps <- if (!is.na(b$base_eps) && b$base_eps > 0) tryCatch(project_financial(b), error = function(e) NULL) else NULL
  ddm <- if (!is.null(proj_eps) && !is.na(b$base_dps) && b$base_dps > 0) run_ddm(b, proj_eps, ke) else NULL
  rim <- if (!is.null(proj_eps) && is_fin) run_rim(b, proj_eps, ke) else NULL
  jpb <- if (is_fin) run_justified_pb(n1(r$roe), b$terminal_growth, ke, n1(r$bvps), price) else NULL
  rel <- run_relative(r, peers)

  w <- b$weights
  ff <- franking_factor(b$franking %||% 0, b$corp_tax %||% CORP_TAX_AU)
  getv <- function(m) rel$value[rel$method == m]; getlo <- function(m) rel$value_low[rel$method == m]; gethi <- function(m) rel$value_high[rel$method == m]
  methods <- tibble::tibble(
    method = c("dcf", "ddm", "rim", "pe", "pb", "ev_ebitda"),
    label = c("FCFF DCF", "Dividend discount model", "Residual income model",
              "Peer P/E", "Peer P/B", "Peer EV/EBITDA"),
    value_ex = c(dcf$per_share %||% NA_real_, ddm$value_ex %||% NA_real_, rim$value %||% NA_real_,
                 getv("pe"), getv("pb"), getv("ev_ebitda")),
    value_fc = c(dcf$per_share %||% NA_real_, ddm$value_fc %||% NA_real_, rim$value %||% NA_real_,
                 getv("pe"), getv("pb"), getv("ev_ebitda")),
    low = c(NA_real_, NA_real_, NA_real_, getlo("pe"), getlo("pb"), getlo("ev_ebitda")),
    high = c(NA_real_, NA_real_, NA_real_, gethi("pe"), gethi("pb"), gethi("ev_ebitda")),
    weight = c(w$dcf %||% 0, w$ddm %||% 0, w$rim %||% 0, w$pe %||% 0, w$pb %||% 0, w$ev_ebitda %||% 0)
  )
  methods$available <- !is.na(methods$value_ex) & methods$value_ex > 0
  if (fam %in% c("bank", "insurer", "financial")) methods$available[methods$method == "ev_ebitda"] <- FALSE
  methods$in_use <- methods$available & methods$weight > 0
  tot <- sum(methods$weight[methods$in_use])
  methods$weight_used <- ifelse(methods$in_use & tot > 0, methods$weight / tot, 0)
  methods$upside_ex <- if (!is.na(price) && price > 0) methods$value_ex / price - 1 else NA_real_
  methods$upside_fc <- if (!is.na(price) && price > 0) methods$value_fc / price - 1 else NA_real_
  methods$note <- dplyr::case_when(
    methods$method == "dcf" & !methods$available & fam != "industrial" ~ "Not applied to financials / REITs",
    methods$method == "dcf" & !methods$available ~ "DCF unavailable (no revenue base or negative value)",
    methods$method %in% c("ddm", "rim") & !methods$available ~ "No positive dividend / EPS base",
    methods$method == "ev_ebitda" & fam %in% c("bank", "insurer", "financial") ~ "Not meaningful for financials (interest is operating)",
    methods$method %in% c("pe", "pb", "ev_ebitda") & !methods$available ~ "Peer multiple or company metric unavailable",
    methods$available & methods$weight == 0 ~ "Shown for reference (zero weight)",
    TRUE ~ ""
  )

  wv_ex <- if (tot > 0) sum(methods$value_ex[methods$in_use] * methods$weight_used[methods$in_use]) else NA_real_
  wv_fc <- if (tot > 0) sum(methods$value_fc[methods$in_use] * methods$weight_used[methods$in_use]) else NA_real_
  mos_ex <- if (!is.na(price) && price > 0) wv_ex / price - 1 else NA_real_
  mos_fc <- if (!is.na(price) && price > 0) wv_fc / price - 1 else NA_real_
  basis <- a$headline_basis %||% "ex"
  headline_value <- if (basis == "fc") wv_fc else wv_ex
  headline_mos <- if (basis == "fc") mos_fc else mos_ex

  list(
    family = fam, is_financial = is_fin, assumptions = b, price = price,
    ke = ke, wacc = wacc, franking_factor = ff,
    dcf = dcf, ddm = ddm, rim = rim, jpb = jpb, rel = rel, methods = methods,
    weighted_value_ex = wv_ex, weighted_value_fc = wv_fc, mos_ex = mos_ex, mos_fc = mos_fc,
    headline_basis = basis, weighted_value = headline_value, upside = headline_mos,
    recommendation = recommendation(headline_mos, a$rec_buy %||% 0.10, a$rec_sell %||% -0.05),
    methodology = unname(model_family_label[fam])
  )
}

# --- Scenarios -------------------------------------------------------------------------
run_scenarios <- function(bd, peers, a) {
  sc <- a$scenarios
  rows <- purrr::map_dfr(seq_len(nrow(sc)), function(i) {
    v <- run_valuation(bd, peers, a, ke_delta = sc$ke_delta[i], g_delta = sc$growth_delta[i],
                       tg_delta = sc$tg_delta[i], margin_delta = sc$margin_delta[i],
                       payout_delta = sc$payout_delta[i])
    tibble::tibble(scenario = sc$scenario[i], weight = sc$weight[i],
                   growth_delta = sc$growth_delta[i], margin_delta = sc$margin_delta[i],
                   payout_delta = sc$payout_delta[i], ke_delta = sc$ke_delta[i], tg_delta = sc$tg_delta[i],
                   ke = v$ke, value_ex = v$weighted_value_ex, mos_ex = v$mos_ex,
                   value_fc = v$weighted_value_fc, mos_fc = v$mos_fc)
  })
  wsum <- sum(rows$weight)
  ok <- !is.na(rows$value_ex)
  wt <- if (wsum > 0) rows$weight / wsum else rep(NA_real_, nrow(rows))
  final <- tibble::tibble(
    scenario = "Probability-weighted", weight = wsum,
    growth_delta = NA_real_, margin_delta = NA_real_, payout_delta = NA_real_, ke_delta = NA_real_, tg_delta = NA_real_,
    ke = NA_real_,
    value_ex = if (any(ok)) sum(rows$value_ex[ok] * wt[ok]) / sum(wt[ok]) else NA_real_,
    value_fc = if (any(ok)) sum(rows$value_fc[ok] * wt[ok]) / sum(wt[ok]) else NA_real_
  )
  final$mos_ex <- if (!is.na(a$price) && a$price > 0) final$value_ex / a$price - 1 else NA_real_
  final$mos_fc <- if (!is.na(a$price) && a$price > 0) final$value_fc / a$price - 1 else NA_real_
  dplyr::bind_rows(rows, final)
}

# --- Sensitivities ---------------------------------------------------------------------
sensitivity_1d <- function(bd, peers, a, var = c("ke", "growth", "tg", "margin"),
                           steps = NULL) {
  var <- match.arg(var)
  steps <- steps %||% switch(var,
    ke = seq(-0.02, 0.02, 0.005), growth = seq(-0.03, 0.03, 0.01),
    tg = seq(-0.01, 0.01, 0.0025), margin = seq(-0.03, 0.03, 0.01))
  purrr::map_dfr(steps, function(d) {
    v <- switch(var,
      ke = run_valuation(bd, peers, a, ke_delta = d),
      growth = run_valuation(bd, peers, a, g_delta = d),
      tg = run_valuation(bd, peers, a, tg_delta = d),
      margin = run_valuation(bd, peers, a, margin_delta = d))
    tibble::tibble(delta = d, ke = v$ke, value_ex = v$weighted_value_ex, mos_ex = v$mos_ex,
                   value_fc = v$weighted_value_fc, mos_fc = v$mos_fc)
  })
}

# 2-D grid on the primary intrinsic method (DCF per share for industrials:
# WACC x terminal growth; DDM value for financials: Ke x terminal growth).
sensitivity_2d <- function(bd, a, x_steps = seq(-0.02, 0.02, 0.01), y_steps = seq(-0.01, 0.01, 0.005),
                           basis = "fc") {
  fam <- a$family
  ke <- cost_of_equity(a$rf, a$beta, a$mrp)
  if (fam == "industrial") {
    w0 <- wacc_calc(ke, a$cost_of_debt, a$tax_rate, a$debt_weight)
    proj <- project_industrial(a)
    if (is.null(proj)) return(NULL)
    xs <- w0 + x_steps; ys <- a$terminal_growth + y_steps
    m <- outer(xs, ys, Vectorize(function(w, g) { d <- run_dcf(a, wacc_override = w, tg_override = g, proj = proj); if (is.null(d)) NA_real_ else d$per_share }))
    list(x = xs, y = ys, matrix = m, x_label = "WACC", y_label = "Terminal growth", method = "FCFF DCF value per share")
  } else {
    proj <- project_financial(a)
    if (is.null(proj)) return(NULL)
    xs <- ke + x_steps; ys <- a$terminal_growth + y_steps
    m <- outer(xs, ys, Vectorize(function(k, g) { d <- run_ddm(a, proj, ke_override = k, g_override = g); if (is.null(d)) NA_real_ else if (basis == "fc") d$value_fc else d$value_ex }))
    list(x = xs, y = ys, matrix = m, x_label = "Cost of equity", y_label = "Terminal growth",
         method = paste0("Dividend discount value per share (", if (basis == "fc") "incl." else "excl.", " franking)"))
  }
}

# --- Football field ----------------------------------------------------------------------
football_field <- function(bd, v, scen = NULL, sens_ke = NULL) {
  basis <- v$headline_basis
  pick <- function(x_ex, x_fc) if (basis == "fc") x_fc else x_ex
  rows <- list()
  q <- bd$quote
  rows[[length(rows) + 1]] <- tibble::tibble(method = "52-week trading range", low = n1(q$week52_low), base = n1(q$price), high = n1(q$week52_high))
  m <- v$methods
  for (i in seq_len(nrow(m))) {
    if (!m$available[i]) next
    base <- pick(m$value_ex[i], m$value_fc[i])
    lo <- m$low[i]; hi <- m$high[i]
    if (m$method[i] %in% c("dcf", "ddm", "rim") && !is.null(sens_ke) && nrow(sens_ke) > 0) {
      # intrinsic methods: +/- 100bp cost of equity band from the 1-D sensitivity
      vals <- pick(sens_ke$value_ex, sens_ke$value_fc)
      band <- vals[abs(sens_ke$delta) <= 0.0101]
      ratio <- band / pick(sens_ke$value_ex, sens_ke$value_fc)[which.min(abs(sens_ke$delta))]
      ratio <- ratio[is.finite(ratio)]
      if (length(ratio)) { lo <- base * min(ratio); hi <- base * max(ratio) }
    }
    if (is.na(lo)) lo <- base * 0.9; if (is.na(hi)) hi <- base * 1.1
    rows[[length(rows) + 1]] <- tibble::tibble(method = m$label[i], low = min(lo, base), base = base, high = max(hi, base))
  }
  if (!is.null(scen) && nrow(scen) > 1) {
    s <- scen[scen$scenario != "Probability-weighted", ]
    vals <- pick(s$value_ex, s$value_fc); vals <- vals[is.finite(vals)]
    if (length(vals)) rows[[length(rows) + 1]] <- tibble::tibble(method = "Scenario range (bear – bull)", low = min(vals),
                                               base = pick(scen$value_ex[nrow(scen)], scen$value_fc[nrow(scen)]), high = max(vals))
  }
  rows[[length(rows) + 1]] <- tibble::tibble(method = "Weighted fair value", low = v$weighted_value, base = v$weighted_value, high = v$weighted_value)
  out <- dplyr::bind_rows(rows)
  out[!is.na(out$base), ]
}
