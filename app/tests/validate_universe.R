# Validate every universe ticker against Yahoo Finance (one batch call).
suppressPackageStartupMessages({library(yahoofinancer); library(dplyr)})
source(file.path(dirname(dirname(normalizePath(sys.frame(1)$ofile %||% "tests/validate_universe.R"))), "R/brand.R"))
