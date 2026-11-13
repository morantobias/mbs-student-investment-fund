# Launch the app in a child R process, drive it with chromote and screenshot every tab.
# Usage: Rscript tests/screenshots.R [out_dir]
suppressPackageStartupMessages({ library(chromote); library(callr) })
# Headless Chrome is memory hungry; this box runs the app, Chrome and the editor
# together, so keep the footprint small and capture viewport-sized shots.
chromote::set_chrome_args(c("--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--headless=new",
                            "--disable-extensions", "--js-flags=--max-old-space-size=384"))

args      <- commandArgs(trailingOnly = TRUE)
app_dir   <- normalizePath(getwd())
out_dir   <- if (length(args) >= 1) args[1] else "/tmp/mbs_shots"
dir.create(out_dir, showWarnings = FALSE)
port      <- 7395L

proc <- callr::r_bg(
  function(dir, port) shiny::runApp(dir, port = port, launch.browser = FALSE, host = "127.0.0.1"),
  args = list(dir = app_dir, port = port),
  stdout = "/tmp/mbs_app.log", stderr = "/tmp/mbs_app.log"
)
on.exit(try(proc$kill(), silent = TRUE), add = TRUE)

port_open <- function(p) {
  con <- suppressWarnings(tryCatch(socketConnection("127.0.0.1", p, timeout = 1, open = "r"), error = function(e) NULL))
  if (is.null(con)) return(FALSE)
  close(con); TRUE
}
t0 <- Sys.time()
while (!port_open(port) && as.numeric(Sys.time() - t0, units = "secs") < 150) Sys.sleep(2)
cat("app listening:", port_open(port), "after", round(as.numeric(Sys.time() - t0, units = "secs")), "s\n")

b <- ChromoteSession$new(width = 1440, height = 900)
b$default_timeout <- 180
b$Page$navigate(sprintf("http://127.0.0.1:%d", port), wait_ = FALSE)
b$Page$loadEventFired(timeout_ = 240)

js_eval <- function(js) tryCatch(b$Runtime$evaluate(js)$result$value, error = function(e) NULL)
js_true <- function(js) isTRUE(js_eval(js))

wait_for <- function(js, timeout = 150) {
  t0 <- Sys.time()
  repeat {
    if (js_true(js)) return(TRUE)
    if (as.numeric(Sys.time() - t0, units = "secs") > timeout) return(FALSE)
    Sys.sleep(0.7)
  }
}

# Ready = the active pane has no output still recalculating and no visible spinner.
# Only *visible* outputs matter: outputs on inactive (nested) sub-tabs stay
# suspended with the recalculating class until they are shown.
READY_JS <- "(function(){
  var stuck = Array.from(document.querySelectorAll('.shiny-bound-output.recalculating'))
    .filter(function(e){ return e.offsetParent !== null; });
  if (stuck.length) return false;
  var spinners = Array.from(document.querySelectorAll('.load-container, .shiny-spinner-placeholder'));
  for (var i = 0; i < spinners.length; i++) {
    var el = spinners[i];
    if (el.offsetParent !== null && !el.classList.contains('shiny-spinner-hidden')) return false;
  }
  return true;
})()"

settle <- function(label, timeout = 180) {
  t0 <- Sys.time()
  Sys.sleep(1.2)
  ok <- wait_for(READY_JS, timeout)
  Sys.sleep(1.0)   # let plotly finish its first paint
  cat(sprintf("  %-30s ready=%s in %5.1fs\n", label, ok,
              as.numeric(Sys.time() - t0, units = "secs")))
  invisible(ok)
}

# Viewport shot (full-page capture of a 3,000px dashboard is what exhausted
# Chrome's heap); `scroll` moves to a named element first.
shot <- function(name, scroll = NULL) {
  if (!is.null(scroll)) {
    js_eval(sprintf("(function(){var e=document.querySelector('%s'); if(e) e.scrollIntoView({block:'start'});})()", scroll))
    Sys.sleep(0.6)
  } else {
    js_eval("window.scrollTo(0, 0)")
    Sys.sleep(0.3)
  }
  f <- file.path(out_dir, paste0(name, ".png"))
  b$screenshot(filename = f, show = FALSE, delay = 0.5)
  cat("  shot:", basename(f), "\n")
}

click_tab <- function(value, label = value) {
  js_eval(sprintf("document.querySelector('a.nav-link[data-value=\"%s\"]').click()", value))
  settle(label)
}

# --- Initial load -------------------------------------------------------------
wait_for("(function(){var e=document.querySelector('.mbs-strip .code'); return !!e;})()", 120)
settle("overview + peers", 240)
shot("01_overview")

click_tab("market");     shot("02_market")
shot("02b_market_lower", scroll = ".mbs-card:nth-of-type(4)")
click_tab("financials"); shot("03_financials")
shot("03b_financials_lower", scroll = "#balance_dt")
click_tab("ratios");     shot("04_ratios")
click_tab("peers");      shot("05_peers")
shot("05b_peers_lower", scroll = "#peer_dt")
click_tab("valuation");  shot("06_valuation")

for (tab in c("Intrinsic model", "Scenarios", "Sensitivity")) {
  js_eval(sprintf("Array.from(document.querySelectorAll('#val_tabs a.nav-link')).find(a => a.textContent.trim()==='%s').click()", tab))
  settle(tab)
  shot(paste0("06_valuation_", gsub(" ", "_", tolower(tab))))
  shot(paste0("06_valuation_", gsub(" ", "_", tolower(tab)), "_lower"), scroll = "#val_tabs")
}

click_tab("sector")
js_eval("document.getElementById('sector_load').click()")
cat("  sector loaded:", wait_for("(function(){var e=document.querySelector('#sector_dt table'); return !!e;})()", 240), "\n")
settle("sector screen")
shot("07_sector")

click_tab("bench");  shot("08_benchmarks")
click_tab("export"); shot("09_export")

# --- Industrial company for contrast ------------------------------------------
js_eval("(function(){var s=$('#company')[0].selectize; s.addOption({value:'BHP.AX', text:'BHP'}); s.setValue('BHP.AX'); document.getElementById('go').click();})()")
cat("  BHP loaded:", wait_for("(function(){var e=document.querySelector('.mbs-strip .code'); return !!e && e.textContent==='BHP';})()", 180), "\n")
click_tab("overview", "bhp overview"); settle("bhp overview + peers", 240)
shot("10_bhp_overview")
click_tab("valuation"); shot("11_bhp_valuation")
js_eval("Array.from(document.querySelectorAll('#val_tabs a.nav-link')).find(a => a.textContent.trim()==='Intrinsic model').click()")
settle("bhp intrinsic"); shot("12_bhp_intrinsic")
click_tab("market"); shot("13_bhp_market")

b$close()
proc$kill()
cat("\napp log tail:\n"); cat(tail(readLines("/tmp/mbs_app.log"), 12), sep = "\n")
