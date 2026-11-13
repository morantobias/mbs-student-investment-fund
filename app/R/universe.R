# ===========================================================================
# ASX coverage universe — S&P/ASX 200-centric names with GICS-style sector
# and industry labels. Peers are resolved by industry (minus the subject);
# `peers` overrides that default where cross-industry comparison is standard.
#
# Every ticker here was validated against Yahoo Finance on 10 Nov 2026
# (see tests/validate_universe.R).
# ===========================================================================

asx_universe <- tibble::tribble(
  ~code,  ~name,                                     ~sector,                  ~industry,                         ~peers,
  # ---- Financials --------------------------------------------------------------------------
  "CBA",  "Commonwealth Bank of Australia",           "Financials",             "Banks",                           "",
  "WBC",  "Westpac Banking Corporation",              "Financials",             "Banks",                           "",
  "NAB",  "National Australia Bank",                  "Financials",             "Banks",                           "",
  "ANZ",  "ANZ Group Holdings",                       "Financials",             "Banks",                           "",
  "MQG",  "Macquarie Group",                          "Financials",             "Capital Markets",                 "CBA,WBC,NAB,ANZ,ASX,CPU,PNI,GQG",
  "BOQ",  "Bank of Queensland",                       "Financials",             "Banks",                           "",
  "BEN",  "Bendigo and Adelaide Bank",                "Financials",             "Banks",                           "",
  "JDO",  "Judo Capital Holdings",                    "Financials",             "Banks",                           "",
  "ASX",  "ASX Limited",                              "Financials",             "Capital Markets",                 "",
  "CPU",  "Computershare",                            "Financials",             "Capital Markets",                 "",
  "NWL",  "Netwealth Group",                          "Financials",             "Wealth Platforms & Asset Management", "",
  "HUB",  "HUB24",                                    "Financials",             "Wealth Platforms & Asset Management", "",
  "PNI",  "Pinnacle Investment Management",           "Financials",             "Wealth Platforms & Asset Management", "",
  "GQG",  "GQG Partners",                             "Financials",             "Wealth Platforms & Asset Management", "",
  "PPT",  "Perpetual",                                "Financials",             "Wealth Platforms & Asset Management", "",
  "AMP",  "AMP Limited",                              "Financials",             "Wealth Platforms & Asset Management", "",
  "CGF",  "Challenger",                               "Financials",             "Insurance",                       "",
  "SOL",  "Washington H. Soul Pattinson",             "Financials",             "Diversified Financials",          "",
  "AFI",  "Australian Foundation Investment Company", "Financials",             "Diversified Financials",          "",
  "ARG",  "Argo Investments",                         "Financials",             "Diversified Financials",          "",
  "QBE",  "QBE Insurance Group",                      "Financials",             "Insurance",                       "",
  "IAG",  "Insurance Australia Group",                "Financials",             "Insurance",                       "",
  "SUN",  "Suncorp Group",                            "Financials",             "Insurance",                       "",
  "MPL",  "Medibank Private",                         "Financials",             "Insurance",                       "",
  "NHF",  "NIB Holdings",                             "Financials",             "Insurance",                       "",
  "AUB",  "AUB Group",                                "Financials",             "Insurance",                       "",
  "SDF",  "Steadfast Group",                          "Financials",             "Insurance",                       "",
  "HLI",  "Helia Group",                              "Financials",             "Insurance",                       "",
  "ZIP",  "Zip Co",                                   "Financials",             "Consumer Finance",                "CBA,WBC,NAB,ANZ,JDO,HUB",
  "TYR",  "Tyro Payments",                            "Financials",             "Consumer Finance",                "",
  # ---- Materials ---------------------------------------------------------------------------
  "BHP",  "BHP Group",                                "Materials",              "Metals & Mining",                 "",
  "RIO",  "Rio Tinto",                                "Materials",              "Metals & Mining",                 "",
  "FMG",  "Fortescue",                                "Materials",              "Metals & Mining",                 "",
  "S32",  "South32",                                  "Materials",              "Metals & Mining",                 "",
  "MIN",  "Mineral Resources",                        "Materials",              "Metals & Mining",                 "",
  "IGO",  "IGO Limited",                              "Materials",              "Metals & Mining",                 "",
  "PLS",  "Pilbara Minerals",                         "Materials",              "Metals & Mining",                 "",
  "LYC",  "Lynas Rare Earths",                        "Materials",              "Metals & Mining",                 "",
  "ILU",  "Iluka Resources",                          "Materials",              "Metals & Mining",                 "",
  "SFR",  "Sandfire Resources",                       "Materials",              "Metals & Mining",                 "",
  "NEM",  "Newmont Corporation",                      "Materials",              "Gold",                            "",
  "NST",  "Northern Star Resources",                  "Materials",              "Gold",                            "",
  "EVN",  "Evolution Mining",                         "Materials",              "Gold",                            "",
  "GMD",  "Genesis Minerals",                         "Materials",              "Gold",                            "",
  "RRL",  "Regis Resources",                          "Materials",              "Gold",                            "",
  "PRU",  "Perseus Mining",                           "Materials",              "Gold",                            "",
  "CMM",  "Capricorn Metals",                         "Materials",              "Gold",                            "",
  "ORI",  "Orica",                                    "Materials",              "Chemicals",                       "",
  "NUF",  "Nufarm",                                   "Materials",              "Chemicals",                       "",
  "JHX",  "James Hardie Industries",                  "Materials",              "Building Materials",              "",
  "BSL",  "BlueScope Steel",                          "Materials",              "Building Materials",              "",
  "AMC",  "Amcor",                                    "Materials",              "Packaging",                       "",
  "ORA",  "Orora",                                    "Materials",              "Packaging",                       "",
  # ---- Energy ------------------------------------------------------------------------------
  "WDS",  "Woodside Energy Group",                    "Energy",                 "Oil & Gas",                       "",
  "STO",  "Santos",                                   "Energy",                 "Oil & Gas",                       "",
  "BPT",  "Beach Energy",                             "Energy",                 "Oil & Gas",                       "",
  "KAR",  "Karoon Energy",                            "Energy",                 "Oil & Gas",                       "",
  "ALD",  "Ampol",                                    "Energy",                 "Fuel Refining & Marketing",       "",
  "VEA",  "Viva Energy Group",                        "Energy",                 "Fuel Refining & Marketing",       "",
  "WHC",  "Whitehaven Coal",                          "Energy",                 "Coal",                            "",
  "YAL",  "Yancoal Australia",                        "Energy",                 "Coal",                            "",
  "NHC",  "New Hope Corporation",                     "Energy",                 "Coal",                            "",
  "PDN",  "Paladin Energy",                           "Energy",                 "Uranium",                         "",
  "BOE",  "Boss Energy",                              "Energy",                 "Uranium",                         "",
  "WOR",  "Worley",                                   "Energy",                 "Energy Services",                 "MND,DOW,VNT,ALQ",
  # ---- Utilities ---------------------------------------------------------------------------
  "AGL",  "AGL Energy",                               "Utilities",              "Utilities",                       "",
  "ORG",  "Origin Energy",                            "Utilities",              "Utilities",                       "",
  "APA",  "APA Group",                                "Utilities",              "Utilities",                       "",
  "MEZ",  "Meridian Energy",                          "Utilities",              "Utilities",                       "",
  # ---- Industrials -------------------------------------------------------------------------
  "TCL",  "Transurban Group",                         "Industrials",            "Transport Infrastructure",        "",
  "ALX",  "Atlas Arteria",                            "Industrials",            "Transport Infrastructure",        "",
  "AZJ",  "Aurizon Holdings",                         "Industrials",            "Transport Infrastructure",        "",
  "AIA",  "Auckland International Airport",           "Industrials",            "Transport Infrastructure",        "",
  "QAN",  "Qantas Airways",                           "Industrials",            "Airlines",                        "TCL,ALX,AIA,AZJ,QUB",
  "BXB",  "Brambles",                                 "Industrials",            "Commercial Services",             "",
  "CWY",  "Cleanaway Waste Management",               "Industrials",            "Commercial Services",             "",
  "ALQ",  "ALS Limited",                              "Industrials",            "Commercial Services",             "",
  "SGH",  "SGH Limited",                              "Industrials",            "Capital Goods",                   "",
  "REH",  "Reece",                                    "Industrials",            "Capital Goods",                   "",
  "RWC",  "Reliance Worldwide Corporation",           "Industrials",            "Capital Goods",                   "",
  "DOW",  "Downer EDI",                               "Industrials",            "Construction & Engineering",      "",
  "MND",  "Monadelphous Group",                       "Industrials",            "Construction & Engineering",      "",
  "VNT",  "Ventia Services Group",                    "Industrials",            "Construction & Engineering",      "",
  # ---- Health Care -------------------------------------------------------------------------
  "CSL",  "CSL Limited",                              "Health Care",            "Biotechnology & Pharmaceuticals", "",
  "TLX",  "Telix Pharmaceuticals",                    "Health Care",            "Biotechnology & Pharmaceuticals", "",
  "RMD",  "ResMed",                                   "Health Care",            "Health Care Equipment",           "",
  "COH",  "Cochlear",                                 "Health Care",            "Health Care Equipment",           "",
  "FPH",  "Fisher & Paykel Healthcare",               "Health Care",            "Health Care Equipment",           "",
  "ANN",  "Ansell",                                   "Health Care",            "Health Care Equipment",           "",
  "PME",  "Pro Medicus",                              "Health Care",            "Health Care Technology",          "RMD,COH,FPH,CSL,WTC,XRO",
  "SHL",  "Sonic Healthcare",                         "Health Care",            "Health Care Services",            "",
  "RHC",  "Ramsay Health Care",                       "Health Care",            "Health Care Services",            "",
  "EBO",  "Ebos Group",                               "Health Care",            "Health Care Services",            "",
  "SIG",  "Sigma Healthcare",                         "Health Care",            "Health Care Services",            "",
  # ---- Consumer Staples --------------------------------------------------------------------
  "WOW",  "Woolworths Group",                         "Consumer Staples",       "Food & Staples Retailing",        "",
  "COL",  "Coles Group",                              "Consumer Staples",       "Food & Staples Retailing",        "",
  "EDV",  "Endeavour Group",                          "Consumer Staples",       "Food & Staples Retailing",        "",
  "MTS",  "Metcash",                                  "Consumer Staples",       "Food & Staples Retailing",        "",
  "TWE",  "Treasury Wine Estates",                    "Consumer Staples",       "Beverages",                       "EDV,A2M,BGA,WOW,COL",
  "A2M",  "The a2 Milk Company",                      "Consumer Staples",       "Food Products",                   "",
  "BGA",  "Bega Cheese",                              "Consumer Staples",       "Food Products",                   "",
  "GNC",  "GrainCorp",                                "Consumer Staples",       "Food Products",                   "",
  "ING",  "Inghams Group",                            "Consumer Staples",       "Food Products",                   "",
  "ELD",  "Elders",                                   "Consumer Staples",       "Food Products",                   "",
  # ---- Consumer Discretionary --------------------------------------------------------------
  "WES",  "Wesfarmers",                               "Consumer Discretionary", "Retailing",                       "",
  "JBH",  "JB Hi-Fi",                                 "Consumer Discretionary", "Retailing",                       "",
  "SUL",  "Super Retail Group",                       "Consumer Discretionary", "Retailing",                       "",
  "PMV",  "Premier Investments",                      "Consumer Discretionary", "Retailing",                       "",
  "HVN",  "Harvey Norman Holdings",                   "Consumer Discretionary", "Retailing",                       "",
  "LOV",  "Lovisa Holdings",                          "Consumer Discretionary", "Retailing",                       "",
  "NCK",  "Nick Scali",                               "Consumer Discretionary", "Retailing",                       "",
  "BAP",  "Bapcor",                                   "Consumer Discretionary", "Retailing",                       "",
  "ARB",  "ARB Corporation",                          "Consumer Discretionary", "Retailing",                       "",
  "BRG",  "Breville Group",                           "Consumer Discretionary", "Consumer Durables",               "JBH,HVN,NCK,ARB,WES",
  "ALL",  "Aristocrat Leisure",                       "Consumer Discretionary", "Gaming & Leisure",                "",
  "TLC",  "The Lottery Corporation",                  "Consumer Discretionary", "Gaming & Leisure",                "",
  "TAH",  "Tabcorp Holdings",                         "Consumer Discretionary", "Gaming & Leisure",                "",
  "DMP",  "Domino's Pizza Enterprises",               "Consumer Discretionary", "Consumer Services",               "",
  "FLT",  "Flight Centre Travel Group",               "Consumer Discretionary", "Consumer Services",               "",
  "WEB",  "Web Travel Group",                         "Consumer Discretionary", "Consumer Services",               "",
  "CTD",  "Corporate Travel Management",              "Consumer Discretionary", "Consumer Services",               "",
  "IEL",  "IDP Education",                            "Consumer Discretionary", "Consumer Services",               "",
  # ---- Communication Services --------------------------------------------------------------
  "TLS",  "Telstra Group",                            "Communication Services", "Telecommunications",              "",
  "TPG",  "TPG Telecom",                              "Communication Services", "Telecommunications",              "",
  "SPK",  "Spark New Zealand",                        "Communication Services", "Telecommunications",              "",
  "REA",  "REA Group",                                "Communication Services", "Interactive Media",               "",
  "SEK",  "SEEK",                                     "Communication Services", "Interactive Media",               "",
  "CAR",  "CAR Group",                                "Communication Services", "Interactive Media",               "",
  "NWS",  "News Corporation",                         "Communication Services", "Media",                           "",
  "NEC",  "Nine Entertainment",                       "Communication Services", "Media",                           "",
  # ---- Information Technology --------------------------------------------------------------
  "XRO",  "Xero",                                     "Information Technology", "Software",                        "",
  "WTC",  "WiseTech Global",                          "Information Technology", "Software",                        "",
  "TNE",  "TechnologyOne",                            "Information Technology", "Software",                        "",
  "SDR",  "SiteMinder",                               "Information Technology", "Software",                        "",
  "IRE",  "Iress",                                    "Information Technology", "Software",                        "",
  "PXA",  "Pexa Group",                               "Information Technology", "Software",                        "",
  "NXT",  "NEXTDC",                                   "Information Technology", "IT Services & Data Centres",      "MP1,WTC,XRO,TNE,GMG",
  "MP1",  "Megaport",                                 "Information Technology", "IT Services & Data Centres",      "NXT,WTC,XRO,TNE,SDR",
  # ---- Real Estate -------------------------------------------------------------------------
  "GMG",  "Goodman Group",                            "Real Estate",            "REITs",                           "",
  "SCG",  "Scentre Group",                            "Real Estate",            "REITs",                           "",
  "VCX",  "Vicinity Centres",                         "Real Estate",            "REITs",                           "",
  "DXS",  "Dexus",                                    "Real Estate",            "REITs",                           "",
  "GPT",  "GPT Group",                                "Real Estate",            "REITs",                           "",
  "MGR",  "Mirvac Group",                             "Real Estate",            "REITs",                           "",
  "SGP",  "Stockland",                                "Real Estate",            "REITs",                           "",
  "CHC",  "Charter Hall Group",                       "Real Estate",            "REITs",                           "",
  "CLW",  "Charter Hall Long WALE REIT",              "Real Estate",            "REITs",                           "",
  "BWP",  "BWP Trust",                                "Real Estate",            "REITs",                           "",
  "CQR",  "Charter Hall Retail REIT",                 "Real Estate",            "REITs",                           "",
  "INA",  "Ingenia Communities Group",                "Real Estate",            "REITs",                           "",
  "ARF",  "Arena REIT",                               "Real Estate",            "REITs",                           "",
  "HMC",  "HMC Capital",                              "Real Estate",            "Real Estate Services",            "CHC,GMG,DXS,MGR,SGP",
  "LLC",  "Lendlease Group",                          "Real Estate",            "Real Estate Services",            "MGR,SGP,DXS,GPT,CHC"
)

asx_universe <- dplyr::mutate(asx_universe, ticker = paste0(code, ".AX"))

# Industry -> valuation model family -------------------------------------------
# bank / insurer / financial : dividend + excess-returns models, no FCFF DCF
# reit                       : distribution model + NTA (P/B) + multiples
# industrial                 : FCFF DCF + multiples (+ dividend model as a cross-check)
model_family_for <- function(industry, sector = NULL) {
  ind <- industry %||% ""
  sec <- sector %||% ""
  if (ind == "Banks") return("bank")
  if (ind == "Insurance") return("insurer")
  if (sec == "Financials") return("financial")
  if (sec == "Real Estate") return("reit")
  "industrial"
}

model_family_label <- c(
  bank = "Bank — dividend discount (franked), excess-returns P/B and peer multiples",
  insurer = "Insurer — dividend discount (franked), excess-returns P/B and peer multiples",
  financial = "Financial — dividend discount (franked), excess-returns P/B and peer multiples",
  reit = "REIT — distribution model, NTA (P/B) and peer multiples",
  industrial = "Industrial — unlevered FCFF DCF, peer multiples and dividend cross-check"
)

# ---------------------------------------------------------------------------
# Benchmarks, rates, FX, commodities
# ---------------------------------------------------------------------------
benchmark_indices <- tibble::tribble(
  ~label,                       ~symbol,   ~kind,
  "S&P/ASX 200",                "^AXJO",   "Equity index",
  "All Ordinaries",             "^AORD",   "Equity index",
  "S&P/ASX 200 Financials",     "^AXFJ",   "Sector index",
  "S&P/ASX 200 Materials",      "^AXMJ",   "Sector index",
  "S&P/ASX 200 Energy",         "^AXEJ",   "Sector index",
  "S&P/ASX 200 Health Care",    "^AXHJ",   "Sector index",
  "S&P/ASX 200 Industrials",    "^AXNJ",   "Sector index",
  "S&P/ASX 200 Cons. Disc.",    "^AXDJ",   "Sector index",
  "S&P/ASX 200 Cons. Staples",  "^AXSJ",   "Sector index",
  "S&P/ASX 200 Info Tech",      "^AXIJ",   "Sector index",
  "S&P/ASX 200 Comm. Services", "^AXTJ",   "Sector index",
  "S&P/ASX 200 Utilities",      "^AXUJ",   "Sector index",
  "S&P/ASX 200 A-REIT",         "^AXPJ",   "Sector index",
  "S&P 500",                    "^GSPC",   "Equity index",
  "Nasdaq Composite",           "^IXIC",   "Equity index",
  "MSCI World (iShares URTH)",  "URTH",    "Equity index",
  "MSCI EM (iShares EEM)",      "EEM",     "Equity index",
  "US 13-week T-bill yield",    "^IRX",    "Rate (%)",
  "US 5-year Treasury yield",   "^FVX",    "Rate (%)",
  "US 10-year Treasury yield",  "^TNX",    "Rate (%)",
  "US 30-year Treasury yield",  "^TYX",    "Rate (%)",
  "CBOE VIX",                   "^VIX",    "Volatility",
  "Gold (COMEX)",               "GC=F",    "Commodity",
  "Copper (COMEX)",             "HG=F",    "Commodity",
  "Crude oil (WTI)",            "CL=F",    "Commodity",
  "Brent crude",                "BZ=F",    "Commodity",
  "Natural gas (Henry Hub)",    "NG=F",    "Commodity",
  "S&P GSCI Commodity",         "^SPGSCI", "Commodity"
)

sector_index_map <- c(
  "Financials" = "^AXFJ", "Materials" = "^AXMJ", "Energy" = "^AXEJ",
  "Health Care" = "^AXHJ", "Industrials" = "^AXNJ",
  "Consumer Discretionary" = "^AXDJ", "Consumer Staples" = "^AXSJ",
  "Information Technology" = "^AXIJ", "Communication Services" = "^AXTJ",
  "Utilities" = "^AXUJ", "Real Estate" = "^AXPJ"
)

fx_pairs <- tibble::tribble(
  ~label,       ~symbol,
  "AUD / USD",  "AUDUSD=X",
  "AUD / NZD",  "AUDNZD=X",
  "AUD / JPY",  "AUDJPY=X",
  "AUD / GBP",  "AUDGBP=X",
  "AUD / EUR",  "AUDEUR=X",
  "AUD / CNY",  "AUDCNY=X",
  "USD / AUD",  "AUD=X"
)

# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------
normalise_ticker <- function(x) {
  x <- toupper(trimws(x %||% ""))
  if (!nzchar(x)) return("")
  if (grepl("\\.[A-Z]{1,3}$", x) || grepl("^\\^", x) || grepl("=", x)) return(x)
  paste0(x, ".AX")
}

code_from_symbol <- function(symbol) sub("\\.AX$", "", toupper(symbol))

lookup_company <- function(symbol) {
  code <- code_from_symbol(symbol)
  row  <- asx_universe[asx_universe$code == code, ]
  if (nrow(row) == 0) {
    return(list(code = code, name = code, sector = "Unclassified", industry = "Unclassified",
                in_universe = FALSE, peers = character(0), family = "industrial"))
  }
  peers <- if (nzchar(row$peers[1])) trimws(strsplit(row$peers[1], ",")[[1]]) else
    setdiff(asx_universe$code[asx_universe$industry == row$industry[1]], code)
  list(code = code, name = row$name[1], sector = row$sector[1], industry = row$industry[1],
       in_universe = TRUE, peers = peers,
       family = model_family_for(row$industry[1], row$sector[1]))
}

default_peers <- function(symbol, max_n = 8) {
  info <- lookup_company(symbol)
  head(info$peers, max_n)
}

sector_codes <- function(sector, exclude = NULL) {
  setdiff(asx_universe$code[asx_universe$sector == sector], exclude)
}

industry_codes <- function(industry, exclude = NULL) {
  setdiff(asx_universe$code[asx_universe$industry == industry], exclude)
}

# Grouped choices for selectize (sector -> "CODE — Name")
universe_choices <- function() {
  u <- asx_universe[order(asx_universe$sector, asx_universe$code), ]
  split(setNames(u$ticker, paste0(u$code, " — ", u$name)), u$sector)
}
