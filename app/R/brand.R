# ===========================================================================
# MBS brand system — colour tokens, chart palette, bslib theme, formatters.
#
# Palette follows build_mbs_docx.py / build_sector_summary.py:
#   PRIMARY #A30046  DARK #5E0028  TINT #F2E3EA  BORDER #D9BFCB
#   GREY #595959     BLACK #212121
#
# Categorical chart palette was validated with the dataviz palette checker
# (adjacent-pair CVD dE >= 8, normal-vision dE >= 15, lightness + chroma bands).
# Slot 1 is always the subject company; benchmarks wear the de-emphasis grey.
# ===========================================================================

MBS <- list(
  primary  = "#A30046",
  dark     = "#5E0028",
  tint     = "#F2E3EA",
  tint2    = "#FAF3F6",
  border   = "#D9BFCB",
  grey     = "#595959",
  grey2    = "#8C8C8C",
  grey3    = "#C9C9C9",
  black    = "#212121",
  white    = "#FFFFFF",
  surface  = "#FBF9FA",
  accent   = "#8A0F3E",
  positive = "#1E7A46",
  negative = "#C0392B",
  warning  = "#B7791F"
)

MBS_FONT <- "Calibri"
MBS_FONT_STACK <- 'Calibri, Carlito, "Segoe UI", "Liberation Sans", Arial, sans-serif'

# Categorical slots (fixed order, never cycled past 8).
mbs_cat <- c("#A30046", "#eda100", "#2a78d6", "#eb6834",
             "#1baf7a", "#6250d6", "#e87ba4", "#008300")
mbs_bench_colour <- "#8C8C8C"

# One-hue sequential ramp built on the brand magenta (light -> dark).
mbs_seq <- function(n = 7) {
  grDevices::colorRampPalette(c("#F7E9EF", "#E3B3C6", "#C9739A", "#A30046", "#5E0028"))(n)
}
# Diverging ramp for signed quantities (downside red <- neutral -> upside blue).
mbs_div <- function(n = 11) {
  grDevices::colorRampPalette(c("#C0392B", "#E8A79F", "#F0EFEC", "#9BBFEA", "#2a78d6"))(n)
}

# Assign categorical colours to a vector of series names: the subject first.
series_colours <- function(names, subject = NULL, bench = "S&P/ASX 200") {
  names <- unique(as.character(names))
  cols <- character(0)
  slot <- 1L
  for (nm in names) {
    if (!is.null(bench) && nm %in% bench) {
      cols[nm] <- mbs_bench_colour
    } else if (!is.null(subject) && nm == subject) {
      cols[nm] <- mbs_cat[1]
    } else {
      slot <- slot + 1L
      cols[nm] <- mbs_cat[min(slot, length(mbs_cat))]
    }
  }
  cols
}

# ---------------------------------------------------------------------------
# bslib theme
# ---------------------------------------------------------------------------
mbs_bs_theme <- function() {
  bslib::bs_theme(
    version = 5,
    primary = MBS$primary,
    secondary = MBS$grey,
    success = MBS$positive,
    danger = MBS$negative,
    warning = MBS$warning,
    info = "#2a78d6",
    "body-bg" = MBS$surface,
    "body-color" = MBS$black,
    "font-family-sans-serif" = MBS_FONT_STACK,
    "font-size-base" = "0.9rem",
    "headings-font-weight" = 700,
    "border-radius" = "6px",
    "card-border-color" = MBS$border,
    "card-cap-bg" = MBS$white,
    "navbar-padding-y" = "0.35rem",
    "nav-link-font-weight" = 600,
    "table-striped-bg" = MBS$tint2,
    "input-border-color" = MBS$border,
    "link-color" = MBS$primary
  )
}

# ---------------------------------------------------------------------------
# ggplot2 theme (used by exports / static renders)
# ---------------------------------------------------------------------------
theme_mbs <- function(base_size = 12) {
  ggplot2::theme_minimal(base_size = base_size) +
    ggplot2::theme(
      text             = ggplot2::element_text(colour = MBS$black),
      plot.title       = ggplot2::element_text(face = "bold", colour = MBS$primary, size = base_size + 2),
      plot.subtitle    = ggplot2::element_text(colour = MBS$grey, size = base_size - 1),
      plot.caption     = ggplot2::element_text(colour = MBS$grey, size = base_size - 3),
      axis.title       = ggplot2::element_text(colour = MBS$grey, size = base_size - 1),
      axis.text        = ggplot2::element_text(colour = MBS$black),
      legend.position  = "bottom",
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major = ggplot2::element_line(colour = "#ECE3E8", linewidth = 0.3)
    )
}

# ---------------------------------------------------------------------------
# Formatting helpers. All are NA-safe and vectorised.
# ---------------------------------------------------------------------------
`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a

is_bad <- function(x) is.null(x) || length(x) == 0 || all(is.na(x))

fmt_num <- function(x, digits = 2, na = "–") {
  if (is.null(x) || length(x) == 0) return(na)
  out <- ifelse(is.na(x), na,
                formatC(round(x, digits), format = "f", digits = digits, big.mark = ","))
  out
}

# Money in reporting units with automatic scale: $1.2bn / $345m / $12.3k / $4.56
fmt_money <- function(x, digits = 1, na = "–", prefix = "$", force = NULL) {
  if (is.null(x) || length(x) == 0) return(na)
  vapply(x, function(v) {
    if (is.na(v)) return(na)
    a <- abs(v); sgn <- if (v < 0) "-" else ""
    unit <- force %||% if (a >= 1e9) "bn" else if (a >= 1e6) "m" else if (a >= 1e3) "k" else ""
    div <- switch(unit, bn = 1e9, m = 1e6, k = 1e3, 1)
    d <- if (unit == "") 2 else digits
    paste0(sgn, prefix, formatC(a / div, format = "f", digits = d, big.mark = ","), unit)
  }, character(1))
}

# Per-share price style: $36.61
fmt_price <- function(x, digits = 2, na = "–") {
  if (is.null(x) || length(x) == 0) return(na)
  ifelse(is.na(x), na, paste0(ifelse(x < 0, "-$", "$"),
                               formatC(abs(x), format = "f", digits = digits, big.mark = ",")))
}

fmt_pct <- function(x, digits = 1, na = "–", signed = FALSE) {
  if (is.null(x) || length(x) == 0) return(na)
  ifelse(is.na(x), na,
         paste0(if (signed) ifelse(x > 0, "+", "") else "",
                formatC(x * 100, format = "f", digits = digits, big.mark = ","), "%"))
}

fmt_ratio <- function(x, digits = 1, na = "–", suffix = "x") {
  if (is.null(x) || length(x) == 0) return(na)
  ifelse(is.na(x), na, paste0(formatC(x, format = "f", digits = digits, big.mark = ","), suffix))
}

fmt_bps <- function(x, na = "–") {
  if (is.null(x) || length(x) == 0) return(na)
  ifelse(is.na(x), na, paste0(ifelse(x > 0, "+", ""), round(x * 1e4), "bp"))
}

fmt_int <- function(x, na = "–") {
  if (is.null(x) || length(x) == 0) return(na)
  ifelse(is.na(x), na, formatC(round(x), format = "d", big.mark = ","))
}

fmt_date <- function(x, na = "–") {
  if (is.null(x) || length(x) == 0 || all(is.na(x))) return(na)
  format(as.Date(x), "%d %b %Y")
}

# Fiscal-year label from a period-end date: "FY25"
fy_label <- function(d) {
  if (is.null(d) || length(d) == 0) return(character(0))
  paste0("FY", substr(format(as.Date(d), "%Y"), 3, 4))
}

# Clamp, NA-safe
clamp <- function(x, lo, hi) {
  if (is.null(x) || length(x) == 0 || all(is.na(x))) return(lo)
  pmax(lo, pmin(hi, x))
}

# First non-NA scalar from a vector / column, else NA
n1 <- function(x) {
  if (is.null(x) || length(x) == 0) return(NA_real_)
  x <- suppressWarnings(as.numeric(x))
  x <- x[!is.na(x)]
  if (length(x) == 0) NA_real_ else x[1]
}

safe_div <- function(a, b) {
  a <- suppressWarnings(as.numeric(a)); b <- suppressWarnings(as.numeric(b))
  out <- a / b
  out[is.na(b) | b == 0] <- NA_real_
  out
}

cagr <- function(v, years = NULL) {
  v <- as.numeric(v); v <- v[!is.na(v)]
  if (length(v) < 2) return(NA_real_)
  first <- v[1]; last <- v[length(v)]
  if (first <= 0 || last <= 0) return(NA_real_)
  n <- years %||% (length(v) - 1)
  (last / first)^(1 / n) - 1
}
