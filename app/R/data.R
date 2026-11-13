# ===========================================================================
# Data layer — Yahoo Finance via yahoofinancer, with batching, caching,
# statement normalisation and derived series.
#
# Design rules
#   * Every network call is wrapped: a failure returns NULL and the caller
#     degrades the affected panel, never the session.
#   * Batch endpoints (yf_get_market_stats, yf_get_financials,
#     yf_download_prices) are preferred: one HTTP call per statement type for
#     any number of tickers, and they expose more line items than Ticker$...
#   * Results are cached app-wide (cachem) so repeat loads and peer sets are
#     instant within a session and shared across sessions on the same process.
# ===========================================================================

# --- Caches -------------------------------------------------------------------
# Quotes and metadata stay in memory (they change intraday); fundamentals and
# prices persist to disk so restarting the app does not re-download the market.
.cache_quotes <- cachem::cache_mem(max_size = 50 * 1024^2, max_age = 10 * 60)
.cache_meta   <- cachem::cache_mem(max_size = 50 * 1024^2, max_age = 15 * 60)

.cache_dir <- tryCatch(tools::R_user_dir("mbs-sif", "cache"), error = function(e) file.path(tempdir(), "mbs-sif-cache"))
.cache_fund <- tryCatch({
  dir.create(file.path(.cache_dir, "fundamentals"), recursive = TRUE, showWarnings = FALSE)
  cachem::cache_disk(file.path(.cache_dir, "fundamentals"), max_size = 500 * 1024^2, max_age = 12 * 3600)
}, error = function(e) cachem::cache_mem(max_size = 300 * 1024^2, max_age = 12 * 3600))

.cache_px <- tryCatch({
  dir.create(file.path(.cache_dir, "prices"), recursive = TRUE, showWarnings = FALSE)
  cachem::cache_disk(file.path(.cache_dir, "prices"), max_size = 500 * 1024^2, max_age = 60 * 60)
}, error = function(e) cachem::cache_mem(max_size = 300 * 1024^2, max_age = 30 * 60))

cache_key <- function(...) {
  raw <- paste(..., sep = "|")
  paste0(gsub("[^a-z0-9]", "_", tolower(substr(raw, 1, 60))), "_", rlang::hash(raw))
}

cache_get <- function(cache, key) {
  v <- cache$get(key)
  if (cachem::is.key_missing(v)) NULL else v
}

cache_clear_all <- function() {
  .cache_quotes$reset(); .cache_fund$reset(); .cache_px$reset(); .cache_meta$reset()
  invisible(TRUE)
}

safely_run <- function(expr) tryCatch(expr, error = function(e) NULL, warning = function(w) {
  # yahoofinancer signals per-ticker failures as warnings; keep partial results
  suppressWarnings(tryCatch(withCallingHandlers(expr, warning = function(w2) invokeRestart("muffleWarning")),
                            error = function(e) NULL))
})

quiet <- function(expr) suppressWarnings(suppressMessages(expr))

# --- Quotes (batch) -----------------------------------------------------------
# Returns tibble(symbol, price, previous_close, change, change_pct, week52_high,
#                week52_low, volume, currency)
fetch_quotes <- function(symbols) {
  symbols <- unique(symbols[nzchar(symbols)])
  if (length(symbols) == 0) return(NULL)
  out <- list(); todo <- character(0)
  for (s in symbols) {
    v <- cache_get(.cache_quotes, cache_key("q", s))
    if (is.null(v)) todo <- c(todo, s) else out[[s]] <- v
  }
  if (length(todo) > 0) {
    # yahoofinancer's batch call drops failed tickers with a warning
    res <- quiet(tryCatch(as.data.frame(yahoofinancer::yf_get_market_stats(todo)),
                          error = function(e) NULL))
    if (!is.null(res) && nrow(res) > 0) {
      for (i in seq_len(nrow(res))) {
        s <- res$symbol[i]
        price <- n1(res$regular_market_price[i]); prev <- n1(res$previous_close[i])
        v <- tibble::tibble(
          symbol = s, price = price, previous_close = prev,
          change = price - prev,
          change_pct = if (!is.na(prev) && prev != 0) price / prev - 1 else NA_real_,
          week52_high = n1(res$fifty_two_week_high[i]),
          week52_low  = n1(res$fifty_two_week_low[i]),
          volume = n1(res$regular_market_volume[i]),
          currency = as.character(res$currency[i] %||% NA_character_)
        )
        .cache_quotes$set(cache_key("q", s), v)
        out[[s]] <- v
      }
    }
  }
  if (length(out) == 0) return(NULL)
  dplyr::bind_rows(out[intersect(symbols, names(out))])
}

# --- Company description (Yahoo quoteSummary > summaryProfile.longBusinessSummary) ----
# quoteSummary is crumb-gated: we do the cookie + crumb handshake and degrade to
# an empty string when Yahoo throttles or the module is absent. Cached alongside
# metadata so a failed fetch is not retried on every load within the window.
fetch_company_summary <- function(symbol) {
  key <- cache_key("summary", symbol)
  v <- cache_get(.cache_meta, key)
  if (!is.null(v)) return(v$summary %||% character(0))
  ua <- "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  out <- quiet(tryCatch({
    h <- httr::handle("https://finance.yahoo.com")
    httr::GET("https://finance.yahoo.com/quote/", httr::user_agent(ua), httr::timeout(8), handle = h)
    crumb <- httr::content(httr::GET("https://query2.finance.yahoo.com/v1/test/getcrumb",
                                     httr::user_agent(ua), httr::timeout(8), handle = h),
                           as = "text", encoding = "UTF-8")
    if (length(crumb) == 0 || grepl("Too Many|Unauthorized|Forbidden|Error", crumb, ignore.case = TRUE)) return(character(0))
    url <- paste0("https://query2.finance.yahoo.com/v10/finance/quoteSummary/",
                  utils::URLencode(symbol, reserved = TRUE),
                  "?modules=summaryProfile&crumb=", utils::URLencode(crumb, reserved = TRUE))
    res <- httr::GET(url, httr::user_agent(ua), httr::timeout(10), handle = h)
    if (res$status_code != 200) return(character(0))
    j <- jsonlite::fromJSON(httr::content(res, as = "text", encoding = "UTF-8"), simplifyVector = TRUE)
    s <- j$finance$result[[1]]$summaryProfile$longBusinessSummary
    if (is.null(s) || !nzchar(as.character(s))) character(0) else as.character(s)
  }, error = function(e) character(0)))
  if (is.null(out)) out <- character(0)
  .cache_meta$set(key, list(summary = out))
  out
}

# --- Ticker metadata (one Ticker$new call: exchange, news, related) ----------
fetch_ticker_meta <- function(symbol) {
  key <- cache_key("meta", symbol)
  v <- cache_get(.cache_meta, key)
  if (!is.null(v)) return(v)
  t <- quiet(tryCatch(yahoofinancer::Ticker$new(symbol), error = function(e) NULL))
  if (is.null(t)) return(NULL)
  g <- function(expr) quiet(tryCatch(expr, error = function(e) NULL))
  ti <- g(t$technical_insights)
  news <- g({
    if (!is.null(ti$sigDevs) && length(ti$sigDevs) > 0) {
      purrr::map_dfr(ti$sigDevs, ~ tibble::tibble(date = as.character(.x$date %||% ""),
                                                  headline = as.character(.x$headline %||% "")))
    } else tibble::tibble(date = character(0), headline = character(0))
  })
  related <- g({ rec <- t$recommendations; if (!is.null(rec)) tibble::as_tibble(rec) else NULL })
  yname <- g(ti$upsell$companyName)
  if (!is.null(yname)) {
    yname <- sub("\\s+FPO.*$", "", yname); yname <- sub("\\s*\\[.*\\]$", "", yname)
    yname <- stringr::str_to_title(tolower(yname))
  }
  mt <- g(t$regular_market_time)
  v <- list(
    symbol = symbol,
    exchange = g(t$exchange_name), full_exchange_name = g(t$full_exchange_name),
    timezone = g(t$exchange_timezone_name),
    first_trade_date = g(as.Date(t$first_trade_date)),
    market_time = mt,
    day_high = n1(g(t$regular_market_day_high)), day_low = n1(g(t$regular_market_day_low)),
    yahoo_name = yname,
    news = news %||% tibble::tibble(date = character(0), headline = character(0)),
    related = related,
    summary = fetch_company_summary(symbol)
  )
  .cache_meta$set(key, v)
  v
}

# --- Financial statements (batch, per statement type) -------------------------
.statement_types <- c(income = "income", balance = "balance-sheet", cashflow = "cash-flow")

fetch_statements_batch <- function(symbols) {
  symbols <- unique(symbols[nzchar(symbols)])
  out <- list()
  for (nm in names(.statement_types)) {
    parts <- list(); todo <- character(0)
    for (s in symbols) {
      v <- cache_get(.cache_fund, cache_key("st", nm, s))
      if (is.null(v)) todo <- c(todo, s) else parts[[s]] <- v
    }
    if (length(todo) > 0) {
      res <- quiet(tryCatch(as.data.frame(yahoofinancer::yf_get_financials(
        todo, statement_type = .statement_types[[nm]], frequency = "annual")),
        error = function(e) NULL))
      if (!is.null(res) && nrow(res) > 0 && "symbol" %in% names(res)) {
        for (s in unique(res$symbol)) {
          v <- tidy_statement(res[res$symbol == s, , drop = FALSE])
          .cache_fund$set(cache_key("st", nm, s), v)
          parts[[s]] <- v
        }
      }
      # Mark genuinely missing tickers so we do not re-query them every time
      for (s in setdiff(todo, names(parts))) .cache_fund$set(cache_key("st", nm, s), tibble::tibble())
    }
    out[[nm]] <- dplyr::bind_rows(parts)
  }
  out
}

# Normalise one statement frame: Date column, FY, numeric, drop empty years.
tidy_statement <- function(df) {
  if (is.null(df) || nrow(df) == 0) return(tibble::tibble())
  df <- tibble::as_tibble(df)
  df$period_type <- NULL
  df$date <- as.Date(df$date)
  num_cols <- setdiff(names(df), c("symbol", "date"))
  for (c in num_cols) df[[c]] <- suppressWarnings(as.numeric(df[[c]]))
  keep <- rowSums(!is.na(df[, num_cols, drop = FALSE])) > 0 & !is.na(df$date)
  df <- df[keep, , drop = FALSE]
  df$fy <- as.integer(format(df$date, "%Y"))
  df <- df[order(df$date), ]
  # One row per fiscal year (keep the most complete)
  df$n_ok <- rowSums(!is.na(df[, num_cols, drop = FALSE]))
  df <- df[order(df$fy, -df$n_ok), ]
  df <- df[!duplicated(df$fy), ]
  df$n_ok <- NULL
  df[order(df$date), ]
}

statements_for <- function(st, symbol) {
  pick <- function(x) if (is.null(x) || nrow(x) == 0 || !"symbol" %in% names(x)) tibble::tibble() else x[x$symbol == symbol, , drop = FALSE]
  list(income = pick(st$income), balance = pick(st$balance), cashflow = pick(st$cashflow))
}

# How many fiscal years of statements a lookback period should keep. Yahoo's
# free API only publishes ~4-5 annual statements for ASX names, so longer
# periods simply return everything available.
period_fiscal_years <- function(period) {
  switch(period %||% "5y",
    `6mo` = 1L, `ytd` = 1L, `1y` = 1L, `2y` = 2L, `5y` = 5L, `10y` = 10L, `max` = Inf,
    5L)
}

# Trim each statement frame to the most recent N fiscal years (one row per FY).
filter_statements_period <- function(st, period) {
  n <- period_fiscal_years(period)
  if (is.infinite(n)) return(st)
  lapply(st, function(df) {
    if (is.null(df) || nrow(df) == 0) return(df)
    df <- df[order(df$date, decreasing = TRUE), , drop = FALSE]
    df[seq_len(min(n, nrow(df))), , drop = FALSE]
  })
}

# --- Prices (batch) -----------------------------------------------------------
# Long tibble: symbol, date, open, high, low, close, adj_close, volume
fetch_prices <- function(symbols, period = "5y", interval = "1d") {
  symbols <- unique(symbols[nzchar(symbols)])
  if (length(symbols) == 0) return(NULL)
  parts <- list(); todo <- character(0)
  for (s in symbols) {
    v <- cache_get(.cache_px, cache_key("px", s, period, interval))
    if (is.null(v)) todo <- c(todo, s) else parts[[s]] <- v
  }
  if (length(todo) > 0) {
    res <- quiet(tryCatch(as.data.frame(yahoofinancer::yf_download_prices(
      todo, period = period, interval = interval)), error = function(e) NULL))
    if (!is.null(res) && nrow(res) > 0 && "symbol" %in% names(res)) {
      for (s in unique(res$symbol)) {
        v <- tidy_prices(res[res$symbol == s, , drop = FALSE])
        .cache_px$set(cache_key("px", s, period, interval), v)
        parts[[s]] <- v
      }
    }
  }
  if (length(parts) == 0) return(NULL)
  dplyr::bind_rows(parts[intersect(symbols, names(parts))])
}

tidy_prices <- function(df) {
  df <- tibble::as_tibble(df)
  tz <- "Australia/Sydney"
  d <- df$date
  df$date <- if (inherits(d, "POSIXt")) as.Date(format(d, tz = tz, "%Y-%m-%d")) else as.Date(d)
  for (c in c("open", "high", "low", "close", "adj_close", "volume"))
    if (c %in% names(df)) df[[c]] <- suppressWarnings(as.numeric(df[[c]]))
  df <- df[!is.na(df$close), ]
  df <- df[order(df$date), ]
  df <- df[!duplicated(df$date, fromLast = TRUE), ]
  if (!"adj_close" %in% names(df) || all(is.na(df$adj_close))) df$adj_close <- df$close
  df$adj_close[is.na(df$adj_close)] <- df$close[is.na(df$adj_close)]
  df
}

prices_for <- function(px, symbol) {
  if (is.null(px) || nrow(px) == 0) return(NULL)
  out <- px[px$symbol == symbol, , drop = FALSE]
  if (nrow(out) < 2) NULL else out
}

# --- Dividends inferred from the adjusted-close series -------------------------
# Yahoo scales adj_close before each ex-date by (1 - D / P_prev). The ratio
# adj_close / close therefore steps up on each ex-dividend day; the step size
# recovers the cash dividend per share.
infer_dividends <- function(history) {
  if (is.null(history) || nrow(history) < 3) return(tibble::tibble(ex_date = as.Date(character(0)), dps = numeric(0)))
  h <- history[order(history$date), ]
  r <- h$adj_close / h$close
  r_prev <- dplyr::lag(r)
  jump <- r / r_prev
  idx <- which(!is.na(jump) & jump > 1.0005 & jump < 1.25)
  if (length(idx) == 0) return(tibble::tibble(ex_date = as.Date(character(0)), dps = numeric(0)))
  dps <- h$close[idx - 1] * (1 - r_prev[idx] / r[idx])
  tibble::tibble(ex_date = h$date[idx], dps = round(dps, 4)) %>%
    dplyr::filter(dps > 0) %>% dplyr::arrange(dplyr::desc(ex_date))
}

ttm_dividends <- function(divs, asof = Sys.Date()) {
  if (is.null(divs) || nrow(divs) == 0) return(NA_real_)
  d <- divs[divs$ex_date > asof - 366 & divs$ex_date <= asof, ]
  if (nrow(d) == 0) NA_real_ else sum(d$dps)
}

# --- Canonical financial history ------------------------------------------------
# One row per fiscal year with a stable set of line items regardless of what
# Yahoo returned, plus derived margins, returns, growth and per-share data.
col_or_na <- function(df, name) if (!is.null(df) && name %in% names(df)) df[[name]] else rep(NA_real_, NROW(df))

build_fin <- function(st) {
  inc <- st$income; bal <- st$balance; cf <- st$cashflow
  if ((is.null(inc) || nrow(inc) == 0) && (is.null(bal) || nrow(bal) == 0)) return(NULL)

  years <- sort(unique(c(inc$fy, bal$fy, cf$fy)))
  years <- years[!is.na(years)]
  pick <- function(df, col, fy) {
    if (is.null(df) || nrow(df) == 0 || !col %in% names(df)) return(NA_real_)
    v <- df[[col]][match(fy, df$fy)]
    if (length(v) == 0) NA_real_ else as.numeric(v)
  }
  date_for <- function(fy) {
    d <- c(inc$date[match(fy, inc$fy)], bal$date[match(fy, bal$fy)], cf$date[match(fy, cf$fy)])
    d <- d[!is.na(d)]
    if (length(d) == 0) as.Date(paste0(fy, "-06-30")) else as.Date(d[1])
  }

  fin <- tibble::tibble(fy = years, date = as.Date(vapply(years, function(y) as.character(date_for(y)), character(1))))
  fin$label <- paste0("FY", substr(as.character(fin$fy), 3, 4))
  # Drop phantom fiscal years (Yahoo sometimes emits a year carrying one field)
  core_ok <- (!is.na(pick(inc, "total_revenue", years))) + (!is.na(pick(inc, "net_income", years))) +
             (!is.na(pick(bal, "total_assets", years))) + (!is.na(pick(cf, "operating_cash_flow", years)))
  keep <- core_ok >= 2
  years <- years[keep]; fin <- fin[keep, ]
  if (nrow(fin) == 0) return(NULL)

  # Income statement
  fin$revenue            <- dplyr::coalesce(pick(inc, "total_revenue", years), pick(inc, "operating_revenue", years))
  fin$cost_of_revenue    <- pick(inc, "cost_of_revenue", years)
  fin$gross_profit       <- pick(inc, "gross_profit", years)
  fin$operating_expense  <- pick(inc, "operating_expense", years)
  fin$operating_income   <- pick(inc, "operating_income", years)
  fin$ebitda             <- dplyr::coalesce(pick(inc, "ebitda", years), pick(inc, "normalized_ebitda", years))
  fin$ebit               <- pick(inc, "ebit", years)
  fin$interest_net       <- pick(inc, "net_non_operating_interest_income_expense", years)
  fin$other_income       <- pick(inc, "other_income_expense", years)
  fin$pretax_income      <- pick(inc, "pretax_income", years)
  fin$tax                <- pick(inc, "tax_provision", years)
  fin$net_income         <- pick(inc, "net_income", years)
  fin$net_income_cont    <- pick(inc, "net_income_continuous_operations", years)
  fin$normalised_income  <- pick(inc, "normalized_income", years)
  fin$eps                <- dplyr::coalesce(pick(inc, "diluted_eps", years), pick(inc, "basic_eps", years))
  fin$eps_basic          <- pick(inc, "basic_eps", years)
  fin$shares             <- dplyr::coalesce(pick(inc, "diluted_average_shares", years), pick(inc, "basic_average_shares", years))
  fin$shares_basic       <- pick(inc, "basic_average_shares", years)

  # Balance sheet
  fin$total_assets       <- pick(bal, "total_assets", years)
  fin$cash               <- pick(bal, "cash_and_cash_equivalents", years)
  fin$st_investments     <- pick(bal, "other_short_term_investments", years)
  fin$receivables        <- pick(bal, "receivables", years)
  fin$net_ppe            <- pick(bal, "net_ppe", years)
  fin$goodwill_intang    <- pick(bal, "goodwill_and_other_intangible_assets", years)
  fin$total_liabilities  <- pick(bal, "total_liabilities_net_minority_interest", years)
  fin$payables           <- pick(bal, "payables_and_accrued_expenses", years)
  fin$current_debt       <- pick(bal, "current_debt", years)
  fin$long_term_debt     <- pick(bal, "long_term_debt", years)
  fin$total_debt         <- pick(bal, "total_debt", years)
  fin$net_debt           <- pick(bal, "net_debt", years)
  fin$common_stock       <- pick(bal, "common_stock", years)
  fin$retained_earnings  <- pick(bal, "retained_earnings", years)
  fin$invested_capital   <- pick(bal, "invested_capital", years)
  eq1 <- fin$total_assets - fin$total_liabilities
  eq2 <- fin$common_stock + fin$retained_earnings
  fin$equity             <- dplyr::coalesce(eq1, eq2)

  # Cash flow
  fin$ocf                <- dplyr::coalesce(pick(cf, "operating_cash_flow", years), pick(cf, "cash_flow_from_continuing_operating_activities", years))
  fin$da                 <- pick(cf, "depreciation_and_amortization", years)
  fin$change_nwc         <- pick(cf, "change_in_working_capital", years)
  fin$investing_cf       <- pick(cf, "investing_cash_flow", years)
  fin$capex              <- abs(dplyr::coalesce(pick(cf, "capital_expenditure", years), pick(cf, "net_ppe_purchase_and_sale", years)))
  fin$financing_cf       <- pick(cf, "financing_cash_flow", years)
  fin$dividends_paid     <- abs(pick(cf, "cash_dividends_paid", years))
  fin$fcf                <- pick(cf, "free_cash_flow", years)
  fin$end_cash           <- pick(cf, "end_cash_position", years)
  fin$begin_cash         <- pick(cf, "beginning_cash_position", years)

  # Fallbacks for key aggregates
  fin$total_debt <- dplyr::coalesce(fin$total_debt, fin$current_debt + fin$long_term_debt)
  fin$net_debt   <- dplyr::coalesce(fin$net_debt, fin$total_debt - dplyr::coalesce(fin$cash, 0) - dplyr::coalesce(fin$st_investments, 0))
  fin$ebit       <- dplyr::coalesce(fin$ebit, fin$operating_income, fin$pretax_income - dplyr::coalesce(fin$interest_net, 0))
  fin$ebitda     <- dplyr::coalesce(fin$ebitda, fin$ebit + dplyr::coalesce(fin$da, 0))
  fin$fcf        <- dplyr::coalesce(fin$fcf, fin$ocf - dplyr::coalesce(fin$capex, 0))
  fin$gross_profit <- dplyr::coalesce(fin$gross_profit, fin$revenue - fin$cost_of_revenue)
  fin$cash_total <- dplyr::coalesce(fin$cash, 0) + dplyr::coalesce(fin$st_investments, 0)
  fin$cash_total[is.na(fin$cash) & is.na(fin$st_investments)] <- NA_real_

  # Per share
  fin$dps        <- safe_div(fin$dividends_paid, fin$shares)
  fin$bvps       <- safe_div(fin$equity, fin$shares)
  fin$tbvps      <- safe_div(fin$equity - dplyr::coalesce(fin$goodwill_intang, 0), fin$shares)
  fin$ocf_ps     <- safe_div(fin$ocf, fin$shares)
  fin$fcf_ps     <- safe_div(fin$fcf, fin$shares)
  fin$payout     <- safe_div(fin$dividends_paid, fin$net_income)
  fin$dividend_cover <- safe_div(fin$net_income, fin$dividends_paid)

  # Margins & returns
  fin$gross_margin  <- safe_div(fin$gross_profit, fin$revenue)
  fin$ebitda_margin <- safe_div(fin$ebitda, fin$revenue)
  fin$ebit_margin   <- safe_div(fin$ebit, fin$revenue)
  fin$pretax_margin <- safe_div(fin$pretax_income, fin$revenue)
  fin$net_margin    <- safe_div(fin$net_income, fin$revenue)
  fin$fcf_margin    <- safe_div(fin$fcf, fin$revenue)
  fin$tax_rate_eff  <- safe_div(fin$tax, fin$pretax_income)
  avg <- function(x) { p <- dplyr::lag(x); ifelse(is.na(p), x, (x + p) / 2) }
  fin$roe           <- safe_div(fin$net_income, avg(fin$equity))
  fin$roa           <- safe_div(fin$net_income, avg(fin$total_assets))
  nopat             <- fin$ebit * (1 - clamp_vec(fin$tax_rate_eff, 0, 0.5, 0.30))
  fin$nopat         <- nopat
  fin$roic          <- safe_div(nopat, avg(dplyr::coalesce(fin$invested_capital, fin$equity + fin$net_debt)))
  fin$asset_turnover <- safe_div(fin$revenue, avg(fin$total_assets))
  fin$leverage      <- safe_div(avg(fin$total_assets), avg(fin$equity))   # DuPont equity multiplier
  fin$equity_assets <- safe_div(fin$equity, fin$total_assets)
  fin$debt_equity   <- safe_div(fin$total_debt, fin$equity)
  fin$net_debt_ebitda <- safe_div(fin$net_debt, fin$ebitda)
  fin$net_debt_ebitda[!is.na(fin$ebitda) & fin$ebitda <= 0] <- NA_real_
  fin$interest_coverage <- ifelse(!is.na(fin$interest_net) & fin$interest_net < 0, safe_div(fin$ebit, -fin$interest_net), NA_real_)
  fin$cash_conversion <- safe_div(fin$ocf, fin$net_income)
  fin$fcf_conversion  <- safe_div(fin$fcf, fin$net_income)
  fin$capex_revenue   <- safe_div(fin$capex, fin$revenue)
  fin$da_revenue      <- safe_div(fin$da, fin$revenue)
  fin$capex_da        <- safe_div(fin$capex, fin$da)
  fin$nwc_revenue     <- safe_div(dplyr::coalesce(fin$receivables, 0) - dplyr::coalesce(fin$payables, 0), fin$revenue)

  # Growth (YoY)
  g <- function(x) { p <- dplyr::lag(x); out <- x / p - 1; out[is.na(p) | p <= 0] <- NA_real_; out }
  fin$revenue_growth <- g(fin$revenue)
  fin$ebitda_growth  <- g(fin$ebitda)
  fin$ebit_growth    <- g(fin$ebit)
  fin$ni_growth      <- g(fin$net_income)
  fin$eps_growth     <- g(fin$eps)
  fin$dps_growth     <- g(fin$dps)
  fin$bvps_growth    <- g(fin$bvps)
  fin$assets_growth  <- g(fin$total_assets)
  fin
}

clamp_vec <- function(x, lo, hi, default) {
  x[is.na(x)] <- default
  pmax(lo, pmin(hi, x))
}

# Latest-year snapshot combined with the live quote => one-row ratios tibble.
latest_snapshot <- function(symbol, fin, quote, divs = NULL, info = NULL) {
  if (is.null(fin) || nrow(fin) == 0) return(NULL)
  L <- fin[nrow(fin), ]
  P <- if (nrow(fin) > 1) fin[nrow(fin) - 1, ] else L
  price <- n1(quote$price)
  shares <- n1(L$shares)
  mcap <- price * shares
  net_debt <- n1(L$net_debt); if (is.na(net_debt)) net_debt <- 0
  ev <- mcap + net_debt
  dps_ttm <- ttm_dividends(divs)
  dps_use <- if (!is.na(dps_ttm) && dps_ttm > 0) dps_ttm else n1(L$dps)
  eps <- n1(L$eps)
  bvps <- n1(L$bvps)
  tbvps <- n1(L$tbvps)
  nyrs <- nrow(fin)
  ok <- function(...) all(vapply(list(...), function(x) length(x) == 1 && !is.na(x), logical(1)))
  cg <- function(col) {
    v <- fin[[col]]; ok <- which(!is.na(v))
    if (length(ok) < 2) return(NA_real_)
    cagr(v[c(ok[1], ok[length(ok)])], years = fin$fy[ok[length(ok)]] - fin$fy[ok[1]])
  }
  span_years <- if (nyrs > 1) max(fin$fy) - min(fin$fy) else 0
  pe <- if (ok(eps, price) && eps > 0) price / eps else NA_real_
  eps_cagr <- cg("eps")

  tibble::tibble(
    ticker = symbol, code = code_from_symbol(symbol),
    name = info$name %||% code_from_symbol(symbol),
    sector = info$sector %||% NA_character_, industry = info$industry %||% NA_character_,
    fy = L$fy, fy_label = L$label, period_end = L$date, n_years = nyrs,
    price = price, shares_out = shares, market_cap = mcap, enterprise_value = ev,
    net_debt = net_debt, total_debt = n1(L$total_debt), cash = n1(L$cash_total),
    revenue = n1(L$revenue), ebitda = n1(L$ebitda), ebit = n1(L$ebit),
    pretax_income = n1(L$pretax_income), net_income = n1(L$net_income),
    normalised_income = n1(L$normalised_income),
    eps = eps, dps = dps_use, dps_reported = n1(L$dps), dps_ttm = dps_ttm,
    bvps = bvps, tbvps = tbvps, equity = n1(L$equity), total_assets = n1(L$total_assets),
    goodwill_intang = n1(L$goodwill_intang),
    ocf = n1(L$ocf), capex = n1(L$capex), fcf = n1(L$fcf), da = n1(L$da),
    dividends_paid = n1(L$dividends_paid),
    pe_ratio = pe,
    forward_pe = NA_real_,
    pb_ratio = if (ok(bvps, price) && bvps > 0) price / bvps else NA_real_,
    p_tbv = if (ok(tbvps, price) && tbvps > 0) price / tbvps else NA_real_,
    ev_revenue = if (ok(L$revenue, ev) && L$revenue > 0) ev / L$revenue else NA_real_,
    ev_ebitda = if (ok(L$ebitda, ev) && L$ebitda > 0) ev / L$ebitda else NA_real_,
    ev_ebit = if (ok(L$ebit, ev) && L$ebit > 0) ev / L$ebit else NA_real_,
    ps_ratio = if (ok(L$revenue, mcap) && L$revenue > 0) mcap / L$revenue else NA_real_,
    earnings_yield = if (ok(eps, price) && price > 0) eps / price else NA_real_,
    dividend_yield = if (ok(dps_use, price) && price > 0) dps_use / price else NA_real_,
    grossed_yield = if (ok(dps_use, price) && price > 0) dps_use / price / 0.7 else NA_real_,
    fcf_yield = if (ok(L$fcf, mcap) && mcap > 0) L$fcf / mcap else NA_real_,
    ocf_yield = if (ok(L$ocf, mcap) && mcap > 0) L$ocf / mcap else NA_real_,
    peg = if (ok(pe, eps_cagr) && eps_cagr > 0) pe / (eps_cagr * 100) else NA_real_,
    payout = n1(L$payout), dividend_cover = n1(L$dividend_cover),
    roe = n1(L$roe), roa = n1(L$roa), roic = n1(L$roic),
    roe_prior = n1(P$roe), roic_prior = n1(P$roic),
    gross_margin = n1(L$gross_margin), ebitda_margin = n1(L$ebitda_margin),
    ebit_margin = n1(L$ebit_margin), pretax_margin = n1(L$pretax_margin),
    net_margin = n1(L$net_margin), fcf_margin = n1(L$fcf_margin),
    tax_rate_eff = n1(L$tax_rate_eff),
    asset_turnover = n1(L$asset_turnover), leverage = n1(L$leverage),
    equity_assets = n1(L$equity_assets), debt_equity = n1(L$debt_equity),
    net_debt_ebitda = n1(L$net_debt_ebitda), interest_coverage = n1(L$interest_coverage),
    cash_conversion = n1(L$cash_conversion), fcf_conversion = n1(L$fcf_conversion),
    capex_revenue = n1(L$capex_revenue), da_revenue = n1(L$da_revenue),
    nwc_revenue = n1(L$nwc_revenue),
    revenue_growth = n1(L$revenue_growth), ni_growth = n1(L$ni_growth), eps_growth = n1(L$eps_growth),
    revenue_cagr = cg("revenue"), ebitda_cagr = cg("ebitda"), ebit_cagr = cg("ebit"),
    ni_cagr = cg("net_income"), eps_cagr = eps_cagr, dps_cagr = cg("dps"),
    ocf_cagr = cg("ocf"), fcf_cagr = cg("fcf"), bvps_cagr = cg("bvps"),
    cagr_years = span_years
  )
}

# --- Price analytics --------------------------------------------------------------
price_metrics <- function(history, bench = NULL, rf = 0.045) {
  if (is.null(history) || nrow(history) < 20) return(NULL)
  h <- history[order(history$date), ]
  px <- h$adj_close
  ret <- px[-1] / px[-length(px)] - 1
  n_days <- as.numeric(max(h$date) - min(h$date))
  years <- max(n_days / 365.25, 1 / 252)
  total_return <- px[length(px)] / px[1] - 1
  ann_return <- (1 + total_return)^(1 / years) - 1
  ann_vol <- stats::sd(ret) * sqrt(252)
  downside <- ret[ret < 0]
  down_vol <- if (length(downside) > 5) stats::sd(downside) * sqrt(252) else NA_real_
  dd <- px / cummax(px) - 1
  beta <- NA_real_; corr <- NA_real_; alpha <- NA_real_; bench_total <- NA_real_; bench_ann <- NA_real_; te <- NA_real_
  if (!is.null(bench) && nrow(bench) > 20) {
    b <- bench[order(bench$date), ]
    bp <- b$close
    bret <- tibble::tibble(date = b$date[-1], bret = bp[-1] / bp[-length(bp)] - 1)
    sret <- tibble::tibble(date = h$date[-1], sret = ret)
    j <- dplyr::inner_join(sret, bret, by = "date")
    if (nrow(j) > 30) {
      beta <- stats::cov(j$sret, j$bret) / stats::var(j$bret)
      corr <- stats::cor(j$sret, j$bret)
      bench_total <- bp[length(bp)] / bp[1] - 1
      bench_ann <- (1 + bench_total)^(1 / years) - 1
      alpha <- ann_return - (rf + beta * (bench_ann - rf))
      te <- stats::sd(j$sret - j$bret) * sqrt(252)
    }
  }
  list(
    total_return = total_return, ann_return = ann_return, ann_vol = ann_vol,
    downside_vol = down_vol,
    sharpe = if (ann_vol > 0) (ann_return - rf) / ann_vol else NA_real_,
    sortino = if (!is.na(down_vol) && down_vol > 0) (ann_return - rf) / down_vol else NA_real_,
    max_drawdown = min(dd), current_drawdown = dd[length(dd)],
    beta = beta, correlation = corr, alpha = alpha, tracking_error = te,
    bench_total_return = bench_total, bench_ann_return = bench_ann,
    excess_return = total_return - bench_total,
    best_day = max(ret), worst_day = min(ret),
    pct_up_days = mean(ret > 0),
    first_date = min(h$date), last_date = max(h$date), years = years,
    last_price = h$close[nrow(h)]
  )
}

# Trailing returns over standard windows vs the benchmark.
performance_table <- function(history, bench = NULL) {
  if (is.null(history) || nrow(history) < 5) return(NULL)
  h <- history[order(history$date), ]
  last <- max(h$date)
  windows <- list(`1 week` = 7, `1 month` = 30, `3 months` = 91, `6 months` = 182,
                  `YTD` = NA, `1 year` = 365, `2 years` = 730, `3 years` = 1095, `5 years` = 1826)
  ret_at <- function(df, col, days) {
    start <- if (is.na(days)) as.Date(paste0(format(last, "%Y"), "-01-01")) - 1 else last - days
    if (start < min(df$date) - 7) return(NA_real_)
    base <- df[df$date <= start, ]
    if (nrow(base) == 0) return(NA_real_)
    df[[col]][nrow(df)] / base[[col]][nrow(base)] - 1
  }
  out <- purrr::imap_dfr(windows, function(days, label) {
    s <- ret_at(h, "adj_close", days)
    b <- if (!is.null(bench)) ret_at(bench[order(bench$date), ], "close", days) else NA_real_
    tibble::tibble(period = label, stock = s, benchmark = b, relative = s - b)
  })
  out[!is.na(out$stock), ]
}

# Technical indicators (SMA / Bollinger / RSI / drawdown / rolling vol)
compute_technicals <- function(history) {
  if (is.null(history) || nrow(history) < 30) return(NULL)
  h <- history[order(history$date), ]
  n <- nrow(h)
  roll_mean <- function(x, k) if (n >= k) zoo::rollmeanr(x, k, fill = NA) else rep(NA_real_, n)
  roll_sd   <- function(x, k) if (n >= k) zoo::rollapplyr(x, k, stats::sd, fill = NA) else rep(NA_real_, n)
  h$sma20  <- roll_mean(h$close, 20)
  h$sma50  <- roll_mean(h$close, 50)
  h$sma100 <- roll_mean(h$close, 100)
  h$sma200 <- roll_mean(h$close, 200)
  sd20 <- roll_sd(h$close, 20)
  h$bb_upper <- h$sma20 + 2 * sd20
  h$bb_lower <- h$sma20 - 2 * sd20
  ret <- c(NA, h$close[-1] / h$close[-n] - 1)
  h$ret <- ret
  h$roll_vol60 <- roll_sd(ret, 60) * sqrt(252)
  h$drawdown <- h$adj_close / cummax(h$adj_close) - 1
  # RSI(14), Wilder smoothing
  delta <- c(NA, diff(h$close))
  gain <- ifelse(delta > 0, delta, 0); loss <- ifelse(delta < 0, -delta, 0)
  rsi <- rep(NA_real_, n)
  if (n > 15) {
    ag <- mean(gain[2:15]); al <- mean(loss[2:15])
    rsi[15] <- if (al == 0) 100 else 100 - 100 / (1 + ag / al)
    for (i in 16:n) {
      ag <- (ag * 13 + gain[i]) / 14; al <- (al * 13 + loss[i]) / 14
      rsi[i] <- if (al == 0) 100 else 100 - 100 / (1 + ag / al)
    }
  }
  h$rsi14 <- rsi
  h$vol_avg20 <- roll_mean(h$volume, 20)
  L <- h[n, ]
  hi52 <- max(h$close[h$date > L$date - 365]); lo52 <- min(h$close[h$date > L$date - 365])
  list(
    series = h,
    latest = list(
      close = L$close, sma20 = L$sma20, sma50 = L$sma50, sma200 = L$sma200,
      rsi14 = L$rsi14, roll_vol60 = L$roll_vol60, drawdown = L$drawdown,
      bb_upper = L$bb_upper, bb_lower = L$bb_lower,
      pct_vs_sma50 = L$close / L$sma50 - 1, pct_vs_sma200 = L$close / L$sma200 - 1,
      golden_cross = !is.na(L$sma50) && !is.na(L$sma200) && L$sma50 > L$sma200,
      hi52 = hi52, lo52 = lo52,
      pos52 = if (hi52 > lo52) (L$close - lo52) / (hi52 - lo52) else NA_real_,
      vol_vs_avg = L$volume / L$vol_avg20 - 1
    )
  )
}

# Rebase several price series to 100 at their common start.
rebase_long <- function(px, symbols = NULL, col = "adj_close") {
  if (is.null(px) || nrow(px) == 0) return(NULL)
  df <- if (!is.null(symbols)) px[px$symbol %in% symbols, ] else px
  start <- max(tapply(df$date, df$symbol, min))
  df <- df[df$date >= start, ]
  df %>% dplyr::group_by(symbol) %>% dplyr::arrange(date, .by_group = TRUE) %>%
    dplyr::mutate(indexed = .data[[col]] / dplyr::first(.data[[col]]) * 100) %>% dplyr::ungroup()
}

# --- Orchestration ---------------------------------------------------------------
# Load everything needed for one company. `progress` is an optional function(frac, msg).
load_company <- function(symbol, period = "5y", progress = NULL) {
  tick <- function(f, m) if (is.function(progress)) progress(f, m)
  info <- lookup_company(symbol)

  tick(0.05, "Quote")
  quote <- fetch_quotes(symbol)
  if (is.null(quote) || nrow(quote) == 0 || is.na(quote$price[1])) {
    return(list(ok = FALSE, symbol = symbol, info = info,
                error = paste0("Yahoo Finance returned no quote for ", symbol, ". Check the ticker (ASX codes need the .AX suffix).")))
  }
  quote <- as.list(quote[1, ])

  tick(0.15, "Company details & developments")
  meta <- fetch_ticker_meta(symbol)
  if (!info$in_universe && !is.null(meta$yahoo_name)) info$name <- meta$yahoo_name

  tick(0.35, "Financial statements")
  st_all <- fetch_statements_batch(symbol)
  st <- filter_statements_period(statements_for(st_all, symbol), period)
  fin <- build_fin(st)

  tick(0.65, "Price history & benchmark")
  sector_idx <- unname(sector_index_map[info$sector])
  px_syms <- c(symbol, "^AXJO", if (!is.na(sector_idx)) sector_idx)
  px <- fetch_prices(px_syms, period = period)
  history <- prices_for(px, symbol)
  bench <- prices_for(px, "^AXJO")
  sector_px <- if (!is.na(sector_idx)) prices_for(px, sector_idx) else NULL

  tick(0.85, "Analytics")
  divs <- infer_dividends(history)
  ratios <- latest_snapshot(symbol, fin, quote, divs, info)
  metrics <- price_metrics(history, bench)
  perf <- performance_table(history, bench)
  tech <- compute_technicals(history)

  tick(1, "Done")
  list(
    ok = TRUE, symbol = symbol, code = info$code, info = info, quote = quote, meta = meta,
    statements = st, fin = fin, ratios = ratios, history = history, bench = bench,
    sector_px = sector_px, sector_index = sector_idx, dividends = divs,
    metrics = metrics, perf = perf, tech = tech, period = period,
    loaded_at = Sys.time()
  )
}

# Load a set of comparables (ratios + 1y relative performance) in ~5 HTTP calls.
load_peer_set <- function(codes, include = NULL, period = "1y", progress = NULL) {
  tick <- function(f, m) if (is.function(progress)) progress(f, m)
  codes <- unique(toupper(trimws(codes)))
  codes <- codes[nzchar(codes)]
  symbols <- vapply(c(include, codes), normalise_ticker, character(1))
  symbols <- unique(symbols)
  if (length(symbols) == 0) return(NULL)

  tick(0.1, "Peer quotes")
  quotes <- fetch_quotes(symbols)
  tick(0.4, "Peer statements")
  st_all <- fetch_statements_batch(symbols)
  tick(0.75, "Peer price history")
  px <- fetch_prices(symbols, period = period)

  fins <- list()
  rows <- purrr::map(symbols, function(s) {
    q <- if (!is.null(quotes)) quotes[quotes$symbol == s, ] else NULL
    if (is.null(q) || nrow(q) == 0) return(NULL)
    fin <- build_fin(statements_for(st_all, s))
    if (is.null(fin)) return(NULL)
    fins[[s]] <<- fin
    h <- prices_for(px, s)
    r <- tryCatch(latest_snapshot(s, fin, as.list(q[1, ]), infer_dividends(h), lookup_company(s)), error = function(e) NULL)
    if (is.null(r)) return(NULL)
    r$return_1y <- if (!is.null(h) && nrow(h) > 2) h$adj_close[nrow(h)] / h$adj_close[1] - 1 else NA_real_
    r$week52_high <- q$week52_high[1]; r$week52_low <- q$week52_low[1]
    r$change_pct <- q$change_pct[1]
    r
  })
  tick(1, "Done")
  tbl <- dplyr::bind_rows(rows)
  if (nrow(tbl) == 0) return(NULL)
  list(table = tbl, prices = px, symbols = symbols, fins = fins)
}

# Benchmarks & FX quote board
load_benchmark_board <- function() {
  syms <- c(benchmark_indices$symbol, fx_pairs$symbol)
  q <- fetch_quotes(syms)
  if (is.null(q)) return(NULL)
  labels <- c(setNames(benchmark_indices$label, benchmark_indices$symbol),
              setNames(fx_pairs$label, fx_pairs$symbol))
  kinds <- c(setNames(benchmark_indices$kind, benchmark_indices$symbol),
             setNames(rep("FX", nrow(fx_pairs)), fx_pairs$symbol))
  q$label <- unname(labels[q$symbol]); q$kind <- unname(kinds[q$symbol])
  q$pos52 <- ifelse(!is.na(q$week52_high) & !is.na(q$week52_low) & q$week52_high > q$week52_low,
                    (q$price - q$week52_low) / (q$week52_high - q$week52_low), NA_real_)
  q[match(syms, q$symbol), ] %>% dplyr::filter(!is.na(symbol))
}
