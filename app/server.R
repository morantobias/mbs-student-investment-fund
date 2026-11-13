# ===========================================================================
# Server — thin shell; logic lives in server/server_*.R partials (sourced into
# this function's environment so they share input/output/session and the
# core reactives defined in server_core.R).
# ===========================================================================
server <- function(input, output, session) {
  for (f in c("core", "overview", "market", "financials", "ratios", "peers",
              "valuation", "sector", "benchmarks", "export"))
    source(file.path("server", paste0("server_", f, ".R")), local = TRUE)
}
