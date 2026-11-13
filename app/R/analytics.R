# ===========================================================================
# Cross-sectional analytics — peer statistics, DuPont, common-size statements,
# screening and sector aggregation. Pure functions over the data layer.
# ===========================================================================

# DuPont decomposition by year: ROE = net margin x asset turnover x leverage
dupont_table <- function(fin) {
  if (is.null(fin) || nrow(fin) == 0) return(NULL)
  fin %>% dplyr::transmute(label, net_margin, asset_turnover, leverage,
                           roe_dupont = net_margin * asset_turnover * leverage, roe)
}

# Common-size income statement (% of revenue) and balance sheet (% of assets)
common_size <- function(fin, which = c("income", "balance")) {
  which <- match.arg(which)
  if (is.null(fin) || nrow(fin) == 0) return(NULL)
  if (which == "income") {
    items <- c(revenue = "Revenue", cost_of_revenue = "Cost of revenue", gross_profit = "Gross profit",
               operating_expense = "Operating expenses", ebitda = "EBITDA", da = "D&A", ebit = "EBIT",
               interest_net = "Net interest", pretax_income = "Pre-tax income", tax = "Tax", net_income = "Net income")
    base <- fin$revenue
  } else {
    items <- c(cash_total = "Cash & investments", receivables = "Receivables", net_ppe = "Net PP&E",
               goodwill_intang = "Goodwill & intangibles", total_assets = "Total assets",
               payables = "Payables", total_debt = "Total debt", total_liabilities = "Total liabilities",
               equity = "Shareholders' equity")
    base <- fin$total_assets
  }
  rows <- purrr::imap(items, function(lab, col) {
    v <- if (col %in% names(fin)) fin[[col]] / base else rep(NA_real_, nrow(fin))
    c(`Line item` = lab, setNames(as.list(v), fin$label))
  })
  dplyr::bind_rows(rows)
}

# Peer table with percentile ranks and medians (subject flagged)
peer_summary <- function(peers_tbl, subject_code) {
  if (is.null(peers_tbl) || nrow(peers_tbl) == 0) return(NULL)
  t <- peers_tbl %>% dplyr::mutate(is_subject = code == subject_code)
  t
}

peer_medians <- function(peers_tbl, cols) {
  if (is.null(peers_tbl) || nrow(peers_tbl) == 0) return(NULL)
  purrr::map_dfc(cols, function(c) {
    x <- peers_tbl[[c]]; x <- x[!is.na(x) & is.finite(x)]
    tibble::tibble(!!c := if (length(x)) stats::median(x) else NA_real_)
  })
}

# Percentile rank of the subject within its peer set for each metric (0-1).
peer_percentiles <- function(peers_tbl, subject_code, cols) {
  if (is.null(peers_tbl) || !subject_code %in% peers_tbl$code) return(NULL)
  purrr::map_dfr(cols, function(c) {
    x <- peers_tbl[[c]]; s <- x[peers_tbl$code == subject_code][1]
    x <- x[!is.na(x)]
    tibble::tibble(metric = c, value = s,
                   percentile = if (is.na(s) || length(x) < 2) NA_real_ else mean(x <= s),
                   peer_median = if (length(x)) stats::median(x) else NA_real_, n = length(x))
  })
}

# Screener: filter a ratios table by named ranges. `ranges` is a list(col = c(lo, hi)).
screen_table <- function(tbl, ranges = list(), sectors = NULL, industries = NULL) {
  if (is.null(tbl) || nrow(tbl) == 0) return(tbl)
  out <- tbl
  if (!is.null(sectors) && length(sectors)) out <- out[out$sector %in% sectors, ]
  if (!is.null(industries) && length(industries)) out <- out[out$industry %in% industries, ]
  for (c in names(ranges)) {
    rg <- ranges[[c]]
    if (!c %in% names(out) || is.null(rg) || length(rg) != 2) next
    x <- out[[c]]
    keep <- is.na(x) | (x >= rg[1] & x <= rg[2])
    out <- out[keep, ]
  }
  out
}

# Quality / value / momentum composite score (equal-weighted percentile ranks).
composite_scores <- function(tbl) {
  if (is.null(tbl) || nrow(tbl) < 2) return(tbl)
  pr <- function(x, higher_better = TRUE) {
    r <- rank(if (higher_better) x else -x, na.last = "keep")
    (r - 1) / (sum(!is.na(x)) - 1)
  }
  tbl %>% dplyr::mutate(
    score_quality = rowMeans(cbind(pr(roe), pr(net_margin), pr(cash_conversion)), na.rm = TRUE),
    score_value = rowMeans(cbind(pr(pe_ratio, FALSE), pr(pb_ratio, FALSE), pr(ev_ebitda, FALSE), pr(dividend_yield)), na.rm = TRUE),
    score_growth = rowMeans(cbind(pr(revenue_cagr), pr(eps_cagr)), na.rm = TRUE),
    score_momentum = pr(return_1y),
    score_total = rowMeans(cbind(score_quality, score_value, score_growth, score_momentum), na.rm = TRUE)
  )
}

# Closing price on or just before a date (NA if the history does not reach it)
price_at <- function(history, date) {
  if (is.null(history) || nrow(history) == 0 || is.na(date)) return(NA_real_)
  h <- history[history$date <= as.Date(date), ]
  if (nrow(h) == 0 || (as.Date(date) - max(h$date)) > 10) return(NA_real_)
  h$close[nrow(h)]
}
