# ===========================================================================
# Exports — MBS-branded Excel workbooks, a formula-driven junior-analyst
# model, the Ratio Guide, a sector workbook, a research-note draft and a zip
# bundle. Styling mirrors build_mbs_docx.py / build_sector_summary.py.
# ===========================================================================

# --- Style registry ------------------------------------------------------------------------
xl_styles <- function() {
  f <- MBS_FONT
  base <- function(..., valign = "center", fontColour = MBS$black) createStyle(fontName = f, fontSize = 10, fontColour = fontColour, valign = valign, ...)
  list(
    title    = createStyle(fontName = f, fontSize = 16, fontColour = MBS$primary, textDecoration = "bold"),
    subtitle = createStyle(fontName = f, fontSize = 11, fontColour = MBS$grey),
    note     = createStyle(fontName = f, fontSize = 9, fontColour = MBS$grey, textDecoration = "italic", wrapText = TRUE, valign = "top"),
    header   = createStyle(fontName = f, fontSize = 10, fontColour = MBS$white, textDecoration = "bold", fgFill = MBS$primary,
                           halign = "center", valign = "center", border = "TopBottomLeftRight", borderColour = MBS$dark, wrapText = TRUE),
    section  = createStyle(fontName = f, fontSize = 10.5, fontColour = MBS$white, textDecoration = "bold", fgFill = MBS$dark),
    label    = base(), label_b = base(textDecoration = "bold"),
    band     = base(fgFill = MBS$tint), band_b = base(fgFill = MBS$tint, textDecoration = "bold"),
    text     = base(wrapText = TRUE, valign = "top"),
    input    = base(fgFill = "#FFF9DB", border = "TopBottomLeftRight", borderColour = MBS$border, halign = "right"),
    num0  = base(halign = "right", numFmt = "#,##0;(#,##0);-"), num2 = base(halign = "right", numFmt = "#,##0.00;(#,##0.00);-"),
    num3  = base(halign = "right", numFmt = "0.000;(0.000);-"),  num4 = base(halign = "right", numFmt = "0.0000;(0.0000);-"),
    pct   = base(halign = "right", numFmt = "0.0%;(0.0%);-"),    pct2 = base(halign = "right", numFmt = "0.00%;(0.00%);-"),
    money = base(halign = "right", numFmt = "$#,##0.00;($#,##0.00);-"), moneym = base(halign = "right", numFmt = "$#,##0;($#,##0);-"),
    x     = base(halign = "right", numFmt = "0.0\"x\";(0.0\"x\");-"), x2 = base(halign = "right", numFmt = "0.00\"x\";(0.00\"x\");-"),
    date  = base(halign = "right", numFmt = "dd mmm yyyy"),
    input_pct = base(fgFill = "#FFF9DB", border = "TopBottomLeftRight", borderColour = MBS$border, halign = "right", numFmt = "0.0%"),
    input_num = base(fgFill = "#FFF9DB", border = "TopBottomLeftRight", borderColour = MBS$border, halign = "right", numFmt = "#,##0.00"),
    formula_num = base(halign = "right", numFmt = "#,##0;(#,##0);-"), formula_pct = base(halign = "right", numFmt = "0.0%;(0.0%);-"),
    formula_num2 = base(halign = "right", numFmt = "#,##0.00;(#,##0.00);-"),
    total = base(textDecoration = "bold", border = "Top", borderColour = MBS$dark, halign = "right", numFmt = "#,##0;(#,##0);-"),
    pos = base(halign = "right", fontColour = MBS$positive, textDecoration = "bold", numFmt = "0.0%"),
    neg = base(halign = "right", fontColour = MBS$negative, textDecoration = "bold", numFmt = "0.0%"),
    check_ok = base(halign = "center", fontColour = MBS$positive, textDecoration = "bold"),
    rec = createStyle(fontName = f, fontSize = 14, fontColour = MBS$white, textDecoration = "bold", fgFill = MBS$primary, halign = "center", valign = "center")
  )
}

xl_kind_style <- function(st, kind, band = FALSE) {
  s <- st[[kind]] %||% st$label
  if (band && kind %in% c("num0", "num2", "num3", "num4", "pct", "pct2", "money", "moneym", "x", "x2", "date", "label", "text"))
    s <- createStyle(fontName = MBS_FONT, fontSize = 10, fontColour = MBS$black, valign = "center", fgFill = MBS$tint,
                     halign = if (kind %in% c("label", "text")) "left" else "right",
                     numFmt = switch(kind, num0 = "#,##0;(#,##0);-", num2 = "#,##0.00;(#,##0.00);-", num3 = "0.000", num4 = "0.0000", pct = "0.0%;(0.0%);-", pct2 = "0.00%",
                                     money = "$#,##0.00;($#,##0.00);-", moneym = "$#,##0;($#,##0);-", x = "0.0\"x\"", x2 = "0.00\"x\"", date = "dd mmm yyyy", "GENERAL"))
  s
}

# openxlsx writes an orphaned drawing relationship into every worksheet rels
# file even when the sheet has no drawing. Strict readers (openpyxl, some Excel
# versions, Power Query) then reject the workbook, so the package is repaired
# after saving and re-zipped.
xl_finalise <- function(file) {
  target <- normalizePath(file, mustWork = TRUE)
  tmp <- tempfile("xlfix"); dir.create(tmp)
  on.exit(unlink(tmp, recursive = TRUE), add = TRUE)
  utils::unzip(target, exdir = tmp)

  rels_dir <- file.path(tmp, "xl", "worksheets", "_rels")
  if (dir.exists(rels_dir)) {
    for (f in list.files(rels_dir, full.names = TRUE, pattern = "\\.rels$")) {
      txt <- paste(readLines(f, warn = FALSE), collapse = "\n")
      # Drop only relationships whose target is missing from the archive.
      txt <- gsub('<Relationship[^>]*Target="\\.\\./drawings/[^"]*"[^>]*/>', "", txt)
      writeLines(txt, f, useBytes = TRUE)
    }
  }

  wd <- getwd(); on.exit(setwd(wd), add = TRUE); setwd(tmp)
  unlink(target)
  if (nzchar(Sys.which("zip"))) {
    system2("zip", args = c("-q", "-r", "-X", shQuote(target), "."),
            stdout = FALSE, stderr = FALSE)
  } else if (requireNamespace("zip", quietly = TRUE)) {
    zip::zipr(target, files = list.files(".", recursive = TRUE, all.files = TRUE, no.. = TRUE),
              include_directories = TRUE)
  } else {
    utils::zip(target, files = list.files(".", recursive = TRUE, all.files = TRUE, no.. = TRUE),
               flags = "-r9X")
  }
  invisible(target)
}

xl_title <- function(wb, sheet, title, subtitle = NULL, note = NULL, ncols = 10) {
  st <- xl_styles()
  writeData(wb, sheet, title, startRow = 1, startCol = 1); addStyle(wb, sheet, st$title, rows = 1, cols = 1)
  r <- 2L
  if (!is.null(subtitle)) { writeData(wb, sheet, subtitle, startRow = r, startCol = 1); addStyle(wb, sheet, st$subtitle, rows = r, cols = 1); r <- r + 1L }
  if (!is.null(note)) { writeData(wb, sheet, note, startRow = r, startCol = 1); addStyle(wb, sheet, st$note, rows = r, cols = 1); mergeCells(wb, sheet, cols = 1:ncols, rows = r); setRowHeights(wb, sheet, r, 28); r <- r + 1L }
  r + 1L
}

xl_section <- function(wb, sheet, text, row, ncols = 10) {
  st <- xl_styles()
  writeData(wb, sheet, text, startRow = row, startCol = 1)
  addStyle(wb, sheet, st$section, rows = row, cols = 1:ncols, gridExpand = TRUE)
  row + 1L
}

# Write a data frame as a styled table. `kinds` is a named character vector (column -> kind).
# Styles are applied per column (odd / even rows) so large sheets stay fast.
xl_table <- function(wb, sheet, df, start_row, kinds = NULL, banded = TRUE, bold_first = TRUE, highlight = NULL, total_row = NULL, start_col = 1) {
  st <- xl_styles()
  if (is.null(df) || nrow(df) == 0) return(start_row)
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  nc <- ncol(df); nr <- nrow(df)
  writeData(wb, sheet, df, startRow = start_row, startCol = start_col, colNames = TRUE, keepNA = FALSE)
  addStyle(wb, sheet, st$header, rows = start_row, cols = start_col:(start_col + nc - 1), gridExpand = TRUE)
  setRowHeights(wb, sheet, start_row, 24)
  rows_all <- start_row + seq_len(nr)
  odd <- rows_all[seq_len(nr) %% 2 == 1]; even <- rows_all[seq_len(nr) %% 2 == 0]
  fmt_of <- function(kind) switch(kind, num0 = "#,##0;(#,##0);-", num2 = "#,##0.00;(#,##0.00);-", num3 = "0.000", num4 = "0.0000", pct = "0.0%;(0.0%);-", pct2 = "0.00%",
                                  money = "$#,##0.00;($#,##0.00);-", moneym = "$#,##0;($#,##0);-", x = "0.0\"x\"", x2 = "0.00\"x\"", date = "dd mmm yyyy", "GENERAL")
  for (j in seq_len(nc)) {
    nm <- names(df)[j]
    kind <- if (!is.null(kinds) && nm %in% names(kinds)) kinds[[nm]] else if (is.numeric(df[[j]])) "num2" else if (inherits(df[[j]], "Date")) "date" else "label"
    col <- start_col + j - 1
    plain <- if (j == 1 && bold_first) st$label_b else xl_kind_style(st, kind, FALSE)
    band <- if (j == 1 && bold_first) st$band_b else xl_kind_style(st, kind, TRUE)
    if (length(odd)) addStyle(wb, sheet, plain, rows = odd, cols = col, gridExpand = TRUE)
    if (length(even)) addStyle(wb, sheet, if (banded) band else plain, rows = even, cols = col, gridExpand = TRUE)
    halign <- if (kind %in% c("label", "text")) "left" else "right"
    if (!is.null(highlight) && length(highlight)) addStyle(wb, sheet, createStyle(fontName = MBS_FONT, fontSize = 10, fontColour = MBS$dark, textDecoration = "bold", fgFill = "#F7D9E4", halign = halign, numFmt = fmt_of(kind)), rows = start_row + highlight, cols = col, gridExpand = TRUE)
    if (!is.null(total_row) && length(total_row)) addStyle(wb, sheet, createStyle(fontName = MBS_FONT, fontSize = 10, fontColour = MBS$black, textDecoration = "bold", border = "Top", borderColour = MBS$dark, halign = halign, numFmt = fmt_of(kind)), rows = start_row + total_row, cols = col, gridExpand = TRUE)
  }
  start_row + nr + 2L
}

# Key / value block
xl_kv <- function(wb, sheet, pairs, start_row, kinds = NULL, start_col = 1, title = NULL) {
  st <- xl_styles()
  r <- start_row
  if (!is.null(title)) { writeData(wb, sheet, title, startRow = r, startCol = start_col); addStyle(wb, sheet, st$header, rows = r, cols = start_col:(start_col + 1), gridExpand = TRUE); r <- r + 1L }
  i <- 0L
  for (k in names(pairs)) {
    i <- i + 1L
    v <- pairs[[k]]
    writeData(wb, sheet, k, startRow = r, startCol = start_col)
    kind <- if (!is.null(kinds) && k %in% names(kinds)) kinds[[k]] else if (is.numeric(v)) "num2" else "label"
    band <- i %% 2 == 0
    addStyle(wb, sheet, if (band) st$band else st$label, rows = r, cols = start_col)
    if (is.null(v) || (length(v) == 1 && is.na(v))) v <- ""
    writeData(wb, sheet, v, startRow = r, startCol = start_col + 1)
    addStyle(wb, sheet, xl_kind_style(st, kind, band), rows = r, cols = start_col + 1)
    r <- r + 1L
  }
  r + 1L
}

xl_widths <- function(wb, sheet, widths) setColWidths(wb, sheet, cols = seq_along(widths), widths = widths)

xl_footer <- function(wb, sheet, row, ncols = 10) {
  st <- xl_styles()
  writeData(wb, sheet, paste0("Melbourne Business School — Student Investment Fund · generated ", format(Sys.time(), "%d %b %Y %H:%M"), " · ", DISCLAIMER), startRow = row, startCol = 1)
  addStyle(wb, sheet, st$note, rows = row, cols = 1); mergeCells(wb, sheet, cols = 1:ncols, rows = row); setRowHeights(wb, sheet, row, 40)
}

fin_block <- function(fin, items, scale = 1e6, per_share = character(0)) {
  rows <- purrr::imap(items, function(lab, col) {
    v <- if (col %in% names(fin)) fin[[col]] else rep(NA_real_, nrow(fin))
    if (!col %in% per_share) v <- v / scale
    c(list(`Line item` = lab), setNames(as.list(round(v, 4)), fin$label))
  })
  bind_rows(rows)
}

# ===========================================================================
# 1. Company research workbook
# ===========================================================================
export_company_workbook <- function(pkg, file) {
  wb <- createWorkbook(creator = "MBS Student Investment Fund")
  st <- xl_styles()
  b <- pkg$bd; r <- b$ratios; q <- b$quote; v <- pkg$v; a <- pkg$a; h <- pkg$headline; n <- pkg$notes
  fin <- b$fin; info <- b$info
  modifyBaseFont(wb, fontSize = 10, fontName = MBS_FONT)

  # ---- Cover ----------------------------------------------------------------
  addWorksheet(wb, "Cover", gridLines = FALSE, tabColour = MBS$primary)
  row <- xl_title(wb, "Cover", paste0(info$name, " (ASX: ", b$code, ")"),
                  paste0("Investment recommendation workbook · ", info$sector, " › ", info$industry, " · ", format(pkg$generated, "%d %B %Y")),
                  note = "Melbourne Business School — Student Investment Fund. Prepared by students for educational purposes; not financial product advice.")
  writeData(wb, "Cover", paste0("Recommendation: ", toupper(h$rec)), startRow = row, startCol = 1)
  addStyle(wb, "Cover", st$rec, rows = row, cols = 1:4, gridExpand = TRUE); mergeCells(wb, "Cover", cols = 1:4, rows = row); setRowHeights(wb, "Cover", row, 30)
  row <- row + 2L
  basis <- if (h$basis == "fc") "incl. franking" else "excl. franking"
  row <- xl_kv(wb, "Cover", list(
    "Price (as at)" = q$price, "Valuation (excl. FC)" = h$value_ex, "Margin of safety (excl. FC)" = h$mos_ex,
    "Valuation (incl. FC)" = h$value_fc, "Margin of safety (incl. FC)" = h$mos_fc, "Headline basis" = basis,
    "Cost of equity" = h$ke, "Ordinary cash dividend yield" = r$dividend_yield, "Dividend yield (incl. FC)" = r$grossed_yield,
    "GICS" = paste(info$sector, "›", info$industry), "52-week range" = paste0(fmt_price(q$week52_low), " – ", fmt_price(q$week52_high)),
    "Market capitalisation" = r$market_cap, "Analysts" = if (nzchar(n$analysts)) n$analysts else "—", "Data as of" = format(b$loaded_at, "%d %b %Y %H:%M")),
    row, kinds = c("Price (as at)" = "money", "Valuation (excl. FC)" = "money", "Margin of safety (excl. FC)" = "pct", "Valuation (incl. FC)" = "money",
                   "Margin of safety (incl. FC)" = "pct", "Cost of equity" = "pct2", "Ordinary cash dividend yield" = "pct2", "Dividend yield (incl. FC)" = "pct2", "Market capitalisation" = "moneym"),
    title = "Portfolio recommendation")
  for (sec in list(c("Investment thesis", n$thesis), c("Investment case", n$case), c("Risks to the recommendation", n$risks), c("Catalysts", n$catalysts), c("ESG considerations", n$esg))) {
    row <- xl_section(wb, "Cover", sec[1], row, ncols = 6)
    txt <- if (nzchar(trimws(sec[2]))) sec[2] else "(not yet written — complete on the Notes & Export tab)"
    writeData(wb, "Cover", txt, startRow = row, startCol = 1); addStyle(wb, "Cover", st$text, rows = row, cols = 1)
    mergeCells(wb, "Cover", cols = 1:6, rows = row); setRowHeights(wb, "Cover", row, max(30, 15 * (1 + str_count(txt, "\n") + nchar(txt) %/% 110)))
    row <- row + 2L
  }
  xl_widths(wb, "Cover", c(34, 22, 18, 18, 18, 18)); xl_footer(wb, "Cover", row, 6)

  # ---- Overview -------------------------------------------------------------
  addWorksheet(wb, "Overview", gridLines = FALSE)
  row <- xl_title(wb, "Overview", "Company overview", paste0(info$name, " · latest fiscal year ", r$fy_label))
  row <- xl_kv(wb, "Overview", list("ASX code" = b$code, "Company" = info$name, "Sector" = info$sector, "Industry" = info$industry, "Exchange" = b$meta$full_exchange_name %||% "ASX",
                                    "Listed since" = fmt_date(b$meta$first_trade_date), "Currency" = q$currency, "Valuation family" = info$family,
                                    "Price" = q$price, "Previous close" = q$previous_close, "Day change" = q$change_pct, "52-week high" = q$week52_high, "52-week low" = q$week52_low,
                                    "Volume" = q$volume, "Shares outstanding (m)" = r$shares_out / 1e6, "Market cap" = r$market_cap, "Enterprise value" = r$enterprise_value, "Net debt" = r$net_debt),
               row, kinds = c(Price = "money", "Previous close" = "money", "Day change" = "pct2", "52-week high" = "money", "52-week low" = "money", Volume = "num0", "Shares outstanding (m)" = "num0", "Market cap" = "moneym", "Enterprise value" = "moneym", "Net debt" = "moneym"), title = "Profile & quote")
  row <- xl_kv(wb, "Overview", list("P/E" = r$pe_ratio, "P/B" = r$pb_ratio, "P/TBV" = r$p_tbv, "EV/EBITDA" = r$ev_ebitda, "EV/Revenue" = r$ev_revenue, "Dividend yield" = r$dividend_yield, "Grossed-up yield" = r$grossed_yield,
                                    "FCF yield" = r$fcf_yield, "PEG" = r$peg, "ROE" = r$roe, "ROA" = r$roa, "ROIC" = r$roic, "Net margin" = r$net_margin, "EBIT margin" = r$ebit_margin, "Payout" = r$payout,
                                    "Net debt / EBITDA" = r$net_debt_ebitda, "Equity / assets" = r$equity_assets, "Revenue CAGR" = r$revenue_cagr, "EPS CAGR" = r$eps_cagr, "DPS CAGR" = r$dps_cagr),
               row, kinds = c("P/E" = "x", "P/B" = "x2", "P/TBV" = "x2", "EV/EBITDA" = "x", "EV/Revenue" = "x2", "Dividend yield" = "pct2", "Grossed-up yield" = "pct2", "FCF yield" = "pct2", PEG = "x2", ROE = "pct", ROA = "pct2", ROIC = "pct",
                              "Net margin" = "pct", "EBIT margin" = "pct", Payout = "pct", "Net debt / EBITDA" = "x", "Equity / assets" = "pct", "Revenue CAGR" = "pct", "EPS CAGR" = "pct", "DPS CAGR" = "pct"), title = "Key ratios (latest FY, live price)")
  if (!is.null(b$perf)) row <- xl_table(wb, "Overview", b$perf %>% rename(Period = period, Company = stock, `S&P/ASX 200` = benchmark, Relative = relative), row, kinds = c(Company = "pct", `S&P/ASX 200` = "pct", Relative = "pct"))
  m <- b$metrics
  if (!is.null(m)) row <- xl_kv(wb, "Overview", list("Window" = paste0(fmt_date(m$first_date), " – ", fmt_date(m$last_date)), "Annualised return" = m$ann_return, "Annualised volatility" = m$ann_vol, "Sharpe" = m$sharpe, "Sortino" = m$sortino, "Beta vs ASX 200" = m$beta, "Correlation" = m$correlation, "Jensen alpha" = m$alpha, "Max drawdown" = m$max_drawdown, "Tracking error" = m$tracking_error),
                                row, kinds = c("Annualised return" = "pct", "Annualised volatility" = "pct", Sharpe = "num2", Sortino = "num2", "Beta vs ASX 200" = "num2", Correlation = "num2", "Jensen alpha" = "pct", "Max drawdown" = "pct", "Tracking error" = "pct"), title = "Risk & return")
  t <- b$tech$latest
  if (!is.null(t)) row <- xl_kv(wb, "Overview", list("SMA 50" = t$sma50, "SMA 200" = t$sma200, "RSI (14)" = t$rsi14, "Price vs SMA 200" = t$pct_vs_sma200, "52-week position" = t$pos52, "Drawdown from peak" = t$drawdown),
                                row, kinds = c("SMA 50" = "money", "SMA 200" = "money", "RSI (14)" = "num2", "Price vs SMA 200" = "pct", "52-week position" = "pct", "Drawdown from peak" = "pct"), title = "Technicals")
  xl_widths(wb, "Overview", c(30, 20, 16, 16, 16))

  # ---- Statements -----------------------------------------------------------
  stmts <- list(
    "Income Statement" = c(revenue = "Total revenue", cost_of_revenue = "Cost of revenue", gross_profit = "Gross profit", operating_expense = "Operating expenses", ebitda = "EBITDA", da = "Depreciation & amortisation", ebit = "EBIT", interest_net = "Net interest", other_income = "Other income / (expense)", pretax_income = "Pre-tax income", tax = "Income tax", net_income = "Net income", normalised_income = "Normalised income", eps = "Diluted EPS ($)", dps = "DPS ($)", shares = "Diluted shares (m)"),
    "Balance Sheet" = c(cash = "Cash & equivalents", st_investments = "Short-term investments", receivables = "Receivables", net_ppe = "Net PP&E", goodwill_intang = "Goodwill & intangibles", total_assets = "Total assets", payables = "Payables", current_debt = "Current debt", long_term_debt = "Long-term debt", total_debt = "Total debt", total_liabilities = "Total liabilities", equity = "Shareholders' equity", net_debt = "Net debt", invested_capital = "Invested capital", bvps = "Book value per share ($)"),
    "Cash Flow" = c(net_income = "Net income", da = "Depreciation & amortisation", change_nwc = "Change in working capital", ocf = "Operating cash flow", capex = "Capital expenditure", investing_cf = "Investing cash flow", fcf = "Free cash flow", dividends_paid = "Dividends paid", financing_cf = "Financing cash flow", begin_cash = "Opening cash", end_cash = "Closing cash"))
  for (nm in names(stmts)) {
    addWorksheet(wb, nm, gridLines = FALSE)
    row <- xl_title(wb, nm, nm, paste0(info$name, " · $ million unless stated · fiscal years ending ", format(r$period_end, "%d %B")), note = "Source: Yahoo Finance annual statements via yahoofinancer. Per-share items in reporting currency. Empty fiscal years in the feed are omitted.")
    if (!is.null(fin)) {
      ps <- names(stmts[[nm]])[grepl("eps|dps|bvps", names(stmts[[nm]]))]
      blk <- fin_block(fin, stmts[[nm]], per_share = ps)
      if ("shares" %in% names(stmts[[nm]])) blk[blk$`Line item` == "Diluted shares (m)", -1] <- as.list(round(fin$shares / 1e6, 1))
      col_labels <- paste0(fin$label, " (", format(fin$date, "%b %Y"), ")")
      names(blk) <- c("Line item", col_labels)
      row <- xl_table(wb, nm, blk, row, kinds = setNames(rep("num0", nrow(fin)), col_labels))
      # Per-share rows at 3dp
      for (i in seq_len(nrow(blk))) if (names(stmts[[nm]])[i] %in% ps) for (j in seq_len(nrow(fin))) addStyle(wb, nm, st$num3, rows = row - nrow(blk) - 2 + i, cols = 1 + j)
    }
    xl_widths(wb, nm, c(34, rep(14, 8)))
  }

  # ---- Ratios by year -----------------------------------------------------------
  addWorksheet(wb, "Ratios", gridLines = FALSE)
  row <- xl_title(wb, "Ratios", "Ratio analysis by fiscal year", "Valuation multiples use the closing price at each period end (latest year at the live price)")
  if (!is.null(fin)) {
    px <- vapply(seq_len(nrow(fin)), function(i) price_at(b$history, fin$date[i]), numeric(1)); px[nrow(fin)] <- q$price
    mcap <- px * fin$shares; ev <- mcap + coalesce(fin$net_debt, 0)
    mk <- function(lab, v) c(list(Metric = lab), setNames(as.list(round(v, 4)), fin$label))
    rows <- bind_rows(
      mk("Share price ($)", px), mk("P/E", ifelse(fin$eps > 0, px / fin$eps, NA)), mk("P/B", ifelse(fin$bvps > 0, px / fin$bvps, NA)), mk("EV/EBITDA", ifelse(fin$ebitda > 0, ev / fin$ebitda, NA)),
      mk("EV/Revenue", ifelse(fin$revenue > 0, ev / fin$revenue, NA)), mk("Dividend yield", fin$dps / px), mk("Earnings yield", fin$eps / px), mk("FCF yield", fin$fcf / mcap),
      mk("ROE", fin$roe), mk("ROA", fin$roa), mk("ROIC", fin$roic), mk("Gross margin", fin$gross_margin), mk("EBITDA margin", fin$ebitda_margin), mk("EBIT margin", fin$ebit_margin), mk("Net margin", fin$net_margin),
      mk("Cash conversion", fin$cash_conversion), mk("Payout ratio", fin$payout), mk("Effective tax rate", fin$tax_rate_eff),
      mk("Net debt / EBITDA", fin$net_debt_ebitda), mk("Debt / equity", fin$debt_equity), mk("Equity / assets", fin$equity_assets), mk("Interest coverage", fin$interest_coverage), mk("Asset turnover", fin$asset_turnover), mk("Equity multiplier", fin$leverage),
      mk("Revenue growth", fin$revenue_growth), mk("EBITDA growth", fin$ebitda_growth), mk("Net income growth", fin$ni_growth), mk("EPS growth", fin$eps_growth), mk("DPS growth", fin$dps_growth), mk("BVPS growth", fin$bvps_growth))
    row <- xl_table(wb, "Ratios", rows, row, kinds = setNames(rep("num2", nrow(fin)), fin$label))
    pct_rows <- c(6:8, 9:15, 17:18, 21, 25:30)
    for (i in pct_rows) for (j in seq_len(nrow(fin))) addStyle(wb, "Ratios", if (i %% 2 == 0) createStyle(fontName = MBS_FONT, fontSize = 10, fgFill = MBS$tint, halign = "right", numFmt = "0.0%") else st$pct, rows = row - nrow(rows) - 2 + i, cols = 1 + j)
  }
  xl_widths(wb, "Ratios", c(30, rep(13, 8)))

  # ---- Peer comps -----------------------------------------------------------------
  addWorksheet(wb, "Peer Comps", gridLines = FALSE)
  row <- xl_title(wb, "Peer Comps", "Trading comparables", "Latest fiscal year fundamentals with live prices · medians exclude the subject company")
  pt <- if (!is.null(pkg$peers)) pkg$peers$table else NULL
  if (!is.null(pt) && nrow(pt) > 0) {
    d <- pt %>% transmute(Code = code, Company = name, Industry = industry, Price = price, `Market cap ($m)` = market_cap / 1e6, `P/E` = pe_ratio, `P/B` = pb_ratio, `EV/EBITDA` = ev_ebitda, `EV/Revenue` = ev_revenue,
                          `Dividend yield` = dividend_yield, ROE = roe, ROA = roa, `Net margin` = net_margin, `EBIT margin` = ebit_margin, `Net debt/EBITDA` = net_debt_ebitda, Payout = payout, `Revenue CAGR` = revenue_cagr, `EPS CAGR` = eps_cagr, `1y return` = return_1y, FY = fy_label)
    med <- d[d$Code != b$code, ] %>% summarise(across(where(is.numeric), ~ median(.x, na.rm = TRUE))); med$Code <- "MEDIAN"; med$Company <- "Peer median"; med$Industry <- ""; med$FY <- ""
    d <- bind_rows(d, med)
    row <- xl_table(wb, "Peer Comps", d, row, kinds = c(Price = "money", `Market cap ($m)` = "num0", `P/E` = "x", `P/B` = "x2", `EV/EBITDA` = "x", `EV/Revenue` = "x2", `Dividend yield` = "pct2", ROE = "pct", ROA = "pct2", `Net margin` = "pct", `EBIT margin` = "pct", `Net debt/EBITDA` = "x", Payout = "pct", `Revenue CAGR` = "pct", `EPS CAGR` = "pct", `1y return` = "pct"),
                    highlight = which(d$Code == b$code), total_row = nrow(d))
  } else { writeData(wb, "Peer Comps", "Peer set not loaded.", startRow = row, startCol = 1); row <- row + 2L }
  xl_widths(wb, "Peer Comps", c(10, 34, 26, rep(12, 17)))

  # ---- Valuation -------------------------------------------------------------------
  addWorksheet(wb, "Valuation", gridLines = FALSE, tabColour = MBS$dark)
  row <- xl_title(wb, "Valuation", "Valuation summary", v$methodology)
  row <- xl_kv(wb, "Valuation", list("Risk-free rate" = a$rf, "Beta" = a$beta, "Market risk premium" = a$mrp, "Cost of equity (CAPM)" = v$ke, "Pre-tax cost of debt" = a$cost_of_debt, "Tax rate" = a$tax_rate, "Debt / capital" = a$debt_weight, "WACC" = v$wacc,
                                     "Terminal growth" = a$terminal_growth, "Franking level" = a$franking, "Franking gross-up factor" = v$franking_factor, "Forecast horizon (years)" = a$horizon, "Discounting" = if (a$midyear) "Mid-year" else "End-of-year"),
               row, kinds = c("Risk-free rate" = "pct2", Beta = "num2", "Market risk premium" = "pct2", "Cost of equity (CAPM)" = "pct2", "Pre-tax cost of debt" = "pct2", "Tax rate" = "pct", "Debt / capital" = "pct", WACC = "pct2", "Terminal growth" = "pct2", "Franking level" = "pct", "Franking gross-up factor" = "num3", "Forecast horizon (years)" = "num0"), title = "Cost of capital & terminal assumptions")
  md <- v$methods %>% transmute(Method = label, `Value (excl. FC)` = value_ex, `Value (incl. FC)` = value_fc, Low = low, High = high, Weight = weight_used, `Upside (headline)` = if (v$headline_basis == "fc") upside_fc else upside_ex, Status = ifelse(in_use, "In fair value", ifelse(available, "Reference", "Unavailable")), Note = note)
  row <- xl_table(wb, "Valuation", md, row, kinds = c(`Value (excl. FC)` = "money", `Value (incl. FC)` = "money", Low = "money", High = "money", Weight = "pct", `Upside (headline)` = "pct"))
  row <- xl_kv(wb, "Valuation", list("Current price" = v$price, "Weighted fair value (excl. FC)" = v$weighted_value_ex, "Margin of safety (excl. FC)" = v$mos_ex, "Weighted fair value (incl. FC)" = v$weighted_value_fc, "Margin of safety (incl. FC)" = v$mos_fc, "Headline basis" = if (v$headline_basis == "fc") "Including franking credits" else "Excluding franking credits", "Recommendation" = h$rec, "Buy threshold" = a$rec_buy, "Sell threshold" = a$rec_sell),
               row, kinds = c("Current price" = "money", "Weighted fair value (excl. FC)" = "money", "Margin of safety (excl. FC)" = "pct", "Weighted fair value (incl. FC)" = "money", "Margin of safety (incl. FC)" = "pct", "Buy threshold" = "pct", "Sell threshold" = "pct"), title = "Fair value & recommendation")
  if (!is.null(v$rel)) row <- xl_table(wb, "Valuation", v$rel %>% transmute(Multiple = label, `Peer 25th pct` = multiple_low, `Peer median` = multiple, `Peer 75th pct` = multiple_high, `Company` = company_multiple, `Value at 25th` = value_low, `Value at median` = value, `Value at 75th` = value_high, Peers = n_peers),
                                       row, kinds = c(`Peer 25th pct` = "num2", `Peer median` = "num2", `Peer 75th pct` = "num2", Company = "num2", `Value at 25th` = "money", `Value at median` = "money", `Value at 75th` = "money", Peers = "num0"))
  xl_widths(wb, "Valuation", c(34, 18, 18, 14, 14, 12, 16, 16, 40))

  # ---- Intrinsic model schedule ----------------------------------------------------
  if (v$family == "industrial" && !is.null(v$dcf)) {
    addWorksheet(wb, "DCF", gridLines = FALSE)
    row <- xl_title(wb, "DCF", "Unlevered free cash flow (FCFF) DCF", "FCFF = EBIT × (1 − t) + D&A − capex − ΔNWC · $ million")
    s <- v$dcf$schedule
    row <- xl_table(wb, "DCF", s %>% transmute(Year = label, Revenue = revenue / 1e6, Growth = revenue_growth, EBIT = ebit / 1e6, `EBIT margin` = ebit_margin, Tax = tax / 1e6, NOPAT = nopat / 1e6, `D&A` = da / 1e6, Capex = capex / 1e6, `ΔNWC` = delta_nwc / 1e6, FCFF = fcff / 1e6, `Discount factor` = discount_factor, `PV FCFF` = pv_fcff / 1e6),
                    row, kinds = c(Revenue = "num0", Growth = "pct", EBIT = "num0", `EBIT margin` = "pct", Tax = "num0", NOPAT = "num0", `D&A` = "num0", Capex = "num0", `ΔNWC` = "num0", FCFF = "num0", `Discount factor` = "num3", `PV FCFF` = "num0"))
    d <- v$dcf
    row <- xl_kv(wb, "DCF", list("PV of forecast FCFF" = d$pv_fcff_sum / 1e6, "Terminal FCFF" = d$terminal_fcff / 1e6, "Terminal value" = d$terminal_value / 1e6, "PV of terminal value" = d$pv_terminal / 1e6, "TV share of EV" = d$tv_share, "Enterprise value" = d$enterprise_value / 1e6, "Less net debt" = a$net_debt / 1e6, "Equity value" = d$equity_value / 1e6, "Shares (m)" = a$shares / 1e6, "Value per share" = d$per_share, "Upside / (downside)" = d$upside, "Implied EV / FY1 EBITDA" = d$implied_ev_ebitda),
                 row, kinds = c("PV of forecast FCFF" = "num0", "Terminal FCFF" = "num0", "Terminal value" = "num0", "PV of terminal value" = "num0", "TV share of EV" = "pct", "Enterprise value" = "num0", "Less net debt" = "num0", "Equity value" = "num0", "Shares (m)" = "num0", "Value per share" = "money", "Upside / (downside)" = "pct", "Implied EV / FY1 EBITDA" = "x"), title = "EV to equity bridge ($m)")
    rd <- tryCatch(reverse_dcf(a), error = function(e) NULL)
    if (!is.null(rd)) row <- xl_kv(wb, "DCF", list("Implied uniform revenue growth" = rd$implied_growth, "Implied terminal growth" = rd$implied_terminal_growth), row, kinds = c("Implied uniform revenue growth" = "pct", "Implied terminal growth" = "pct2"), title = "Reverse DCF (what the price implies)")
    xl_widths(wb, "DCF", c(30, rep(13, 12)))
  }
  if (!is.null(v$ddm)) {
    addWorksheet(wb, "Dividend Model", gridLines = FALSE)
    row <- xl_title(wb, "Dividend Model", "Dividend discount, residual income and justified P/B", "Two-stage DDM with franking gross-up (the Fund's methodology for financials) · $ per share")
    s <- v$ddm$schedule
    row <- xl_table(wb, "Dividend Model", s %>% transmute(Year = label, EPS = eps, `EPS growth` = eps_growth, Payout = payout, DPS = dps, `DPS incl. FC` = dps_grossed, `Opening BVPS` = bvps_open, `Closing BVPS` = bvps, ROE = roe, `Discount factor` = discount_factor, `PV of DPS` = pv_dps, `Residual income` = if (!is.null(v$rim)) v$rim$schedule$residual_income else NA_real_),
                    row, kinds = c(EPS = "num3", `EPS growth` = "pct", Payout = "pct", DPS = "num3", `DPS incl. FC` = "num3", `Opening BVPS` = "num2", `Closing BVPS` = "num2", ROE = "pct", `Discount factor` = "num3", `PV of DPS` = "num3", `Residual income` = "num3"))
    dd <- v$ddm
    row <- xl_kv(wb, "Dividend Model", list("Cost of equity" = dd$ke, "Terminal growth" = dd$terminal_growth, "Franking factor" = dd$franking_factor, "PV explicit dividends" = dd$pv_explicit, "Terminal value (excl. FC)" = dd$terminal_value, "PV terminal value" = dd$pv_terminal, "TV share of value" = dd$tv_share,
                                             "Value excl. franking" = dd$value_ex, "Value incl. franking" = dd$value_fc, "MoS excl. franking" = dd$upside_ex, "MoS incl. franking" = dd$upside_fc, "Cash dividend yield" = dd$yield_ex, "Grossed-up yield" = dd$yield_fc),
                 row, kinds = c("Cost of equity" = "pct2", "Terminal growth" = "pct2", "Franking factor" = "num3", "PV explicit dividends" = "money", "Terminal value (excl. FC)" = "money", "PV terminal value" = "money", "TV share of value" = "pct", "Value excl. franking" = "money", "Value incl. franking" = "money", "MoS excl. franking" = "pct", "MoS incl. franking" = "pct", "Cash dividend yield" = "pct2", "Grossed-up yield" = "pct2"), title = "Dividend discount model")
    if (!is.null(v$rim)) row <- xl_kv(wb, "Dividend Model", list("Opening BVPS" = v$rim$book_value, "PV of residual income" = v$rim$pv_ri, "PV terminal residual income" = v$rim$pv_terminal, "Value per share" = v$rim$value, "Upside / (downside)" = v$rim$upside), row, kinds = c("Opening BVPS" = "money", "PV of residual income" = "money", "PV terminal residual income" = "money", "Value per share" = "money", "Upside / (downside)" = "pct"), title = "Residual income model")
    if (!is.null(v$jpb)) row <- xl_kv(wb, "Dividend Model", list("ROE" = v$jpb$roe, "Cost of equity" = v$jpb$ke, "Growth" = v$jpb$growth, "Justified P/B" = v$jpb$justified_pb, "Current P/B" = r$pb_ratio, "BVPS" = v$jpb$bvps, "Implied value" = v$jpb$value, "Upside / (downside)" = v$jpb$upside), row, kinds = c(ROE = "pct", "Cost of equity" = "pct2", Growth = "pct2", "Justified P/B" = "x2", "Current P/B" = "x2", BVPS = "money", "Implied value" = "money", "Upside / (downside)" = "pct"), title = "Justified P/B (excess returns)")
    xl_widths(wb, "Dividend Model", c(30, rep(13, 12)))
  }

  # ---- Scenarios & sensitivity --------------------------------------------------------
  addWorksheet(wb, "Scenarios", gridLines = FALSE)
  row <- xl_title(wb, "Scenarios", "Scenario analysis", "Bear / base / bull deltas applied to the base-case drivers; probability-weighted value (Appendix B format)")
  sc <- pkg$scen
  if (!is.null(sc)) row <- xl_table(wb, "Scenarios", sc %>% transmute(Scenario = scenario, Weight = weight, `Growth Δ` = growth_delta, `Margin Δ` = margin_delta, `Payout Δ` = payout_delta, `Ke Δ` = ke_delta, `Terminal g Δ` = tg_delta, `Cost of equity` = ke, `Value (excl. FC)` = value_ex, `MoS (excl. FC)` = mos_ex, `Value (incl. FC)` = value_fc, `MoS (incl. FC)` = mos_fc),
                                    row, kinds = c(Weight = "pct", `Growth Δ` = "pct", `Margin Δ` = "pct", `Payout Δ` = "pct", `Ke Δ` = "pct2", `Terminal g Δ` = "pct2", `Cost of equity` = "pct2", `Value (excl. FC)` = "money", `MoS (excl. FC)` = "pct", `Value (incl. FC)` = "money", `MoS (incl. FC)` = "pct"), total_row = nrow(sc))
  xl_widths(wb, "Scenarios", c(24, rep(13, 11)))

  addWorksheet(wb, "Sensitivity", gridLines = FALSE)
  row <- xl_title(wb, "Sensitivity", "Sensitivity analysis", "Weighted fair value and margin of safety (Appendix C format)")
  sens_tbl <- function(s, lab) s %>% transmute(!!lab := delta, `Cost of equity` = ke, `Value (excl. FC)` = value_ex, `MoS (excl. FC)` = mos_ex, `Value (incl. FC)` = value_fc, `MoS (incl. FC)` = mos_fc)
  for (item in list(list(pkg$sens$ke, "Δ Ke"), list(pkg$sens$growth, "Δ growth"), list(pkg$sens$tg, "Δ terminal growth"), list(pkg$sens$margin, if (v$family == "industrial") "Δ EBIT margin" else "Δ payout"))) {
    if (is.null(item[[1]])) next
    row <- xl_section(wb, "Sensitivity", item[[2]], row, 7)
    row <- xl_table(wb, "Sensitivity", sens_tbl(item[[1]], item[[2]]), row, kinds = setNames(c("pct2", "pct2", "money", "pct", "money", "pct"), c(item[[2]], "Cost of equity", "Value (excl. FC)", "MoS (excl. FC)", "Value (incl. FC)", "MoS (incl. FC)")), bold_first = FALSE)
  }
  g2 <- pkg$sens$grid
  if (!is.null(g2) && !is.null(g2$matrix)) {
    row <- xl_section(wb, "Sensitivity", paste0("Two-way: ", g2$method, " — rows: ", g2$x_label, ", columns: ", g2$y_label), row, 7)
    m <- as.data.frame(round(g2$matrix, 2)); names(m) <- fmt_pct(g2$y, 2)
    m <- bind_cols(tibble(!!g2$x_label := fmt_pct(g2$x, 2)), m)
    row <- xl_table(wb, "Sensitivity", m, row, kinds = setNames(rep("money", ncol(m) - 1), names(m)[-1]))
  }
  xl_widths(wb, "Sensitivity", c(22, rep(15, 6)))

  addWorksheet(wb, "Football Field", gridLines = FALSE)
  row <- xl_title(wb, "Football Field", "Valuation ranges", "Low / base / high per method against the current price")
  if (!is.null(pkg$ff)) row <- xl_table(wb, "Football Field", pkg$ff %>% rename(Method = method, Low = low, Base = base, High = high), row, kinds = c(Low = "money", Base = "money", High = "money"))
  xl_widths(wb, "Football Field", c(34, 14, 14, 14))

  # ---- Price history & dividends --------------------------------------------------------
  addWorksheet(wb, "Price History", gridLines = FALSE)
  row <- xl_title(wb, "Price History", "Daily price history", paste0(b$code, " · ", b$period, " window · adjusted close reflects dividends"))
  if (!is.null(b$history)) {
    hh <- b$history %>% transmute(Date = date, Open = open, High = high, Low = low, Close = close, `Adj close` = adj_close, Volume = volume)
    row <- xl_table(wb, "Price History", hh, row, kinds = c(Date = "date", Open = "num2", High = "num2", Low = "num2", Close = "num2", `Adj close` = "num2", Volume = "num0"), banded = FALSE, bold_first = FALSE)
  }
  xl_widths(wb, "Price History", c(14, rep(12, 6)))
  addWorksheet(wb, "Dividends", gridLines = FALSE)
  row <- xl_title(wb, "Dividends", "Dividend register", "Cash dividends per share inferred from adjusted-close ratios (ex-dates) — verify against company announcements")
  if (!is.null(b$dividends) && nrow(b$dividends)) row <- xl_table(wb, "Dividends", b$dividends %>% transmute(`Ex-date` = ex_date, `DPS ($)` = dps), row, kinds = c(`Ex-date` = "date", `DPS ($)` = "num3"), bold_first = FALSE)
  xl_widths(wb, "Dividends", c(16, 12))

  saveWorkbook(wb, file, overwrite = TRUE)
  xl_finalise(file)
  invisible(file)
}

# ===========================================================================
# 2. Junior Analyst financial model — formula-driven, mirrors the template
# ===========================================================================
export_financial_model <- function(pkg, file) {
  wb <- createWorkbook(creator = "MBS Student Investment Fund")
  st <- xl_styles()
  modifyBaseFont(wb, fontSize = 10, fontName = MBS_FONT)
  b <- pkg$bd; r <- b$ratios; fin <- b$fin; a <- pkg$a; v <- pkg$v; q <- b$quote; info <- b$info
  fy0 <- if (!is.null(fin)) max(fin$fy) else as.integer(format(Sys.Date(), "%Y"))
  years <- (fy0 - 4):(fy0 + 5)
  HC <- 2:6; FC <- 7:11; YC <- 2:11
  S <- list(ctrl = "Control & Assumptions", hd = "Historical Data", od = "Operating Drivers", wc = "Working Capital", ppe = "PPE & D&A",
            debt = "Debt Schedule", is = "Income Statement", bs = "Balance Sheet", cf = "Cash Flow", dcf = "DCF Valuation", tc = "Trading Comps", mc = "Model Checks", src = "Sources & Notes")
  C <- function(j) int2col(j)
  R <- function(sheet, j, row) sprintf("'%s'!%s%d", sheet, C(j), row)
  hv <- function(col, scale = 1e6) { out <- rep(NA_real_, 5); if (is.null(fin)) return(out); m <- match((fy0 - 4):fy0, fin$fy); ok <- !is.na(m); out[ok] <- fin[[col]][m[ok]] / scale; out }
  # Styles are queued and applied in batches (one addStyle per sheet x style) for speed.
  .pending <- new.env(parent = emptyenv())
  put <- function(sheet, row, col, x, style = NULL) {
    if (is.null(x) || (length(x) == 1 && is.na(x))) return(invisible())
    if (is.character(x) && length(x) == 1 && startsWith(x, "=")) writeFormula(wb, sheet, x, startCol = col, startRow = row) else writeData(wb, sheet, x, startCol = col, startRow = row)
    if (!is.null(style)) {
      key <- paste0(sheet, "|", rlang::hash(style))
      cur <- .pending[[key]] %||% list(sheet = sheet, style = style, rows = integer(0), cols = integer(0))
      cur$rows <- c(cur$rows, row); cur$cols <- c(cur$cols, col)
      .pending[[key]] <- cur
    }
  }
  flush_styles <- function() for (k in ls(.pending)) { q <- .pending[[k]]; addStyle(wb, q$sheet, q$style, rows = q$rows, cols = q$cols, gridExpand = FALSE) }
  label <- function(sheet, row, text, bold = FALSE) put(sheet, row, 1, text, if (bold) st$label_b else st$label)
  sched_header <- function(sheet, title, subtitle, cols = YC) {
    writeData(wb, sheet, title, startCol = 1, startRow = 1); addStyle(wb, sheet, st$title, rows = 1, cols = 1)
    writeData(wb, sheet, subtitle, startCol = 1, startRow = 2); addStyle(wb, sheet, st$subtitle, rows = 2, cols = 1)
    writeData(wb, sheet, "Fiscal year / status", startCol = 1, startRow = 4); addStyle(wb, sheet, st$header, rows = 4, cols = 1)
    for (j in cols) { idx <- j - 1; put(sheet, 4, j, paste0("FY", years[idx]), st$header); put(sheet, 5, j, if (j <= 6) "Historical" else "Forecast", st$subtitle) }
    setColWidths(wb, sheet, cols = 1, widths = 44); setColWidths(wb, sheet, cols = YC, widths = 13)
  }
  section_row <- function(sheet, row, text, units = NULL) { writeData(wb, sheet, text, startCol = 1, startRow = row); addStyle(wb, sheet, st$section, rows = row, cols = 1:11, gridExpand = TRUE); if (!is.null(units)) put(sheet, row, 2, units, st$section) }
  # row writer: hist = numeric vector(5) or function(j), fcst = function(j) -> formula / value
  row_fn <- function(sheet, row, lab, hist = NULL, fcst = NULL, style = "num", bold = FALSE, hist_cols = HC, fcst_cols = FC) {
    label(sheet, row, lab, bold)
    sty <- switch(style, num = st$formula_num, num2 = st$formula_num2, pct = st$formula_pct, input = st$input_num, input_pct = st$input_pct, st$formula_num)
    if (!is.null(hist)) for (j in hist_cols) { x <- if (is.function(hist)) hist(j) else hist[j - 1]; put(sheet, row, j, x, if (style == "num" && !is.function(hist)) st$input_num else sty) }
    if (!is.null(fcst)) for (j in fcst_cols) put(sheet, row, j, fcst(j), sty)
  }
  for (s in S) addWorksheet(wb, s, gridLines = FALSE, tabColour = if (s %in% c(S$ctrl, S$hd)) "#FFF9DB" else if (s == S$dcf) MBS$primary else NULL)

  # ---- START HERE ---------------------------------------------------------------------
  addWorksheet(wb, "START HERE", gridLines = FALSE, tabColour = MBS$primary); worksheetOrder(wb) <- c(length(S) + 1, seq_along(S))
  writeData(wb, "START HERE", "FINANCIAL MODELLING | JUNIOR ANALYST PLAYBOOK", startRow = 1, startCol = 1); addStyle(wb, "START HERE", st$title, rows = 1, cols = 1)
  writeData(wb, "START HERE", paste0("Reusable structure built from the Fund's BHP, RMPL and APL models · pre-populated for ", info$name, " (", b$code, ") from Yahoo Finance on ", format(pkg$generated, "%d %b %Y"), " · yellow cells are inputs, black cells are formulas"), startRow = 2, startCol = 1); addStyle(wb, "START HERE", st$subtitle, rows = 2, cols = 1)
  steps <- c("01  MODEL SET-UP & RESPONSIBILITIES",
             "1. Enter company identity, base year, currency and valuation date on Control & Assumptions (pre-filled).",
             "2. Review the 5 years of reported history on Historical Data (populated from Yahoo Finance; blank where the feed has no value — complete from the annual report).",
             "3. Record source document, page, date, unit and URL in Sources & Notes (Yahoo rows are pre-registered).",
             "4. Complete Operating Drivers: volumes × realised prices where relevant; otherwise top-down growth from Control & Assumptions.",
             "5. Populate operating cost ratios and Working Capital assumptions (days) on Control & Assumptions.",
             "6. Populate PPE & D&A and the Debt Schedule. Check capex, depreciation and interest against guidance.",
             "7. Review the linked Income Statement, Balance Sheet and Cash Flow. The balance-sheet check must be zero in every forecast year.",
             "8. Set DCF inputs and Trading Comps. Verify WACC, FCFF and the EV-to-equity bridge.",
             "9. Resolve every CHECK flag on Model Checks before submitting to the Sector Head.",
             "10. Submit with a written investment thesis, drivers, risks and catalysts (see the Notes & Export tab of the workstation).",
             "", "02  RESEARCH / MODELLING STANDARDS",
             "Use audited annual reports for historical data; Yahoo Finance values here are a starting point, not a source of record.",
             "Units: statements and valuation use millions of reporting currency; per-share figures in currency units; shares in millions.",
             "Historical input cells left blank are intentionally blank; never type zeros for missing data.",
             "Forecast assumptions are placeholders derived from history; replace with researched assumptions and document the rationale.",
             "Review EBITDA vs EBIT, net financing income, dividends, minorities and one-offs before relying on any line.",
             "Never double count interest income or non-operating investments in FCFF and the equity bridge.",
             if (info$family != "industrial") "NOTE: this company is a financial / REIT. The Fund values financials on dividends, residual income and justified P/B (see the Dividend Model sheet of the research workbook); the FCFF DCF here is for completeness only." else "")
  for (i in seq_along(steps)) { writeData(wb, "START HERE", steps[i], startRow = 3 + i, startCol = 1); addStyle(wb, "START HERE", if (grepl("^0[12]  ", steps[i])) st$section else st$text, rows = 3 + i, cols = 1) }
  setColWidths(wb, "START HERE", cols = 1, widths = 150)

  # ---- Control & Assumptions -------------------------------------------------------------
  sh <- S$ctrl
  sched_header(sh, "01 | CONTROL & ASSUMPTIONS", "Edit yellow cells. 5 historical years + 5 forecast years · drivers apply to the forecast columns")
  section_row(sh, 5, "COMPANY SET-UP")
  ctrl_meta <- list(c(6, "Company / ticker", paste0(info$name, " (", b$code, ")")), c(7, "Reporting currency", q$currency %||% "AUD"), c(8, "Financial year end", format(r$period_end, "%d %B")),
                    c(9, "Analyst", if (nzchar(pkg$notes$analysts)) pkg$notes$analysts else "Junior analyst"), c(10, "Last updated", format(Sys.Date(), "%d %b %Y")))
  for (m in ctrl_meta) { label(sh, as.integer(m[1]), m[2]); put(sh, as.integer(m[1]), 2, m[3], st$input) }
  section_row(sh, 11, "OPERATING DRIVERS (forecast years)")
  L <- if (!is.null(fin)) fin[nrow(fin), ] else NULL
  g <- a$grid
  drv_growth <- if (a$family == "industrial") g$revenue_growth else g$eps_growth
  cogs_r <- if (!is.null(L) && !is.na(L$cost_of_revenue) && !is.na(L$revenue) && L$revenue > 0) L$cost_of_revenue / L$revenue else 0
  opex_r <- if (!is.null(L) && !is.na(L$operating_expense) && !is.na(L$revenue) && L$revenue > 0) L$operating_expense / L$revenue else if (!is.null(L) && !is.na(L$ebit_margin)) max(0, 1 - cogs_r - L$ebit_margin - coalesce(L$da_revenue, 0)) else 0.2
  dep_r <- if (!is.null(fin) && nrow(fin) > 1 && !is.na(fin$da[nrow(fin)]) && !is.na(fin$net_ppe[nrow(fin) - 1]) && fin$net_ppe[nrow(fin) - 1] > 0) clamp(fin$da[nrow(fin)] / fin$net_ppe[nrow(fin) - 1], 0.02, 0.5) else 0.10
  rec_days <- if (!is.null(L) && !is.na(L$receivables) && !is.na(L$revenue) && L$revenue > 0) L$receivables / L$revenue * 365 else 0
  pay_days <- if (!is.null(L) && !is.na(L$payables)) L$payables / (if (cogs_r > 0) L$cost_of_revenue else L$revenue) * 365 else 0
  payout_r <- if (a$family != "industrial") g$payout else rep(if (!is.null(L) && !is.na(L$payout)) clamp(L$payout, 0, 1) else 0.3, 5)
  drivers <- list(
    list(12, "Base revenue growth", drv_growth, "pct"), list(13, "Cost of sales / revenue", rep(cogs_r, 5), "pct"), list(14, "Operating costs / revenue", rep(opex_r, 5), "pct"),
    list(15, "Effective tax rate", if (a$family == "industrial") g$tax_rate else rep(a$tax_rate, 5), "pct"),
    list(16, "Annual capex / revenue", if (a$family == "industrial") g$capex_pct else rep(coalesce(n1(r$capex_revenue), 0.02), 5), "pct"),
    list(17, "Depreciation / opening PPE", rep(dep_r, 5), "pct"), list(18, "Dividend payout ratio", payout_r, "pct"),
    list(19, "Receivables days", rep(round(rec_days, 1), 5), "num"), list(20, "Inventory days", rep(0, 5), "num"), list(21, "Payables days", rep(round(pay_days, 1), 5), "num"),
    list(22, "Other NWC / revenue", rep(0, 5), "pct"), list(23, "Cash interest rate", rep(a$cost_of_debt, 5), "pct"), list(24, "Cash yield", rep(0.025, 5), "pct"), list(25, "Minimum cash target ($m)", rep(0, 5), "num"))
  for (d in drivers) { label(sh, d[[1]], d[[2]]); for (k in 1:5) put(sh, d[[1]], FC[k], round(d[[3]][k], 4), if (d[[4]] == "pct") st$input_pct else st$input_num) }
  section_row(sh, 26, "VALUATION INPUTS")
  rel <- v$rel
  pe_med <- rel$multiple[rel$method == "pe"]; pb_med <- rel$multiple[rel$method == "pb"]
  vinputs <- list(list(27, "Risk-free rate", a$rf, "pct"), list(28, "Levered beta", a$beta, "num"), list(29, "Equity risk premium", a$mrp, "pct"), list(30, "Pretax cost of debt", a$cost_of_debt, "pct"),
                  list(31, "Target debt weight", a$debt_weight, "pct"), list(32, "Terminal growth rate", a$terminal_growth, "pct"), list(33, "Current share price", q$price, "num"),
                  list(34, "Shares outstanding (millions)", r$shares_out / 1e6, "num"), list(35, "Net non-operating assets (millions)", coalesce(n1(L$st_investments), 0) / 1e6, "num"),
                  list(36, "Non-controlling interests (millions)", 0, "num"), list(37, "P/E peer multiple", if (is.na(pe_med)) "" else round(pe_med, 2), "num"), list(38, "P/B peer multiple", if (is.na(pb_med)) "" else round(pb_med, 2), "num"),
                  list(39, "P/E weight", 0.2, "pct"), list(40, "P/B weight", 0.2, "pct"), list(41, "DCF weight", 0.6, "pct"))
  for (d in vinputs) { label(sh, d[[1]], d[[2]]); put(sh, d[[1]], 2, d[[3]], if (d[[4]] == "pct") st$input_pct else st$input_num) }
  section_row(sh, 44, "KEY ASSUMPTION CHECKS")
  label(sh, 46, "Valuation weights total"); put(sh, 46, 2, "=B39+B40+B41", st$formula_pct)
  label(sh, 47, "Terminal growth < WACC?"); put(sh, 47, 2, sprintf("=IF(%s>%s,\"OK\",\"CHECK\")", R(S$dcf, 2, 26), R(S$dcf, 2, 27)), st$check_ok)

  # ---- Historical Data ------------------------------------------------------------------
  sh <- S$hd
  sched_header(sh, "02 | REPORTED HISTORICAL DATA", "Reported values in millions (Yahoo Finance via yahoofinancer); costs, interest paid, capex and dividends entered as positives · verify against the annual report")
  section_row(sh, 6, "REPORTED ACCOUNTING VALUES", "Millions of reporting currency")
  int_exp <- function() { x <- hv("interest_net"); ifelse(!is.na(x) & x < 0, -x, ifelse(is.na(x), NA, 0)) }
  int_inc <- function() { x <- hv("interest_net"); ifelse(!is.na(x) & x > 0, x, ifelse(is.na(x), NA, 0)) }
  cash_tot <- hv("cash_total")
  plugA <- hv("total_assets") - coalesce(cash_tot, 0) - coalesce(hv("receivables"), 0) - coalesce(hv("net_ppe"), 0)
  plugL <- hv("total_liabilities") - coalesce(hv("payables"), 0) - coalesce(hv("total_debt"), 0)
  px_fy <- if (!is.null(fin)) vapply((fy0 - 4):fy0, function(y) { i <- match(y, fin$fy); if (is.na(i)) NA_real_ else price_at(b$history, fin$date[i]) }, numeric(1)) else rep(NA_real_, 5)
  px_fy[5] <- q$price
  hd_rows <- list(
    list(7, "Revenue", hv("revenue")), list(8, "COGS (positive)", hv("cost_of_revenue")), list(9, "Operating expenses (positive)", hv("operating_expense")), list(10, "Other operating income", hv("other_income")),
    list(11, "Interest expense (positive)", int_exp()), list(12, "Interest income", int_inc()), list(13, "Income tax expense (positive)", hv("tax")), list(14, "Depreciation & amortisation", hv("da")),
    list(15, "Net PPE (Yahoo reports net)", hv("net_ppe")), list(16, "Cash (incl. short-term investments)", cash_tot), list(17, "Trade receivables", hv("receivables")), list(18, "Inventory", rep(NA_real_, 5)),
    list(19, "Other current operating assets", rep(NA_real_, 5)), list(20, "Trade payables", hv("payables")), list(21, "Other current operating liabilities", rep(NA_real_, 5)), list(22, "Total interest-bearing debt", hv("total_debt")),
    list(23, "Other noncurrent operating assets (plug to total assets)", plugA), list(24, "Other noncurrent operating liabilities (plug to total liabilities)", plugL), list(25, "Shareholders equity", hv("equity")), list(26, "Non-controlling interests", rep(0, 5)),
    list(27, "Cash flow from operations", hv("ocf")), list(28, "Capital expenditure (positive)", hv("capex")), list(29, "Dividends paid (positive)", hv("dividends_paid")), list(30, "Shares outstanding (millions)", hv("shares")),
    list(31, "Market price (per share)", px_fy), list(32, "Net non-operating investments", hv("st_investments")), list(33, "Debt repayments (positive)", rep(NA_real_, 5)), list(34, "Debt raised (positive)", rep(NA_real_, 5)),
    list(35, "Debt interest paid (positive)", rep(NA_real_, 5)), list(36, "Share issuance / (buyback)", rep(NA_real_, 5)), list(37, "Other financing inflows / (outflows)", rep(NA_real_, 5)))
  for (d in hd_rows) { label(sh, d[[1]], d[[2]]); for (k in 1:5) put(sh, d[[1]], HC[k], if (is.na(d[[3]][k])) NA else round(d[[3]][k], 3), st$input_num) }

  # ---- Operating Drivers ---------------------------------------------------------------------
  sh <- S$od
  sched_header(sh, "03 | REVENUE & COST BUILD", "Top-down growth from Control & Assumptions; replace with volume × price where the business supports it")
  section_row(sh, 6, "OPERATING FORECAST")
  row_fn(sh, 7, "Historical or forecast revenue", hist = function(j) paste0("=", R(S$hd, j, 7)), fcst = function(j) sprintf("=%s%d*(1+%s%d)", C(j - 1), 7, C(j), 8), bold = TRUE)
  row_fn(sh, 8, "Revenue growth", hist = function(j) if (j > 2) sprintf("=IFERROR(%s7/%s7-1,\"\")", C(j), C(j - 1)) else NA, fcst = function(j) paste0("=", R(S$ctrl, j, 12)), style = "pct")
  row_fn(sh, 9, "Optional unit volume (millions)", fcst = function(j) NA); row_fn(sh, 10, "Optional realised price (currency per unit)", fcst = function(j) NA)
  row_fn(sh, 11, "Volume × price implied revenue", fcst = function(j) sprintf("=IF(AND(%s9<>\"\",%s10<>\"\"),%s9*%s10,\"\")", C(j), C(j), C(j), C(j)))
  row_fn(sh, 12, "Forecast revenue used in statements", fcst = function(j) sprintf("=IF(%s11<>\"\",%s11,%s7)", C(j), C(j), C(j)), bold = TRUE)
  row_fn(sh, 14, "COGS / revenue", hist = function(j) sprintf("=IFERROR(%s/%s7,\"\")", R(S$hd, j, 8), C(j)), fcst = function(j) paste0("=", R(S$ctrl, j, 13)), style = "pct")
  row_fn(sh, 15, "COGS expense (positive)", hist = function(j) paste0("=", R(S$hd, j, 8)), fcst = function(j) sprintf("=%s12*%s14", C(j), C(j)))
  row_fn(sh, 16, "Operating costs / revenue", hist = function(j) sprintf("=IFERROR(%s/%s7,\"\")", R(S$hd, j, 9), C(j)), fcst = function(j) paste0("=", R(S$ctrl, j, 14)), style = "pct")
  row_fn(sh, 17, "Operating expenses (positive)", hist = function(j) paste0("=", R(S$hd, j, 9)), fcst = function(j) sprintf("=%s12*%s16", C(j), C(j)))
  row_fn(sh, 18, "Other operating income", hist = function(j) paste0("=", R(S$hd, j, 10)), fcst = function(j) 0, style = "input")
  row_fn(sh, 19, "Operating profit before D&A proxy", hist = function(j) sprintf("=%s7-%s15-%s17+%s18", C(j), C(j), C(j), C(j)), fcst = function(j) sprintf("=%s12-%s15-%s17+%s18", C(j), C(j), C(j), C(j)), bold = TRUE)
  section_row(sh, 20, "SEGMENTS (optional)")
  for (k in 1:3) row_fn(sh, 20 + k, paste0("Segment ", k, " revenue (optional)"), fcst = function(j) NA)
  row_fn(sh, 24, "Segment total", hist = function(j) sprintf("=SUM(%s21:%s23)", C(j), C(j)), fcst = function(j) sprintf("=SUM(%s21:%s23)", C(j), C(j)))
  row_fn(sh, 25, "Segment-to-total reconciliation", hist = function(j) sprintf("=IF(%s24=0,0,%s24-%s7)", C(j), C(j), C(j)), fcst = function(j) sprintf("=IF(%s24=0,0,%s24-%s12)", C(j), C(j), C(j)))

  # ---- Working Capital --------------------------------------------------------------------------
  sh <- S$wc
  sched_header(sh, "04 | OPERATING WORKING CAPITAL", "Turnover-driven receivables, inventory and payables; other NWC as a % of revenue")
  section_row(sh, 6, "OPERATING CURRENT ASSETS & LIABILITIES")
  row_fn(sh, 7, "Receivables", hist = function(j) paste0("=", R(S$hd, j, 17)), fcst = function(j) sprintf("=%s*%s15/365", R(S$od, j, 12), C(j)))
  row_fn(sh, 8, "Inventory", hist = function(j) paste0("=", R(S$hd, j, 18)), fcst = function(j) sprintf("=%s*%s16/365", R(S$od, j, 15), C(j)))
  row_fn(sh, 9, "Other operating current assets", hist = function(j) paste0("=", R(S$hd, j, 19)), fcst = function(j) sprintf("=%s*%s18", R(S$od, j, 12), C(j)))
  row_fn(sh, 10, "Payables", hist = function(j) paste0("=", R(S$hd, j, 20)), fcst = function(j) sprintf("=IF(%s>0,%s,%s)*%s17/365", R(S$od, j, 15), R(S$od, j, 15), R(S$od, j, 12), C(j)))
  row_fn(sh, 11, "Other operating current liabilities", hist = function(j) paste0("=", R(S$hd, j, 21)), fcst = function(j) 0, style = "input")
  row_fn(sh, 12, "Net working capital", hist = function(j) sprintf("=SUM(%s7:%s9)-%s10-%s11", C(j), C(j), C(j), C(j)), fcst = function(j) sprintf("=SUM(%s7:%s9)-%s10-%s11", C(j), C(j), C(j), C(j)), bold = TRUE)
  row_fn(sh, 13, "Change in NWC (cash outflow +)", hist = function(j) if (j > 2) sprintf("=%s12-%s12", C(j), C(j - 1)) else NA, fcst = function(j) sprintf("=%s12-%s12", C(j), C(j - 1)))
  row_fn(sh, 15, "Receivables days", fcst = function(j) paste0("=", R(S$ctrl, j, 19)), style = "num2"); row_fn(sh, 16, "Inventory days", fcst = function(j) paste0("=", R(S$ctrl, j, 20)), style = "num2")
  row_fn(sh, 17, "Payables days", fcst = function(j) paste0("=", R(S$ctrl, j, 21)), style = "num2"); row_fn(sh, 18, "Other NWC / revenue", fcst = function(j) paste0("=", R(S$ctrl, j, 22)), style = "pct")

  # ---- PPE & D&A --------------------------------------------------------------------------------
  sh <- S$ppe
  sched_header(sh, "05 | FIXED ASSETS / DEPRECIATION", "Simple net PPE roll-forward; replace with an asset-class schedule for capital-intensive businesses")
  section_row(sh, 6, "PPE MOVEMENT", "Millions")
  row_fn(sh, 7, "Opening net PPE", hist = function(j) if (j > 2) sprintf("=%s11", C(j - 1)) else NA, fcst = function(j) sprintf("=%s11", C(j - 1)))
  row_fn(sh, 8, "Capital expenditure / additions", hist = function(j) paste0("=", R(S$hd, j, 28)), fcst = function(j) sprintf("=%s*%s14", R(S$od, j, 12), C(j)))
  row_fn(sh, 9, "Depreciation & amortisation", hist = function(j) paste0("=", R(S$hd, j, 14)), fcst = function(j) sprintf("=%s7*%s15", C(j), C(j)))
  row_fn(sh, 10, "Disposals / impairments (optional)", fcst = function(j) 0, style = "input")
  row_fn(sh, 11, "Closing net PPE", hist = function(j) paste0("=", R(S$hd, j, 15)), fcst = function(j) sprintf("=%s7+%s8-%s9-%s10", C(j), C(j), C(j), C(j)), bold = TRUE)
  row_fn(sh, 12, "PPE movement check", hist = function(j) if (j > 2) sprintf("=IFERROR(%s11-(%s7+%s8-%s9-%s10),\"\")", C(j), C(j), C(j), C(j), C(j)) else NA, fcst = function(j) sprintf("=%s11-(%s7+%s8-%s9-%s10)", C(j), C(j), C(j), C(j), C(j)))
  row_fn(sh, 14, "Capex as % of revenue", fcst = function(j) paste0("=", R(S$ctrl, j, 16)), style = "pct"); row_fn(sh, 15, "Depreciation / opening PPE", fcst = function(j) paste0("=", R(S$ctrl, j, 17)), style = "pct")

  # ---- Debt Schedule -----------------------------------------------------------------------------
  sh <- S$debt
  sched_header(sh, "06 | DEBT & FINANCING", "Drawdowns, contractual repayments and average-balance interest; cash yield on opening cash")
  section_row(sh, 6, "INTEREST BEARING DEBT")
  row_fn(sh, 7, "Opening gross debt", hist = function(j) if (j > 2) sprintf("=%s10", C(j - 1)) else NA, fcst = function(j) sprintf("=%s10", C(j - 1)))
  row_fn(sh, 8, "New debt / draws", fcst = function(j) 0, style = "input"); row_fn(sh, 9, "Mandatory repayments", fcst = function(j) 0, style = "input")
  row_fn(sh, 10, "Closing gross debt", hist = function(j) paste0("=", R(S$hd, j, 22)), fcst = function(j) sprintf("=%s7+%s8-%s9", C(j), C(j), C(j)), bold = TRUE)
  row_fn(sh, 11, "Average gross debt", hist = function(j) if (j > 2) sprintf("=AVERAGE(%s7,%s10)", C(j), C(j)) else NA, fcst = function(j) sprintf("=AVERAGE(%s7,%s10)", C(j), C(j)))
  row_fn(sh, 12, "Cash interest rate", fcst = function(j) paste0("=", R(S$ctrl, j, 23)), style = "pct")
  row_fn(sh, 13, "Interest expense", hist = function(j) paste0("=", R(S$hd, j, 11)), fcst = function(j) sprintf("=%s11*%s12", C(j), C(j)))
  row_fn(sh, 15, "Beginning cash", hist = function(j) if (j > 2) paste0("=", R(S$hd, j - 1, 16)) else NA, fcst = function(j) if (j == 7) paste0("=", R(S$hd, 6, 16)) else sprintf("=%s", R(S$cf, j - 1, 24)))
  row_fn(sh, 16, "Interest income / cash yield", fcst = function(j) paste0("=", R(S$ctrl, j, 24)), style = "pct")
  row_fn(sh, 17, "Interest income", hist = function(j) paste0("=", R(S$hd, j, 12)), fcst = function(j) sprintf("=%s15*%s16", C(j), C(j)))
  row_fn(sh, 19, "Current portion of debt (optional)", fcst = function(j) 0, style = "input"); row_fn(sh, 20, "Lease liabilities (included in closing debt?)", fcst = function(j) 0, style = "input")

  # ---- Income Statement ----------------------------------------------------------------------------
  sh <- S$is
  sched_header(sh, "07 | INCOME STATEMENT", "Expenses negative in the presented P&L · 5 historical + 5 forecast years")
  section_row(sh, 6, "PROFIT & LOSS", "Millions")
  both <- function(f) list(hist = f, fcst = f)
  row_fn(sh, 7, "Net revenue", hist = function(j) paste0("=", R(S$od, j, 7)), fcst = function(j) paste0("=", R(S$od, j, 12)), bold = TRUE)
  row_fn(sh, 8, "Cost of sales", hist = function(j) paste0("=-", R(S$od, j, 15)), fcst = function(j) paste0("=-", R(S$od, j, 15)))
  row_fn(sh, 9, "Gross profit", hist = function(j) sprintf("=%s7+%s8", C(j), C(j)), fcst = function(j) sprintf("=%s7+%s8", C(j), C(j)), bold = TRUE)
  row_fn(sh, 10, "Gross margin", hist = function(j) sprintf("=IFERROR(%s9/%s7,\"\")", C(j), C(j)), fcst = function(j) sprintf("=IFERROR(%s9/%s7,\"\")", C(j), C(j)), style = "pct")
  row_fn(sh, 12, "Operating expenses", hist = function(j) paste0("=-", R(S$od, j, 17)), fcst = function(j) paste0("=-", R(S$od, j, 17)))
  row_fn(sh, 13, "Other operating income", hist = function(j) paste0("=", R(S$od, j, 18)), fcst = function(j) paste0("=", R(S$od, j, 18)))
  row_fn(sh, 14, "EBITDA (pre D&A)", hist = function(j) sprintf("=%s9+%s12+%s13", C(j), C(j), C(j)), fcst = function(j) sprintf("=%s9+%s12+%s13", C(j), C(j), C(j)), bold = TRUE)
  row_fn(sh, 15, "Depreciation & amortisation", hist = function(j) paste0("=-", R(S$ppe, j, 9)), fcst = function(j) paste0("=-", R(S$ppe, j, 9)))
  row_fn(sh, 16, "EBIT", hist = function(j) sprintf("=%s14+%s15", C(j), C(j)), fcst = function(j) sprintf("=%s14+%s15", C(j), C(j)), bold = TRUE)
  row_fn(sh, 17, "EBIT margin", hist = function(j) sprintf("=IFERROR(%s16/%s7,\"\")", C(j), C(j)), fcst = function(j) sprintf("=IFERROR(%s16/%s7,\"\")", C(j), C(j)), style = "pct")
  row_fn(sh, 19, "Finance income", hist = function(j) paste0("=", R(S$debt, j, 17)), fcst = function(j) paste0("=", R(S$debt, j, 17)))
  row_fn(sh, 20, "Finance expense", hist = function(j) paste0("=-", R(S$debt, j, 13)), fcst = function(j) paste0("=-", R(S$debt, j, 13)))
  row_fn(sh, 21, "Profit before tax", hist = function(j) sprintf("=%s16+%s19+%s20", C(j), C(j), C(j)), fcst = function(j) sprintf("=%s16+%s19+%s20", C(j), C(j), C(j)), bold = TRUE)
  row_fn(sh, 22, "Income tax expense", hist = function(j) paste0("=-", R(S$hd, j, 13)), fcst = function(j) sprintf("=-MAX(0,%s21)*%s", C(j), R(S$ctrl, j, 15)))
  row_fn(sh, 23, "Net profit", hist = function(j) sprintf("=%s21+%s22", C(j), C(j)), fcst = function(j) sprintf("=%s21+%s22", C(j), C(j)), bold = TRUE)
  row_fn(sh, 24, "Net margin", hist = function(j) sprintf("=IFERROR(%s23/%s7,\"\")", C(j), C(j)), fcst = function(j) sprintf("=IFERROR(%s23/%s7,\"\")", C(j), C(j)), style = "pct")
  row_fn(sh, 26, "Shares outstanding (millions)", hist = function(j) paste0("=", R(S$hd, j, 30)), fcst = function(j) sprintf("=%s26", C(j - 1)), style = "num2")
  row_fn(sh, 27, "EPS (reporting currency/share)", hist = function(j) sprintf("=IFERROR(%s23/%s26,\"\")", C(j), C(j)), fcst = function(j) sprintf("=IFERROR(%s23/%s26,\"\")", C(j), C(j)), style = "num2")
  row_fn(sh, 28, "Dividends paid", hist = function(j) paste0("=", R(S$hd, j, 29)), fcst = function(j) sprintf("=MAX(0,%s23)*%s", C(j), R(S$ctrl, j, 18)))
  row_fn(sh, 29, "Dividend payout ratio", hist = function(j) sprintf("=IFERROR(%s28/%s23,\"\")", C(j), C(j)), fcst = function(j) sprintf("=IFERROR(%s28/%s23,\"\")", C(j), C(j)), style = "pct")

  # ---- Balance Sheet ---------------------------------------------------------------------------------
  sh <- S$bs
  sched_header(sh, "08 | BALANCE SHEET", "Forecast cash is the plug from the cash flow statement; the check row must be zero in every forecast year")
  section_row(sh, 6, "ASSETS", "Millions")
  row_fn(sh, 7, "Cash & cash equivalents", hist = function(j) paste0("=", R(S$hd, j, 16)), fcst = function(j) paste0("=", R(S$cf, j, 24)))
  row_fn(sh, 8, "Trade receivables", hist = function(j) paste0("=", R(S$wc, j, 7)), fcst = function(j) paste0("=", R(S$wc, j, 7)))
  row_fn(sh, 9, "Inventory", hist = function(j) paste0("=", R(S$wc, j, 8)), fcst = function(j) paste0("=", R(S$wc, j, 8)))
  row_fn(sh, 10, "Other current operating assets", hist = function(j) paste0("=", R(S$wc, j, 9)), fcst = function(j) paste0("=", R(S$wc, j, 9)))
  row_fn(sh, 11, "Net PPE", hist = function(j) paste0("=", R(S$ppe, j, 11)), fcst = function(j) paste0("=", R(S$ppe, j, 11)))
  row_fn(sh, 12, "Other noncurrent operating assets", hist = function(j) paste0("=", R(S$hd, j, 23)), fcst = function(j) sprintf("=%s12", C(j - 1)))
  row_fn(sh, 13, "TOTAL ASSETS", hist = function(j) sprintf("=SUM(%s7:%s12)", C(j), C(j)), fcst = function(j) sprintf("=SUM(%s7:%s12)", C(j), C(j)), bold = TRUE)
  section_row(sh, 14, "LIABILITIES & EQUITY", "Millions")
  row_fn(sh, 15, "Trade payables", hist = function(j) paste0("=", R(S$wc, j, 10)), fcst = function(j) paste0("=", R(S$wc, j, 10)))
  row_fn(sh, 16, "Other current operating liabilities", hist = function(j) paste0("=", R(S$wc, j, 11)), fcst = function(j) paste0("=", R(S$wc, j, 11)))
  row_fn(sh, 17, "Gross interest-bearing debt", hist = function(j) paste0("=", R(S$debt, j, 10)), fcst = function(j) paste0("=", R(S$debt, j, 10)))
  row_fn(sh, 18, "Other noncurrent operating liabilities", hist = function(j) paste0("=", R(S$hd, j, 24)), fcst = function(j) sprintf("=%s18", C(j - 1)))
  row_fn(sh, 19, "TOTAL LIABILITIES", hist = function(j) sprintf("=SUM(%s15:%s18)", C(j), C(j)), fcst = function(j) sprintf("=SUM(%s15:%s18)", C(j), C(j)), bold = TRUE)
  section_row(sh, 20, "EQUITY", "Millions")
  row_fn(sh, 21, "Shareholders equity", hist = function(j) paste0("=", R(S$hd, j, 25)), fcst = function(j) sprintf("=%s21+%s-%s+%s", C(j - 1), R(S$is, j, 23), R(S$is, j, 28), R(S$cf, j, 20)))
  row_fn(sh, 22, "Non-controlling interests", hist = function(j) paste0("=", R(S$hd, j, 26)), fcst = function(j) sprintf("=%s22", C(j - 1)))
  row_fn(sh, 23, "TOTAL EQUITY", hist = function(j) sprintf("=%s21+%s22", C(j), C(j)), fcst = function(j) sprintf("=%s21+%s22", C(j), C(j)), bold = TRUE)
  row_fn(sh, 25, "TOTAL LIABILITIES & EQUITY", hist = function(j) sprintf("=%s19+%s23", C(j), C(j)), fcst = function(j) sprintf("=%s19+%s23", C(j), C(j)), bold = TRUE)
  row_fn(sh, 26, "Balance sheet check (assets - L&E)", hist = function(j) sprintf("=ROUND(%s13-%s25,2)", C(j), C(j)), fcst = function(j) sprintf("=ROUND(%s13-%s25,2)", C(j), C(j)))
  row_fn(sh, 28, "Equity opening balance / retained earnings bridge", fcst = function(j) sprintf("=%s21+%s-%s", C(j - 1), R(S$is, j, 23), R(S$is, j, 28)))
  row_fn(sh, 29, "Equity movement check", fcst = function(j) sprintf("=ROUND(%s21-%s28-%s,2)", C(j), C(j), R(S$cf, j, 20)))

  # ---- Cash Flow ----------------------------------------------------------------------------------------
  sh <- S$cf
  sched_header(sh, "09 | CASH FLOW STATEMENT", "Indirect method · historical CFO is the reported figure; forecast flows are derived from the linked schedules")
  section_row(sh, 6, "CASH FLOW FROM OPERATIONS")
  row_fn(sh, 7, "Net profit after tax", fcst = function(j) paste0("=", R(S$is, j, 23)))
  row_fn(sh, 8, "Add back D&A", fcst = function(j) paste0("=", R(S$ppe, j, 9)))
  row_fn(sh, 9, "Less: increase in NWC", fcst = function(j) paste0("=-", R(S$wc, j, 13)))
  row_fn(sh, 10, "Other operating adjustments", fcst = function(j) 0, style = "input")
  row_fn(sh, 11, "NET CASH FROM OPERATIONS", hist = function(j) paste0("=", R(S$hd, j, 27)), fcst = function(j) sprintf("=SUM(%s7:%s10)", C(j), C(j)), bold = TRUE)
  section_row(sh, 12, "CASH FLOW FROM INVESTING")
  row_fn(sh, 13, "Capital expenditure (outflow)", hist = function(j) paste0("=-", R(S$hd, j, 28)), fcst = function(j) paste0("=-", R(S$ppe, j, 8)))
  row_fn(sh, 14, "Other investing flows", fcst = function(j) 0, style = "input")
  row_fn(sh, 15, "NET CASH FROM INVESTING", hist = function(j) sprintf("=%s13+%s14", C(j), C(j)), fcst = function(j) sprintf("=%s13+%s14", C(j), C(j)), bold = TRUE)
  section_row(sh, 16, "CASH FLOW FROM FINANCING")
  row_fn(sh, 17, "Gross debt issued", fcst = function(j) paste0("=", R(S$debt, j, 8)))
  row_fn(sh, 18, "Gross debt repaid", fcst = function(j) paste0("=-", R(S$debt, j, 9)))
  row_fn(sh, 19, "Dividends paid", hist = function(j) paste0("=-", R(S$hd, j, 29)), fcst = function(j) paste0("=-", R(S$is, j, 28)))
  row_fn(sh, 20, "Share issuance / (buybacks)", fcst = function(j) 0, style = "input")
  row_fn(sh, 21, "Other financing flows", fcst = function(j) 0, style = "input")
  row_fn(sh, 22, "NET CASH FROM FINANCING", fcst = function(j) sprintf("=SUM(%s17:%s21)", C(j), C(j)), bold = TRUE)
  row_fn(sh, 23, "NET CHANGE IN CASH", fcst = function(j) sprintf("=%s11+%s15+%s22", C(j), C(j), C(j)), bold = TRUE)
  row_fn(sh, 24, "Closing cash", hist = function(j) paste0("=", R(S$hd, j, 16)), fcst = function(j) if (j == 7) sprintf("=%s+%s23", R(S$hd, 6, 16), C(j)) else sprintf("=%s24+%s23", C(j - 1), C(j)), bold = TRUE)
  row_fn(sh, 25, "Reported cash comparison (historic)", hist = function(j) paste0("=", R(S$hd, j, 16)))
  row_fn(sh, 26, "Minimum cash funding gap", fcst = function(j) sprintf("=%s24-%s", C(j), R(S$ctrl, j, 25)))

  # ---- DCF Valuation ------------------------------------------------------------------------------------
  sh <- S$dcf
  sched_header(sh, "10 | DISCOUNTED CASH FLOW", "FCFF = EBIT(1 − T) + D&A − capex − change in operating NWC; valued at WACC with a Gordon-growth terminal value", cols = FC)
  section_row(sh, 6, "FCFF FORECAST / PRESENT VALUE")
  row_fn(sh, 7, "EBIT", fcst = function(j) paste0("=", R(S$is, j, 16)))
  row_fn(sh, 8, "Tax rate", fcst = function(j) paste0("=", R(S$ctrl, j, 15)), style = "pct")
  row_fn(sh, 9, "NOPAT", fcst = function(j) sprintf("=%s7*(1-%s8)", C(j), C(j)), bold = TRUE)
  row_fn(sh, 10, "Add depreciation", fcst = function(j) paste0("=", R(S$ppe, j, 9)))
  row_fn(sh, 11, "Less capex", fcst = function(j) paste0("=-", R(S$ppe, j, 8)))
  row_fn(sh, 12, "Less increase in NWC", fcst = function(j) paste0("=-", R(S$wc, j, 13)))
  row_fn(sh, 13, "FREE CASH FLOW TO FIRM", fcst = function(j) sprintf("=SUM(%s9:%s12)", C(j), C(j)), bold = TRUE)
  row_fn(sh, 14, "Forecast period index", fcst = function(j) j - 6, style = "num2")
  row_fn(sh, 15, "Discount factor", fcst = function(j) sprintf("=1/(1+$B$26)^%s14", C(j)), style = "num2")
  row_fn(sh, 16, "PV of forecast FCFF", fcst = function(j) sprintf("=%s13*%s15", C(j), C(j)), bold = TRUE)
  section_row(sh, 17, "COST OF CAPITAL & TERMINAL VALUE")
  dcf_rows <- list(c(18, "Risk-free rate", paste0("=", R(S$ctrl, 2, 27)), "pct"), c(19, "Beta", paste0("=", R(S$ctrl, 2, 28)), "num2"), c(20, "Market risk premium", paste0("=", R(S$ctrl, 2, 29)), "pct"),
                   c(21, "Cost of equity (CAPM)", "=B18+B19*B20", "pct"), c(22, "Pretax debt cost", paste0("=", R(S$ctrl, 2, 30)), "pct"), c(23, "Tax rate for WACC", paste0("=", R(S$ctrl, 7, 15)), "pct"),
                   c(24, "Debt / capital", paste0("=", R(S$ctrl, 2, 31)), "pct"), c(25, "Equity / capital", "=1-B24", "pct"), c(26, "WEIGHTED AVERAGE COST OF CAPITAL", "=B21*B25+B22*(1-B23)*B24", "pct"),
                   c(27, "Terminal growth rate", paste0("=", R(S$ctrl, 2, 32)), "pct"), c(28, "Terminal FCFF", "=K13*(1+B27)", "num"), c(29, "Terminal value", "=IFERROR(B28/(B26-B27),\"\")", "num"), c(30, "PV terminal value", "=IFERROR(B29*K15,\"\")", "num"),
                   c(32, "PV forecast FCFF total", "=SUM(G16:K16)", "num"), c(33, "Enterprise value", "=B32+B30", "num"), c(34, "Less gross debt", paste0("=-", R(S$hd, 6, 22)), "num"), c(35, "Add cash & equivalents", paste0("=", R(S$hd, 6, 16)), "num"),
                   c(36, "Add non-operating investments (net)", paste0("=", R(S$ctrl, 2, 35)), "num"), c(37, "Less noncontrolling interests", paste0("=-", R(S$ctrl, 2, 36)), "num"), c(38, "EQUITY VALUE", "=SUM(B33:B37)", "num"),
                   c(39, "Shares outstanding (millions)", paste0("=", R(S$ctrl, 2, 34)), "num2"), c(40, "DCF VALUE PER SHARE", "=IFERROR(B38/B39,\"\")", "num2"), c(41, "Current share price", paste0("=", R(S$ctrl, 2, 33)), "num2"),
                   c(42, "DCF UPSIDE / (DOWNSIDE)", "=IFERROR(B40/B41-1,\"\")", "pct"), c(43, "EV / FY1 EBITDA", paste0("=IFERROR(B33/", R(S$is, 7, 14), ",\"\")"), "num2"))
  for (d in dcf_rows) { label(sh, as.integer(d[1]), d[2], bold = grepl("^[A-Z /()]+$", d[2])); put(sh, as.integer(d[1]), 2, d[3], switch(d[4], pct = st$formula_pct, num2 = st$formula_num2, st$formula_num)) }

  # ---- Trading Comps ------------------------------------------------------------------------------------
  sh <- S$tc
  writeData(wb, sh, "11 | RELATIVE VALUATION", startRow = 1, startCol = 1); addStyle(wb, sh, st$title, rows = 1, cols = 1)
  writeData(wb, sh, "P/E, P/B and weighted valuation from verified peer multiples on Control & Assumptions", startRow = 2, startCol = 1); addStyle(wb, sh, st$subtitle, rows = 2, cols = 1)
  section_row(sh, 6, "PEER MULTIPLES / IMPLIED FAIR VALUE")
  tc_rows <- list(c(7, "Forward EPS (FY1)", paste0("=", R(S$is, 7, 27)), "num2"), c(8, "Peer median forward P/E", paste0("=", R(S$ctrl, 2, 37)), "num2"), c(9, "Implied value from P/E", "=IFERROR(B7*B8,\"\")", "num2"),
                  c(11, "Closing forecast book equity (FY1)", paste0("=", R(S$bs, 7, 21)), "num"), c(12, "Shares outstanding", paste0("=", R(S$ctrl, 2, 34)), "num2"), c(13, "Forward book value per share", "=IFERROR(B11/B12,\"\")", "num2"),
                  c(14, "Peer median P/B", paste0("=", R(S$ctrl, 2, 38)), "num2"), c(15, "Implied value from P/B", "=IFERROR(B13*B14,\"\")", "num2"),
                  c(18, "DCF value / share", paste0("=", R(S$dcf, 2, 40)), "num2"), c(19, "P/E valuation weight", paste0("=", R(S$ctrl, 2, 39)), "pct"), c(20, "P/B valuation weight", paste0("=", R(S$ctrl, 2, 40)), "pct"), c(21, "DCF valuation weight", paste0("=", R(S$ctrl, 2, 41)), "pct"),
                  c(22, "WEIGHTED FAIR VALUE", "=IFERROR((B9*B19+B15*B20+B18*B21)/(B19+B20+B21),\"\")", "num2"), c(23, "Current share price", paste0("=", R(S$ctrl, 2, 33)), "num2"), c(24, "Implied upside / downside", "=IFERROR(B22/B23-1,\"\")", "pct"), c(25, "Valuation weight check", "=B19+B20+B21", "pct"))
  for (d in tc_rows) { label(sh, as.integer(d[1]), d[2], bold = d[2] == "WEIGHTED FAIR VALUE"); put(sh, as.integer(d[1]), 2, d[3], switch(d[4], pct = st$formula_pct, num2 = st$formula_num2, st$formula_num)) }
  setColWidths(wb, sh, cols = 1:2, widths = c(40, 16))

  # ---- Model Checks ---------------------------------------------------------------------------------------
  sh <- S$mc
  sched_header(sh, "12 | REVIEW & RECONCILIATION", "OK = pass; investigate any CHECK and never plug a difference")
  section_row(sh, 6, "QUALITY ASSURANCE")
  chk <- function(expr) sprintf("=IF(ABS(%s)<0.5,\"OK\",\"CHECK\")", expr)
  row_fn(sh, 7, "Balance sheet difference (should = 0)", hist = function(j) chk(R(S$bs, j, 26)), fcst = function(j) chk(R(S$bs, j, 26)), style = "num")
  row_fn(sh, 8, "Cash rollforward consistency (forecast)", fcst = function(j) chk(sprintf("%s-%s", R(S$cf, j, 24), R(S$bs, j, 7))))
  row_fn(sh, 9, "PPE movement difference", fcst = function(j) chk(R(S$ppe, j, 12)))
  row_fn(sh, 10, "Equity rollforward difference", fcst = function(j) chk(R(S$bs, j, 29)))
  row_fn(sh, 11, "Net debt not negative", fcst = function(j) sprintf("=IF(%s-%s<0,\"Net cash\",\"OK\")", R(S$debt, j, 10), R(S$bs, j, 7)))
  row_fn(sh, 12, "Segment revenue reconcile (if populated)", hist = function(j) chk(R(S$od, j, 25)), fcst = function(j) chk(R(S$od, j, 25)))
  row_fn(sh, 13, "Minimum cash funding gap", fcst = function(j) sprintf("=IF(%s<0,\"CHECK\",\"OK\")", R(S$cf, j, 26)))
  row_fn(sh, 14, "Forecast ending debt negative?", fcst = function(j) sprintf("=IF(%s<0,\"CHECK\",\"OK\")", R(S$debt, j, 10)))
  label(sh, 15, "Valuation weights = 100%"); put(sh, 15, 2, sprintf("=IF(ABS(%s-1)<0.001,\"OK\",\"CHECK\")", R(S$ctrl, 2, 46)), st$check_ok)
  label(sh, 16, "WACC exceeds terminal growth"); put(sh, 16, 2, sprintf("=IF(%s>%s,\"OK\",\"CHECK\")", R(S$dcf, 2, 26), R(S$dcf, 2, 27)), st$check_ok)
  row_fn(sh, 17, "Forecast DCF FCFF consistent with operating schedule", fcst = function(j) chk(sprintf("%s-(%s*(1-%s)+%s-%s-%s)", R(S$dcf, j, 13), R(S$is, j, 16), R(S$ctrl, j, 15), R(S$ppe, j, 9), R(S$ppe, j, 8), R(S$wc, j, 13))))
  for (rr in c(7:14, 17)) for (j in YC) addStyle(wb, sh, st$check_ok, rows = rr, cols = j)
  label(sh, 19, "FINAL ANALYST REVIEW STATUS", bold = TRUE); put(sh, 19, 2, "=IF(COUNTIF(B7:K17,\"CHECK\")>0,\"REVIEW CHECKS\",IF(COUNTBLANK('Historical Data'!B7:F7)>0,\"INCOMPLETE HISTORY\",\"PASS\"))", st$rec)
  label(sh, 21, "Reviewer name"); put(sh, 21, 2, "", st$input); label(sh, 22, "Date reviewed"); put(sh, 22, 2, "", st$input); label(sh, 23, "Key open issues"); put(sh, 23, 2, "", st$input)

  # ---- Sources & Notes --------------------------------------------------------------------------------------
  sh <- S$src
  writeData(wb, sh, "13 | SOURCE REGISTER", startRow = 1, startCol = 1); addStyle(wb, sh, st$title, rows = 1, cols = 1)
  writeData(wb, sh, "Document the origin and date of every historical figure and assumption. Yahoo Finance rows are pre-registered; replace with annual-report references before submission.", startRow = 2, startCol = 1); addStyle(wb, sh, st$subtitle, rows = 2, cols = 1)
  src <- tibble(`Input / datapoint` = c("Income statement (all lines)", "Balance sheet (all lines)", "Cash flow (all lines)", "Share price history", "Dividends per share", "Peer multiples", "Risk-free rate", "Market risk premium", "Beta"),
                `Company / segment` = info$name, `Year / period` = c(rep(paste0("FY", fy0 - 4, "–FY", fy0), 3), paste(b$period, "window"), "Inferred from adjusted close", paste(nrow(if (!is.null(pkg$peers)) pkg$peers$table else tibble()) , "peers"), "Analyst input", "Analyst input", "Regression vs S&P/ASX 200"),
                `Value / units` = c(rep("Millions of reporting currency", 3), "Currency per share", "Currency per share", "x", fmt_pct(a$rf, 2), fmt_pct(a$mrp, 2), as.character(a$beta)),
                `Source publication / page` = c(rep("Yahoo Finance annual statements (yahoofinancer)", 3), "Yahoo Finance", "Derived (adj close ratio)", "Yahoo Finance via workstation", "Australian 10-year government bond (analyst)", "IPART long-run estimate", "Workstation estimate"),
                `URL / reference` = c(rep(paste0("https://finance.yahoo.com/quote/", b$symbol, "/financials"), 3), paste0("https://finance.yahoo.com/quote/", b$symbol, "/history"), "", "", "https://www.rba.gov.au/statistics/", "https://www.ipart.nsw.gov.au/", ""),
                `Date accessed` = format(Sys.Date(), "%d %b %Y"), Analyst = if (nzchar(pkg$notes$analysts)) pkg$notes$analysts else "", `Assumption rationale` = "")
  xl_table(wb, sh, src, 5)
  setColWidths(wb, sh, cols = 1:9, widths = c(30, 26, 20, 26, 40, 48, 14, 20, 30))

  flush_styles()
  saveWorkbook(wb, file, overwrite = TRUE)
  xl_finalise(file)
  invisible(file)
}

# ===========================================================================
# 3. Ratio Guide — one company per row, formulas on sheet 2
# ===========================================================================
ratio_guide_formulas <- tibble::tribble(
  ~Metric, ~`Formula / treatment`, ~`Interpretation and notes`,
  "P/E", "Share price / LTM diluted EPS", "Positive earnings only; trailing.",
  "Forward P/E", "Share price / forecast EPS", "Analysts should disclose forecast year.",
  "P/B", "Equity market capitalisation / book equity", "Book equity should be positive.",
  "EV/EBITDA", "Enterprise value / EBITDA", "EV = market cap + debt − cash + minority interest + preferreds.",
  "EV/EBIT", "Enterprise value / EBIT", "Use normalised earnings where relevant.",
  "FCF yield", "Levered free cash flow / equity market cap", "FCF should be cash flow to equity; clarify if using unlevered.",
  "Dividend yield", "Dividends per share / share price", "Use annualised dividends.",
  "PEG", "P/E / (EPS growth rate as percentage points)", "E.g. P/E 15 and EPS CAGR 10% → PEG 1.5; uses historical CAGR.",
  "ROIC", "NOPAT / invested capital", "Prefer average invested capital if available.",
  "ROE", "Net income / book equity", "Prefer average book equity if available.",
  "ROA", "Net income / total assets", "Prefer average assets if available.",
  "Operating margin", "EBIT / revenue", "Comparable EBIT and revenue periods.",
  "Net margin", "Net income / revenue", "Net earnings margin.",
  "Cash conversion", "Operating cash flow / net income", "Negative earnings can distort interpretation.",
  "ROIC less WACC", "ROIC − WACC", "Shown as percentage-point spread.",
  "Net debt / EBITDA", "(Total debt − cash) / EBITDA", "Net debt may be negative; compare sector norms.",
  "Interest coverage", "EBIT / interest expense", "Positive interest expense input; excluding capitalised interest.",
  "Current ratio", "Current assets / current liabilities", "Liquidity.",
  "Quick ratio", "(Current assets − inventory) / current liabilities", "May need other illiquid current assets adjustment.",
  "Debt due ≤ 2 years", "Input short-term maturities / total debt", "Manual input, not computed from maturity schedule.",
  "Historical CAGR", "(Latest / base)^(1 / elapsed years) − 1", "Calculated only for positive base and latest values.",
  "Forecast CAGR", "(Forecast ending value / latest)^(1 / forecast years) − 1", "Forecast period entered by analyst.",
  "Company vs sector sales growth", "Company historical sales CAGR − sector sales CAGR", "Shown as pp; check data windows match.",
  "EBIT margin change", "Current EBIT/current revenue − historical EBIT/historical revenue", "Historical base margins need comparable period.",
  "Net margin change", "Current NI/current revenue − historical NI/historical revenue", "Historical base margins need comparable period.",
  "FCF / NI", "Free cash flow / net income", "Check cash flow definition and extraordinary items.",
  "Organic sales growth", "Historical organic sales CAGR", "Only if both end-period and base organic sales figures are available.",
  "ROIC trend", "Not automatically calculated", "Evaluate a multi-year time series in detailed research.",
  "Margin expansion", "EBIT / net margin change based on historical base", "Should consider cyclicality and one-offs.",
  "Capital allocation", "Qualitative entry", "Assess reinvestment, buybacks, dividends, acquisitions, ROIC.",
  "Share gains / pricing power", "Qualitative entry", "Document evidence of share gains and pricing power.",
  "Debt maturity profile", "Qualitative entry", "Analyst must document maturity concentration/refinancing."
)

ratio_hist_columns <- c("Company", "Ticker", "Sector", "Currency", "Source / annual report URL",
  paste("Revenue", c("FY-4", "FY-3", "FY-2", "FY-1", "FY0")), paste("EBITDA", c("FY-4", "FY-3", "FY-2", "FY-1", "FY0")), paste("EBIT", c("FY-4", "FY-3", "FY-2", "FY-1", "FY0")),
  paste("Net income", c("FY-4", "FY-3", "FY-2", "FY-1", "FY0")), paste("EPS", c("FY-4", "FY-3", "FY-2", "FY-1", "FY0")), paste("Operating cash flow", c("FY-4", "FY-3", "FY-2", "FY-1", "FY0")),
  paste("Free cash flow", c("FY-4", "FY-3", "FY-2", "FY-1", "FY0")),
  "Share price FY0", "Forward EPS FY+1", "Book value / share FY0", "Shares outstanding (m)", "Market cap (m)", "Enterprise value (m)", "Dividend / share FY0",
  "Total assets FY-1 (m)", "Total assets FY0 (m)", "Equity FY-1 (m)", "Equity FY0 (m)", "Invested capital FY-1 (m)", "Invested capital FY0 (m)", "NOPAT FY-1 (m)", "NOPAT FY0 (m)",
  "WACC FY0 (%)", "Net debt FY0 (m)", "Interest expense FY0 (m)", "Current assets FY0 (m)", "Inventory FY0 (m)", "Current liabilities FY0 (m)", "Current debt maturity FY+1 (m)",
  "Forecast Revenue FY+3 (m)", "Forecast EBITDA FY+3 (m)", "Forecast EBIT FY+3 (m)", "Forecast EPS FY+3", "Sector revenue CAGR (%)", "Market share / pricing power notes")

ratio_row_for <- function(symbol, fin, snap, price, wacc, fcst = NULL, sector_cagr = NA, info = NULL) {
  if (is.null(fin) || nrow(fin) == 0) return(NULL)
  fy0 <- max(fin$fy); m <- match((fy0 - 4):fy0, fin$fy)
  g <- function(col, scale = 1e6) { v <- rep(NA_real_, 5); ok <- !is.na(m); v[ok] <- fin[[col]][m[ok]] / scale; v }
  L <- fin[nrow(fin), ]; P <- if (nrow(fin) > 1) fin[nrow(fin) - 1, ] else L
  M <- 1e6
  vals <- c(list(info$name %||% code_from_symbol(symbol), code_from_symbol(symbol), info$sector %||% "", "AUD", paste0("https://finance.yahoo.com/quote/", symbol, "/financials")),
            as.list(g("revenue")), as.list(g("ebitda")), as.list(g("ebit")), as.list(g("net_income")), as.list(g("eps", 1)), as.list(g("ocf")), as.list(g("fcf")),
            list(price, if (!is.null(fcst$eps1)) fcst$eps1 else NA, n1(L$bvps), n1(L$shares) / M, price * n1(L$shares) / M, (price * n1(L$shares) + coalesce(n1(L$net_debt), 0)) / M, n1(snap$dps),
                 n1(P$total_assets) / M, n1(L$total_assets) / M, n1(P$equity) / M, n1(L$equity) / M, coalesce(n1(P$invested_capital), n1(P$equity) + coalesce(n1(P$net_debt), 0)) / M, coalesce(n1(L$invested_capital), n1(L$equity) + coalesce(n1(L$net_debt), 0)) / M,
                 n1(P$nopat) / M, n1(L$nopat) / M, wacc, n1(L$net_debt) / M, if (!is.na(n1(L$interest_net)) && n1(L$interest_net) < 0) -n1(L$interest_net) / M else NA, (coalesce(n1(L$cash_total), 0) + coalesce(n1(L$receivables), 0)) / M, NA,
                 (coalesce(n1(L$payables), 0) + coalesce(n1(L$current_debt), 0)) / M, n1(L$current_debt) / M,
                 fcst$rev3 %||% NA, fcst$ebitda3 %||% NA, fcst$ebit3 %||% NA, fcst$eps3 %||% NA, sector_cagr, "Approximations: current assets = cash + receivables; current liabilities = payables + current debt."))
  setNames(vals, ratio_hist_columns)
}

export_ratio_guide <- function(pkg, file) {
  wb <- createWorkbook(creator = "MBS Student Investment Fund"); st <- xl_styles(); modifyBaseFont(wb, fontSize = 10, fontName = MBS_FONT)
  b <- pkg$bd; v <- pkg$v; a <- pkg$a
  addWorksheet(wb, "Formula Guide", gridLines = FALSE, tabColour = MBS$primary)
  row <- xl_title(wb, "Formula Guide", "FORMULA & RATIO GUIDE", "All calculations referenced to the Fund's ratio presentation; qualitative items require analyst documentation", note = "Sheet 2 pulls every ratio by formula from sheet 1. Blue-shaded inputs on sheet 1 are populated from Yahoo Finance for the subject company and its peer set; verify against annual reports.")
  xl_table(wb, "Formula Guide", ratio_guide_formulas, row); setColWidths(wb, "Formula Guide", 1:3, c(28, 60, 70))

  addWorksheet(wb, "1 Historical Financials", gridLines = FALSE, tabColour = "#FFF9DB")
  writeData(wb, "1 Historical Financials", "HISTORICAL FINANCIAL INPUTS  |  One company per row", startRow = 1, startCol = 1); addStyle(wb, "1 Historical Financials", st$title, rows = 1, cols = 1)
  writeData(wb, "1 Historical Financials", "Reported figures in millions of reporting currency; EPS, DPS, price and BVPS per share. FY0 = latest reported year. Yellow = input.", startRow = 2, startCol = 1); addStyle(wb, "1 Historical Financials", st$subtitle, rows = 2, cols = 1)
  # Subject + peers
  fcst <- if (v$family == "industrial" && !is.null(v$dcf)) list(rev3 = v$dcf$schedule$revenue[3] / 1e6, ebitda3 = v$dcf$schedule$ebitda[3] / 1e6, ebit3 = v$dcf$schedule$ebit[3] / 1e6, eps3 = NA, eps1 = NA) else if (!is.null(v$ddm)) list(eps1 = v$ddm$schedule$eps[1], eps3 = v$ddm$schedule$eps[3]) else NULL
  sector_cagr <- if (!is.null(pkg$peers)) median(pkg$peers$table$revenue_cagr, na.rm = TRUE) else NA
  rows <- list(ratio_row_for(b$symbol, b$fin, b$ratios, b$quote$price, if (v$family == "industrial") v$wacc else v$ke, fcst, sector_cagr, b$info))
  if (!is.null(pkg$peers)) for (s in setdiff(pkg$peers$symbols, b$symbol)) {
    fin_s <- pkg$peers$fins[[s]]; snap <- pkg$peers$table[pkg$peers$table$ticker == s, ]
    if (!is.null(fin_s) && nrow(snap)) rows[[length(rows) + 1]] <- ratio_row_for(s, fin_s, snap, snap$price[1], v$ke, NULL, sector_cagr, lookup_company(s))
  }
  rows <- rows[!vapply(rows, is.null, logical(1))]
  df <- bind_rows(lapply(rows, function(x) as_tibble(x)))
  for (nm in names(df)) if (!nm %in% c("Company", "Ticker", "Sector", "Currency", "Source / annual report URL", "Market share / pricing power notes")) df[[nm]] <- suppressWarnings(as.numeric(df[[nm]]))
  kinds <- setNames(rep("num2", ncol(df)), names(df)); kinds[grepl("EPS|price|share FY0|Dividend", names(df))] <- "num3"; kinds["WACC FY0 (%)"] <- "pct2"; kinds["Sector revenue CAGR (%)"] <- "pct"
  xl_table(wb, "1 Historical Financials", df, 4, kinds = kinds, banded = FALSE, highlight = 1)
  setColWidths(wb, "1 Historical Financials", cols = 1:ncol(df), widths = c(30, 8, 20, 8, 44, rep(12, ncol(df) - 5)))

  addWorksheet(wb, "2 Ratio Analysis", gridLines = FALSE)
  writeData(wb, "2 Ratio Analysis", "RATIO ANALYSIS  |  Valuation • Quality • Risk • Growth", startRow = 1, startCol = 1); addStyle(wb, "2 Ratio Analysis", st$title, rows = 1, cols = 1)
  writeData(wb, "2 Ratio Analysis", "All figures pull automatically from '1 Historical Financials' by formula. Blank where inputs are missing or not meaningful.", startRow = 2, startCol = 1); addStyle(wb, "2 Ratio Analysis", st$subtitle, rows = 2, cols = 1)
  H <- function(name) int2col(match(name, ratio_hist_columns))
  hs <- "'1 Historical Financials'!"
  ref <- function(name, r) paste0(hs, H(name), r)
  ratio_cols <- c("Company", "Ticker", "Sector", "P/E", "Forward P/E", "P/B", "EV / EBITDA", "EV / EBIT", "FCF yield", "Dividend yield", "PEG (3Y EPS growth)", "ROIC FY0", "ROIC FY-1", "ROIC trend (pp)", "ROE FY0", "ROA FY0",
                  "Operating margin FY0", "Net margin FY0", "Cash conversion (OCF / NI)", "OCF / EBITDA", "ROIC less WACC (pp)", "Net debt / EBITDA", "Interest coverage (EBIT / interest)", "Current ratio", "Quick ratio",
                  "Revenue 4Y CAGR", "EBITDA 4Y CAGR", "EBIT 4Y CAGR", "Net income 4Y CAGR", "EPS 4Y CAGR", "OCF 4Y CAGR", "FCF 4Y CAGR", "Revenue forecast 3Y CAGR", "EBITDA forecast 3Y CAGR", "EBIT forecast 3Y CAGR", "EPS forecast 3Y CAGR", "Revenue growth vs sector (pp)", "Debt maturity FY+1 / net debt")
  writeData(wb, "2 Ratio Analysis", as.data.frame(matrix(ratio_cols, nrow = 1), stringsAsFactors = FALSE), startRow = 4, startCol = 1, colNames = FALSE)
  addStyle(wb, "2 Ratio Analysis", st$header, rows = 4, cols = seq_along(ratio_cols), gridExpand = TRUE); setRowHeights(wb, "2 Ratio Analysis", 4, 30)
  cagr4 <- function(nm) sprintf("=IFERROR(IF(AND(%s>0,%s>0),(%s/%s)^(1/4)-1,\"\"),\"\")", ref(paste(nm, "FY-4"), "ROW"), ref(paste(nm, "FY0"), "ROW"), ref(paste(nm, "FY0"), "ROW"), ref(paste(nm, "FY-4"), "ROW"))
  cagr3f <- function(fnm, nm) sprintf("=IFERROR(IF(AND(%s>0,%s>0),(%s/%s)^(1/3)-1,\"\"),\"\")", ref(nm, "ROW"), ref(fnm, "ROW"), ref(fnm, "ROW"), ref(nm, "ROW"))
  f <- list(
    "Company" = paste0("=", ref("Company", "ROW")), "Ticker" = paste0("=", ref("Ticker", "ROW")), "Sector" = paste0("=", ref("Sector", "ROW")),
    "P/E" = sprintf("=IFERROR(IF(%s>0,%s/%s,\"\"),\"\")", ref("EPS FY0", "ROW"), ref("Share price FY0", "ROW"), ref("EPS FY0", "ROW")),
    "Forward P/E" = sprintf("=IFERROR(IF(%s>0,%s/%s,\"\"),\"\")", ref("Forward EPS FY+1", "ROW"), ref("Share price FY0", "ROW"), ref("Forward EPS FY+1", "ROW")),
    "P/B" = sprintf("=IFERROR(IF(%s>0,%s/%s,\"\"),\"\")", ref("Book value / share FY0", "ROW"), ref("Share price FY0", "ROW"), ref("Book value / share FY0", "ROW")),
    "EV / EBITDA" = sprintf("=IFERROR(IF(%s>0,%s/%s,\"\"),\"\")", ref("EBITDA FY0", "ROW"), ref("Enterprise value (m)", "ROW"), ref("EBITDA FY0", "ROW")),
    "EV / EBIT" = sprintf("=IFERROR(IF(%s>0,%s/%s,\"\"),\"\")", ref("EBIT FY0", "ROW"), ref("Enterprise value (m)", "ROW"), ref("EBIT FY0", "ROW")),
    "FCF yield" = sprintf("=IFERROR(%s/%s,\"\")", ref("Free cash flow FY0", "ROW"), ref("Market cap (m)", "ROW")),
    "Dividend yield" = sprintf("=IFERROR(%s/%s,\"\")", ref("Dividend / share FY0", "ROW"), ref("Share price FY0", "ROW")),
    "PEG (3Y EPS growth)" = sprintf("=IFERROR(IF(AND(%s>0,%s>0),(%s/%s)/(((%s/%s)^(1/3)-1)*100),\"\"),\"\")", ref("EPS FY-3", "ROW"), ref("EPS FY0", "ROW"), ref("Share price FY0", "ROW"), ref("EPS FY0", "ROW"), ref("EPS FY0", "ROW"), ref("EPS FY-3", "ROW")),
    "ROIC FY0" = sprintf("=IFERROR(%s/AVERAGE(%s,%s),\"\")", ref("NOPAT FY0 (m)", "ROW"), ref("Invested capital FY-1 (m)", "ROW"), ref("Invested capital FY0 (m)", "ROW")),
    "ROIC FY-1" = sprintf("=IFERROR(%s/%s,\"\")", ref("NOPAT FY-1 (m)", "ROW"), ref("Invested capital FY-1 (m)", "ROW")),
    "ROIC trend (pp)" = "=IFERROR((L{ROW}-M{ROW})*100,\"\")",
    "ROE FY0" = sprintf("=IFERROR(%s/AVERAGE(%s,%s),\"\")", ref("Net income FY0", "ROW"), ref("Equity FY-1 (m)", "ROW"), ref("Equity FY0 (m)", "ROW")),
    "ROA FY0" = sprintf("=IFERROR(%s/AVERAGE(%s,%s),\"\")", ref("Net income FY0", "ROW"), ref("Total assets FY-1 (m)", "ROW"), ref("Total assets FY0 (m)", "ROW")),
    "Operating margin FY0" = sprintf("=IFERROR(%s/%s,\"\")", ref("EBIT FY0", "ROW"), ref("Revenue FY0", "ROW")),
    "Net margin FY0" = sprintf("=IFERROR(%s/%s,\"\")", ref("Net income FY0", "ROW"), ref("Revenue FY0", "ROW")),
    "Cash conversion (OCF / NI)" = sprintf("=IFERROR(%s/%s,\"\")", ref("Operating cash flow FY0", "ROW"), ref("Net income FY0", "ROW")),
    "OCF / EBITDA" = sprintf("=IFERROR(%s/%s,\"\")", ref("Operating cash flow FY0", "ROW"), ref("EBITDA FY0", "ROW")),
    "ROIC less WACC (pp)" = sprintf("=IFERROR((L{ROW}-%s)*100,\"\")", ref("WACC FY0 (%)", "ROW")),
    "Net debt / EBITDA" = sprintf("=IFERROR(IF(%s>0,%s/%s,\"\"),\"\")", ref("EBITDA FY0", "ROW"), ref("Net debt FY0 (m)", "ROW"), ref("EBITDA FY0", "ROW")),
    "Interest coverage (EBIT / interest)" = sprintf("=IFERROR(IF(%s>0,%s/%s,\"\"),\"\")", ref("Interest expense FY0 (m)", "ROW"), ref("EBIT FY0", "ROW"), ref("Interest expense FY0 (m)", "ROW")),
    "Current ratio" = sprintf("=IFERROR(%s/%s,\"\")", ref("Current assets FY0 (m)", "ROW"), ref("Current liabilities FY0 (m)", "ROW")),
    "Quick ratio" = sprintf("=IFERROR((%s-N(%s))/%s,\"\")", ref("Current assets FY0 (m)", "ROW"), ref("Inventory FY0 (m)", "ROW"), ref("Current liabilities FY0 (m)", "ROW")),
    "Revenue 4Y CAGR" = cagr4("Revenue"), "EBITDA 4Y CAGR" = cagr4("EBITDA"), "EBIT 4Y CAGR" = cagr4("EBIT"), "Net income 4Y CAGR" = cagr4("Net income"), "EPS 4Y CAGR" = cagr4("EPS"), "OCF 4Y CAGR" = cagr4("Operating cash flow"), "FCF 4Y CAGR" = cagr4("Free cash flow"),
    "Revenue forecast 3Y CAGR" = cagr3f("Forecast Revenue FY+3 (m)", "Revenue FY0"), "EBITDA forecast 3Y CAGR" = cagr3f("Forecast EBITDA FY+3 (m)", "EBITDA FY0"), "EBIT forecast 3Y CAGR" = cagr3f("Forecast EBIT FY+3 (m)", "EBIT FY0"), "EPS forecast 3Y CAGR" = cagr3f("Forecast EPS FY+3", "EPS FY0"),
    "Revenue growth vs sector (pp)" = sprintf("=IFERROR((Z{ROW}-%s)*100,\"\")", ref("Sector revenue CAGR (%)", "ROW")),
    "Debt maturity FY+1 / net debt" = sprintf("=IFERROR(%s/%s,\"\")", ref("Current debt maturity FY+1 (m)", "ROW"), ref("Net debt FY0 (m)", "ROW")))
  pct_cols <- c("FCF yield", "Dividend yield", "ROIC FY0", "ROIC FY-1", "ROE FY0", "ROA FY0", "Operating margin FY0", "Net margin FY0", grep("CAGR", ratio_cols, value = TRUE))
  for (j in seq_along(ratio_cols)) {
    fms <- vapply(seq_len(nrow(df)), function(i) gsub("ROW", as.character(4 + i), f[[ratio_cols[j]]], fixed = TRUE), character(1))
    writeFormula(wb, "2 Ratio Analysis", fms, startCol = j, startRow = 5)
    sty <- if (ratio_cols[j] %in% pct_cols) st$formula_pct else if (j <= 3) st$label else st$formula_num2
    addStyle(wb, "2 Ratio Analysis", sty, rows = 4 + seq_len(nrow(df)), cols = j, gridExpand = TRUE)
    addStyle(wb, "2 Ratio Analysis", createStyle(fontName = MBS_FONT, fontSize = 10, fontColour = MBS$dark, textDecoration = "bold", fgFill = "#F7D9E4", halign = if (j <= 3) "left" else "right", numFmt = if (ratio_cols[j] %in% pct_cols) "0.0%" else if (j <= 3) "GENERAL" else "#,##0.00"), rows = 5, cols = j)
  }
  setColWidths(wb, "2 Ratio Analysis", cols = seq_along(ratio_cols), widths = c(30, 8, 20, rep(11, length(ratio_cols) - 3)))
  saveWorkbook(wb, file, overwrite = TRUE)
  xl_finalise(file)
  invisible(file)
}

# ===========================================================================
# 4. Sector / screener workbook
# ===========================================================================
export_sector_workbook <- function(sector, file, subject = NULL) {
  wb <- createWorkbook(creator = "MBS Student Investment Fund"); st <- xl_styles(); modifyBaseFont(wb, fontSize = 10, fontName = MBS_FONT)
  t <- sector$table
  addWorksheet(wb, "Sector Table", gridLines = FALSE, tabColour = MBS$primary)
  row <- xl_title(wb, "Sector Table", paste0("Sector comparables — ", sector$name), paste0(nrow(t %||% tibble()), " companies · live prices with latest fiscal-year fundamentals · ", format(Sys.time(), "%d %b %Y %H:%M")))
  if (!is.null(t) && nrow(t)) {
    if (!"score_total" %in% names(t)) t <- composite_scores(t)
    d <- t %>% arrange(desc(market_cap)) %>% transmute(Code = code, Company = name, Sector = sector, Industry = industry, Price = price, `Market cap ($m)` = market_cap / 1e6, `P/E` = pe_ratio, `P/B` = pb_ratio, `EV/EBITDA` = ev_ebitda, `EV/Revenue` = ev_revenue, `Dividend yield` = dividend_yield, `Grossed-up yield` = grossed_yield,
                                                        ROE = roe, ROA = roa, ROIC = roic, `Net margin` = net_margin, `EBIT margin` = ebit_margin, `Net debt/EBITDA` = net_debt_ebitda, Payout = payout, `Revenue CAGR` = revenue_cagr, `EPS CAGR` = eps_cagr, `1y return` = return_1y,
                                                        Quality = score_quality, Value = score_value, Growth = score_growth, Momentum = score_momentum, Composite = score_total, FY = fy_label)
    row <- xl_table(wb, "Sector Table", d, row, kinds = c(Price = "money", `Market cap ($m)` = "num0", `P/E` = "x", `P/B` = "x2", `EV/EBITDA` = "x", `EV/Revenue` = "x2", `Dividend yield` = "pct2", `Grossed-up yield` = "pct2", ROE = "pct", ROA = "pct2", ROIC = "pct", `Net margin` = "pct", `EBIT margin` = "pct", `Net debt/EBITDA` = "x", Payout = "pct", `Revenue CAGR` = "pct", `EPS CAGR` = "pct", `1y return` = "pct", Quality = "pct", Value = "pct", Growth = "pct", Momentum = "pct", Composite = "pct"),
                    highlight = if (!is.null(subject)) which(d$Code == subject) else NULL)
    xl_widths(wb, "Sector Table", c(8, 32, 20, 26, rep(12, 24)))
    addWorksheet(wb, "Industry Medians", gridLines = FALSE)
    row <- xl_title(wb, "Industry Medians", "Industry medians", "Median of each metric by GICS-style industry")
    m <- t %>% group_by(Industry = industry) %>% summarise(Companies = n(), `Market cap ($m)` = sum(market_cap, na.rm = TRUE) / 1e6, `P/E` = median(pe_ratio, na.rm = TRUE), `P/B` = median(pb_ratio, na.rm = TRUE), `EV/EBITDA` = median(ev_ebitda, na.rm = TRUE), `Dividend yield` = median(dividend_yield, na.rm = TRUE), ROE = median(roe, na.rm = TRUE), `Net margin` = median(net_margin, na.rm = TRUE), `Revenue CAGR` = median(revenue_cagr, na.rm = TRUE), `1y return` = median(return_1y, na.rm = TRUE), .groups = "drop") %>% arrange(desc(`Market cap ($m)`))
    xl_table(wb, "Industry Medians", m, row, kinds = c(`Market cap ($m)` = "num0", `P/E` = "x", `P/B` = "x2", `EV/EBITDA` = "x", `Dividend yield` = "pct2", ROE = "pct", `Net margin` = "pct", `Revenue CAGR` = "pct", `1y return` = "pct"))
    xl_widths(wb, "Industry Medians", c(34, rep(13, 10)))
  } else { writeData(wb, "Sector Table", "No sector data loaded.", startRow = row, startCol = 1) }
  saveWorkbook(wb, file, overwrite = TRUE)
  xl_finalise(file)
  invisible(file)
}

# ===========================================================================
# 6. Bundle
# ===========================================================================
export_bundle <- function(pkg, file) {
  dir <- tempfile("mbs_bundle"); dir.create(dir)
  code <- pkg$bd$code; d <- format(Sys.Date(), "%Y%m%d")
  paths <- c(
    file.path(dir, paste0(code, "_MBS_SIF_Research_", d, ".xlsx")),
    file.path(dir, paste0(code, "_Junior_Analyst_Model_", d, ".xlsx")),
    file.path(dir, paste0(code, "_Ratio_Guide_", d, ".xlsx")),
    file.path(dir, paste0(code, "_Investment_Recommendation_", d, ".docx")))
  export_company_workbook(pkg, paths[1]); export_financial_model(pkg, paths[2]); export_ratio_guide(pkg, paths[3])
  research_note_docx(pkg, paths[4])
  if (!is.null(pkg$sector)) { p <- file.path(dir, paste0("MBS_SIF_Sector_", gsub("[^A-Za-z0-9]", "_", pkg$sector$name), "_", d, ".xlsx")); export_sector_workbook(pkg$sector, p, subject = code); paths <- c(paths, p) }
  zip::zip(file, files = basename(paths), root = dir, mode = "cherry-pick")
  invisible(file)
}
