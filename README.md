# MBS Student Investment Fund — Equity Research Workstation

A two-part equity research toolkit for the Melbourne Business School Student
Investment Fund:

- **`app/`** — R Shiny app (sector screener, peer comparison, valuation engine,
  and MBS-branded Excel/Word export pipeline).
- **`webapp/`** — React + TypeScript + Vite web app (API server plus front-end).

Both apps consume Yahoo Finance market data (via `yahoofinancer` in R and the
API server in the web app) for **educational use only** — nothing here
constitutes financial product advice.

## Shiny app

Requirements: R with the packages used in `app/global.R` (`shiny`, `bslib`,
`yahoofinancer`, `dplyr`, `purrr`, `plotly`, `DT`, `openxlsx`, `rhandsontable`,
`cachem`, `later`, `jsonlite`, `httr`) and Python 3 with `python-docx` for the
Word research-note pipeline.

```bash
cd app
Rscript -e 'shiny::runApp(".", port = 3838, host = "127.0.0.1", launch.browser = FALSE)'
```

## Web app

```bash
cd webapp
npm install
npm run dev        # API + front end (development)
npm run build      # production build
npm test           # unit tests
```

## Repository layout

- `app/R`, `app/server`, `app/ui.R`, `app/www` — Shiny application
- `app/py/build_note.py` — Word research-note generator (python-docx)
- `webapp/src`, `webapp/server`, `webapp/api` — React front end and API server
- `build_mbs_docx.py`, `build_sector_summary.py` — standalone Word/Excel report
  builders
- `Analysis Templates/` — Excel templates referenced by the export pipeline
