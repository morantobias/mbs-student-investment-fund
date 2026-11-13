# ===========================================================================
# Melbourne Business School — Student Investment Fund
# Equity research workstation (Capital IQ-style) for ASX-listed companies.
#
# global.R: packages, options, brand, universe and all analytics modules.
# ===========================================================================

suppressPackageStartupMessages({
  library(shiny)
  library(bslib)
  library(htmltools)
  library(dplyr)
  library(tidyr)
  library(purrr)
  library(stringr)
  library(tibble)
  library(DT)
  library(plotly)
  library(openxlsx)
  library(rhandsontable)
  library(shinycssloaders)
  library(yahoofinancer)
})

APP_VERSION <- "2.1"
APP_BUILD_DATE <- "10 November 2026"

for (f in c("brand", "universe", "data", "analytics", "valuation", "charts", "ui_components", "exports", "word_note"))
  source(file.path("R", paste0(f, ".R")), local = FALSE)

options(
  spinner.color = MBS$primary, spinner.type = 8, spinner.size = 0.7, spinner.color.background = "#ffffff",
  shiny.sanitize.errors = FALSE,
  DT.options = list(language = list(emptyTable = "No data available", zeroRecords = "No matching rows"))
)

# Fund-level reference settings (editable in the Valuation sidebar)
FUND_DEFAULTS <- list(rf = 4.5, mrp = 6.0, tax = 30, tg = 2.5, kd = 6.0, franking = 100, buy = 10, sell = -5)

DISCLAIMER <- paste(
  "Prepared for the Melbourne Business School Student Investment Fund for educational use only.",
  "Students are not licensed to provide financial product advice under the Corporations Act 2001 (Cth);",
  "nothing here constitutes financial product advice. Data: Yahoo Finance via yahoofinancer, not warranted as accurate or complete."
)
