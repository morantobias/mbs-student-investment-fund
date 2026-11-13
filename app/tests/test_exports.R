# Build every export live for a financial and an industrial; verify the files open.
suppressPackageStartupMessages({ library(shiny) })
source("global.R")
run <- function(sym, peers) {
  cat("\n=== ", sym, " ===\n")
  bd <- load_company(sym, "5y"); stopifnot(isTRUE(bd$ok))
  ps <- load_peer_set(peers, include = sym, period = "1y")
  a <- default_assumptions(bd); v <- run_valuation(bd, ps$table, a)
  sc <- run_scenarios(bd, ps$table, a); s_ke <- sensitivity_1d(bd, ps$table, a, "ke")
  pkg <- list(bd = bd, peers = ps, a = a, v = v, scen = sc,
              sens = list(ke = s_ke, growth = sensitivity_1d(bd, ps$table, a, "growth"), tg = sensitivity_1d(bd, ps$table, a, "tg"), margin = sensitivity_1d(bd, ps$table, a, "margin"), grid = sensitivity_2d(bd, a)),
              ff = football_field(bd, v, sc, s_ke),
              notes = list(analysts = "Test Analyst", rec = "auto", thesis = "Thesis line.", case = "Driver one\nDriver two", risks = "Risk one", catalysts = "Result in Feb", esg = "No exclusions"),
              sector = NULL, generated = Sys.time(),
              headline = list(value = v$weighted_value, mos = v$upside, rec = v$recommendation, basis = v$headline_basis, ke = v$ke, wacc = v$wacc, value_ex = v$weighted_value_ex, value_fc = v$weighted_value_fc, mos_ex = v$mos_ex, mos_fc = v$mos_fc))
  dir <- file.path(tempdir(), "exports"); dir.create(dir, showWarnings = FALSE)
  files <- list(company = file.path(dir, paste0(bd$code, "_research.xlsx")), model = file.path(dir, paste0(bd$code, "_model.xlsx")), ratio = file.path(dir, paste0(bd$code, "_ratio.xlsx")), sector = file.path(dir, paste0(bd$code, "_sector.xlsx")), bundle = file.path(dir, paste0(bd$code, "_bundle.zip")))
  t <- function(nm, expr) { r <- tryCatch({ expr; "ok" }, error = function(e) paste("ERR:", conditionMessage(e))); cat(sprintf("  %-10s %s\n", nm, r)); r == "ok" }
  ok <- c(
    t("company", export_company_workbook(pkg, files$company)),
    t("model", export_financial_model(pkg, files$model)),
    t("ratio", export_ratio_guide(pkg, files$ratio)),
    t("sector", export_sector_workbook(list(name = "Test", table = composite_scores(ps$table)), files$sector, subject = bd$code)),
    t("note", { md <- research_note_md(pkg); stopifnot(nchar(md) > 2000); html <- shiny::markdown(md); stopifnot(grepl("<table", html)) }),
    t("bundle", export_bundle(pkg, files$bundle)))
  for (f in files[1:4]) { wb <- openxlsx::loadWorkbook(f); cat("   ", basename(f), ":", length(names(wb)), "sheets ->", paste(head(names(wb), 6), collapse = ", "), "...\n") }
  cat("    bundle contents:", paste(zip::zip_list(files$bundle)$filename, collapse = ", "), "\n")
  # Check formulas referencing 'Control & Assumptions' are well-formed XML
  tmp <- tempfile(); dir.create(tmp); unzip(files$model, exdir = tmp)
  xmls <- list.files(file.path(tmp, "xl", "worksheets"), pattern = "sheet.*\\.xml$", full.names = TRUE)
  txt <- paste(sapply(xmls, function(f) paste(readLines(f, warn = FALSE), collapse = "")), collapse = "")
  n_f <- lengths(regmatches(txt, gregexpr("<f>", txt)))
  cat("    model formulas:", n_f, " | '&amp;' refs:", lengths(regmatches(txt, gregexpr("Control &amp; Assumptions", txt))), " | raw '&' refs:", lengths(regmatches(txt, gregexpr("Control & Assumptions", txt))), "\n")
  # Recalculate-free sanity: read the DCF sheet formulas back
  f <- openxlsx::readWorkbook(files$model, sheet = "DCF Valuation", colNames = FALSE)
  cat("    DCF sheet rows:", nrow(f), "\n")
  if (!all(ok)) stop("export failures for ", sym)
  invisible(pkg)
}
p1 <- run("WBC.AX", c("CBA", "NAB", "ANZ", "MQG"))
p2 <- run("BHP.AX", c("RIO", "FMG", "S32", "MIN"))
saveRDS(list(wbc = p1, bhp = p2), "/tmp/mbs_fixture2.rds")
cat("\nALL EXPORTS OK\n")
