# One-time dependency installer for Posit Cloud (and any fresh R environment).
# Run from the app directory once before launching the app:
#   Rscript install.R
# or in the RStudio/Posit Cloud console: source("install.R")
pkgs <- c(
  "shiny", "bslib", "htmltools",
  "dplyr", "tidyr", "purrr", "stringr", "tibble",
  "DT", "plotly", "openxlsx", "rhandsontable", "shinycssloaders",
  "yahoofinancer", "cachem", "later", "jsonlite", "httr", "rlang", "zoo", "zip"
)

missing <- pkgs[!vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing) > 0) {
  cat("Installing:", paste(missing, collapse = ", "), "\n")
  install.packages(missing, repos = "https://cloud.r-project.org")
} else {
  cat("All R packages already installed.\n")
}
