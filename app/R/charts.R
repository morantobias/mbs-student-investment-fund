# ===========================================================================
# Chart library — plotly, MBS-branded. Every chart ships a hover layer, a
# single y-axis, hairline solid grids, thin marks and a legend for >= 2 series.
# ===========================================================================

.font <- list(family = MBS_FONT_STACK, size = 12, color = MBS$black)
.grid <- "#ECE3E8"

# Thin a daily series to at most `max_points` rows for display. Plotly's JSON
# serialisation scales linearly with point count, so long history windows are
# decimated for the chart only (statistics are always computed on full data).
thin <- function(df, max_points = 400) {
  if (is.null(df) || nrow(df) <= max_points) return(df)
  idx <- unique(round(seq(1, nrow(df), length.out = max_points)))
  df[idx, , drop = FALSE]
}

mbs_layout <- function(p, title = NULL, xlab = NULL, ylab = NULL, yfmt = NULL, xfmt = NULL,
                       legend = TRUE, margin_l = 50, margin_b = 40, hovermode = "x unified",
                       height = NULL, configure = TRUE, ...) {
  p <- plotly::layout(p,
    title = if (!is.null(title)) list(text = paste0("<b>", title, "</b>"), x = 0, xanchor = "left",
                                      font = list(family = MBS_FONT_STACK, size = 14, color = MBS$primary)) else NULL,
    font = .font,
    paper_bgcolor = "rgba(0,0,0,0)", plot_bgcolor = "rgba(0,0,0,0)",
    xaxis = list(title = list(text = xlab %||% ""), gridcolor = .grid, zeroline = FALSE, showline = FALSE,
                 tickfont = list(size = 11, color = MBS$grey), tickformat = xfmt, fixedrange = FALSE),
    yaxis = list(title = list(text = ylab %||% ""), gridcolor = .grid, zeroline = FALSE, showline = FALSE,
                 tickfont = list(size = 11, color = MBS$grey), tickformat = yfmt, fixedrange = FALSE),
    legend = list(orientation = "h", x = 0, y = -0.18, font = list(size = 11, color = MBS$grey),
                  bgcolor = "rgba(0,0,0,0)"),
    showlegend = legend,
    hovermode = hovermode,
    hoverlabel = list(bgcolor = "#FFFFFF", bordercolor = MBS$border, font = list(family = MBS_FONT_STACK, size = 12, color = MBS$black)),
    margin = list(l = margin_l, r = 20, t = if (!is.null(title)) 40 else 15, b = margin_b),
    height = height,
    ...
  )
  if (!configure) return(p)
  plotly::config(p, displaylogo = FALSE, displayModeBar = FALSE,
                 modeBarButtonsToRemove = c("lasso2d", "select2d", "autoScale2d", "toggleSpikelines", "hoverCompareCartesian", "hoverClosestCartesian"),
                 toImageButtonOptions = list(format = "png", filename = "mbs_sif_chart", scale = 2))
}

empty_chart <- function(msg = "No data available") {
  # a trace-less figure makes plotly warn on build, so park an invisible point in the corner
  plotly::plot_ly(x = 0, y = 0, type = "scatter", mode = "markers",
                  marker = list(opacity = 0), hoverinfo = "skip", showlegend = FALSE) %>%
    plotly::layout(xaxis = list(visible = FALSE, range = c(-0.05, 1)), yaxis = list(visible = FALSE, range = c(-0.05, 1)),
                   annotations = list(text = msg, showarrow = FALSE, font = list(color = MBS$grey, size = 13)),
                   paper_bgcolor = "rgba(0,0,0,0)", plot_bgcolor = "rgba(0,0,0,0)") %>%
    plotly::config(displayModeBar = FALSE)
}

# --- Price chart: candles/line + overlays + volume (+ RSI) ------------------------
chart_price <- function(bd, type = c("line", "candle"), overlays = c("sma50", "sma200"), show_volume = TRUE,
                        show_rsi = FALSE, log_scale = FALSE) {
  type <- match.arg(type)
  tech <- bd$tech
  h <- if (!is.null(tech)) tech$series else bd$history
  if (is.null(h) || nrow(h) < 2) return(empty_chart("Price history unavailable"))
  # Candles carry four values per point, so they decimate harder than a line.
  h <- thin(h, if (type == "candle") 240 else 360)
  code <- bd$code
  p <- plotly::plot_ly(h, x = ~date)
  if (type == "candle" && all(c("open", "high", "low") %in% names(h))) {
    p <- plotly::add_trace(p, type = "candlestick", open = ~open, high = ~high, low = ~low, close = ~close,
                           name = code, increasing = list(line = list(color = MBS$positive, width = 1), fillcolor = MBS$positive),
                           decreasing = list(line = list(color = MBS$negative, width = 1), fillcolor = MBS$negative),
                           showlegend = TRUE)
  } else {
    p <- plotly::add_lines(p, y = ~close, name = code, line = list(color = MBS$primary, width = 2),
                           hovertemplate = "%{y:$,.2f}<extra>" %+% code %+% "</extra>")
  }
  ov_cols <- c(sma20 = "SMA 20", sma50 = "SMA 50", sma100 = "SMA 100", sma200 = "SMA 200")
  ov_colours <- c(sma20 = "#eda100", sma50 = "#2a78d6", sma100 = "#6250d6", sma200 = "#eb6834")
  for (o in intersect(overlays, names(ov_cols))) {
    if (o %in% names(h) && any(!is.na(h[[o]])))
      p <- plotly::add_lines(p, y = h[[o]], name = ov_cols[[o]], line = list(color = ov_colours[[o]], width = 1.5),
                             hovertemplate = "%{y:$,.2f}<extra>" %+% ov_cols[[o]] %+% "</extra>")
  }
  if ("bb" %in% overlays && "bb_upper" %in% names(h)) {
    p <- plotly::add_lines(p, y = h$bb_upper, name = "Bollinger (20, 2σ)", line = list(color = MBS$grey2, width = 1),
                           legendgroup = "bb", hovertemplate = "%{y:$,.2f}<extra>BB upper</extra>")
    p <- plotly::add_lines(p, y = h$bb_lower, name = "Bollinger lower", line = list(color = MBS$grey2, width = 1),
                           legendgroup = "bb", showlegend = FALSE, fill = "tonexty", fillcolor = "rgba(140,140,140,0.08)",
                           hovertemplate = "%{y:$,.2f}<extra>BB lower</extra>")
  }
  multi <- show_volume || show_rsi
  p <- mbs_layout(p, ylab = paste0("Price (", bd$quote$currency %||% "AUD", ")"), yfmt = "$,.2f",
                  margin_b = 30, hovermode = "x unified", configure = !multi)
  p <- plotly::layout(p, xaxis = list(rangeslider = list(visible = FALSE), gridcolor = .grid),
                      yaxis = list(type = if (log_scale) "log" else "linear", gridcolor = .grid))
  panels <- list(p); heights <- c(1)
  if (show_volume && "volume" %in% names(h)) {
    keepv <- !is.na(h$volume)
    hv <- h[keepv, ]
    up <- c(TRUE, diff(h$close) >= 0)[keepv]
    vcol <- ifelse(up, "rgba(30,122,70,0.55)", "rgba(192,57,43,0.55)")
    pv <- plotly::plot_ly(hv, x = ~date, y = ~volume, type = "bar", marker = list(color = vcol, line = list(width = 0)),
                          name = "Volume", hovertemplate = "%{y:,.0f}<extra>Volume</extra>", showlegend = FALSE)
    pv <- plotly::layout(pv, yaxis = list(title = "Volume", gridcolor = .grid, tickformat = ".2s", tickfont = list(size = 10, color = MBS$grey)),
                         xaxis = list(gridcolor = .grid), bargap = 0.3)
    panels <- c(panels, list(pv)); heights <- c(0.72, 0.28)
  }
  if (show_rsi && "rsi14" %in% names(h)) {
    # rsi14 is undefined for the first 14 sessions; plotly warns about the NA rows it drops
    hr <- h[!is.na(h$rsi14), ]
    pr <- plotly::plot_ly(hr, x = ~date, y = ~rsi14, type = "scatter", mode = "lines", name = "RSI (14)",
                          line = list(color = "#6250d6", width = 1.5), hovertemplate = "%{y:.1f}<extra>RSI 14</extra>", showlegend = FALSE)
    pr <- plotly::layout(pr, yaxis = list(title = "RSI", range = c(0, 100), gridcolor = .grid, tickfont = list(size = 10, color = MBS$grey)),
                         shapes = list(
                           list(type = "line", x0 = min(h$date), x1 = max(h$date), y0 = 70, y1 = 70, line = list(color = MBS$grey3, width = 1)),
                           list(type = "line", x0 = min(h$date), x1 = max(h$date), y0 = 30, y1 = 30, line = list(color = MBS$grey3, width = 1))))
    panels <- c(panels, list(pr)); heights <- if (length(panels) == 3) c(0.6, 0.22, 0.18) else c(0.75, 0.25)
  }
  if (length(panels) == 1) return(p)
  out <- plotly::subplot(panels, nrows = length(panels), shareX = TRUE, heights = heights, titleY = TRUE)
  mbs_layout(out, margin_b = 30, hovermode = "x unified") %>%
    plotly::layout(legend = list(orientation = "h", x = 0, y = 1.04, yanchor = "bottom"))
}

`%+%` <- function(a, b) paste0(a, b)

# --- Rebased performance lines -------------------------------------------------------
chart_rebased <- function(long, subject = NULL, bench = "S&P/ASX 200", title = NULL, ylab = "Indexed (start = 100)") {
  if (is.null(long) || nrow(long) == 0) return(empty_chart())
  long <- long[order(long$series, long$date), , drop = FALSE]
  long <- do.call(rbind, lapply(split(long, long$series), thin, max_points = 300))
  series <- unique(long$series)
  cols <- series_colours(series, subject = subject, bench = bench)
  p <- plotly::plot_ly()
  for (s in series) {
    d <- long[long$series == s & !is.na(long$indexed), ]
    if (nrow(d) == 0) next   # gaps in a series otherwise make plotly warn about dropped rows
    is_sub <- !is.null(subject) && s == subject
    p <- plotly::add_lines(p, data = d, x = ~date, y = ~indexed, name = s,
                           line = list(color = unname(cols[s]), width = if (is_sub) 2.5 else if (s %in% bench) 2 else 1.5),
                           hovertemplate = "%{y:.1f}<extra>" %+% s %+% "</extra>")
  }
  mbs_layout(p, title = title, ylab = ylab, yfmt = ",.0f", legend = length(series) > 1)
}

# --- Drawdown area --------------------------------------------------------------------
chart_drawdown <- function(series, name = "Drawdown") {
  if (is.null(series) || !"drawdown" %in% names(series)) return(empty_chart())
  series <- thin(series, 360)
  p <- plotly::plot_ly(series, x = ~date, y = ~drawdown, type = "scatter", mode = "lines", name = name,
                       line = list(color = MBS$negative, width = 1.5), fill = "tozeroy", fillcolor = "rgba(192,57,43,0.10)",
                       hovertemplate = "%{y:.1%}<extra>Drawdown from peak</extra>")
  mbs_layout(p, ylab = "Drawdown from peak", yfmt = ".0%", legend = FALSE)
}

chart_rolling_vol <- function(series) {
  if (is.null(series) || !"roll_vol60" %in% names(series)) return(empty_chart())
  series <- thin(series, 360)
  p <- plotly::plot_ly(series, x = ~date, y = ~roll_vol60, type = "scatter", mode = "lines", name = "60-day vol",
                       line = list(color = "#2a78d6", width = 1.5), hovertemplate = "%{y:.1%}<extra>Annualised 60d volatility</extra>")
  mbs_layout(p, ylab = "Annualised volatility (60d)", yfmt = ".0%", legend = FALSE)
}

# --- Horizontal bars with the subject emphasised ---------------------------------------
chart_hbar <- function(df, label_col, value_col, subject = NULL, fmt = c("num", "pct", "x", "money"),
                       title = NULL, median_line = TRUE, sort = TRUE) {
  fmt <- match.arg(fmt)
  if (is.null(df) || nrow(df) == 0) return(empty_chart())
  d <- tibble::tibble(label = df[[label_col]], value = df[[value_col]])
  d <- d[!is.na(d$value), ]
  if (nrow(d) == 0) return(empty_chart("Metric unavailable for this peer set"))
  if (sort) d <- d[order(d$value), ]
  d$colour <- ifelse(!is.null(subject) & d$label == subject, MBS$primary, MBS$grey3)
  htmpl <- switch(fmt, pct = "%{x:.1%}", x = "%{x:.1f}x", money = "%{x:$,.0f}", "%{x:,.2f}")
  tfmt <- switch(fmt, pct = ".0%", x = ".1f", money = "$,.0f", ",.1f")
  text <- switch(fmt, pct = fmt_pct(d$value), x = fmt_ratio(d$value), money = fmt_money(d$value), fmt_num(d$value, 2))
  p <- plotly::plot_ly(d, y = ~factor(label, levels = label), x = ~value, type = "bar", orientation = "h",
                       marker = list(color = d$colour, line = list(width = 0)), text = text, textposition = "outside",
                       textfont = list(color = MBS$black, size = 11), cliponaxis = FALSE,
                       hovertemplate = htmpl %+% "<extra>%{y}</extra>", showlegend = FALSE, width = NULL)
  p <- mbs_layout(p, title = title, xfmt = tfmt, legend = FALSE, hovermode = "closest", margin_l = 60)
  p <- plotly::layout(p, bargap = 0.45, yaxis = list(title = list(text = ""), gridcolor = "rgba(0,0,0,0)"), xaxis = list(title = list(text = ""), gridcolor = .grid, tickformat = tfmt))
  if (median_line && nrow(d) > 2) {
    med <- stats::median(d$value)
    # Reference the paper (not the categorical axis) for y so the line survives:
    # plotly drops shapes that mix discrete and continuous axes.
    p <- plotly::layout(p,
      shapes = list(list(type = "line", xref = "x", yref = "paper", x0 = med, x1 = med, y0 = 0, y1 = 1,
                         line = list(color = MBS$grey, width = 1, dash = "dot"))))
  }
  p
}

# --- Multi-year columns (1-3 series) ---------------------------------------------------
chart_columns <- function(fin, cols, labels = cols, fmt = c("money", "num", "pct"), title = NULL, colours = NULL) {
  fmt <- match.arg(fmt)
  if (is.null(fin) || nrow(fin) == 0) return(empty_chart())
  colours <- colours %||% c(MBS$primary, "#2a78d6", "#eda100")
  p <- plotly::plot_ly()
  htmpl <- switch(fmt, money = "%{y:$,.0f}", pct = "%{y:.1%}", "%{y:,.2f}")
  drawn <- 0L
  for (i in seq_along(cols)) {
    y <- fin[[cols[i]]]
    if (fmt == "money") y <- y / 1e6
    keep <- !is.na(y)
    if (!any(keep)) next   # an all-NA series would leave an empty categorical x and break the axis
    drawn <- drawn + 1L
    p <- plotly::add_trace(p, x = fin$label[keep], y = y[keep], type = "bar", name = labels[i],
                           marker = list(color = colours[i], line = list(width = 0)),
                           hovertemplate = (if (fmt == "money") "$%{y:,.0f}m" else htmpl) %+% "<extra>" %+% labels[i] %+% "</extra>")
  }
  if (drawn == 0L) return(empty_chart(paste("No data reported for", paste(labels, collapse = ", "))))
  p <- mbs_layout(p, title = title, ylab = switch(fmt, money = "$ million", pct = NULL, NULL),
                  yfmt = switch(fmt, money = ",.0f", pct = ".0%", ",.2f"), legend = drawn > 1, hovermode = "x unified")
  plotly::layout(p, bargap = 0.35, barmode = "group")
}

# --- Multi-year lines (margins, returns) -----------------------------------------------
chart_lines <- function(fin, cols, labels = cols, fmt = c("pct", "num", "x"), title = NULL, colours = NULL) {
  fmt <- match.arg(fmt)
  if (is.null(fin) || nrow(fin) == 0) return(empty_chart())
  colours <- colours %||% mbs_cat[c(1, 3, 2, 4, 5, 6)]
  p <- plotly::plot_ly()
  htmpl <- switch(fmt, pct = "%{y:.1%}", x = "%{y:.2f}x", "%{y:,.2f}")
  for (i in seq_along(cols)) {
    p <- plotly::add_trace(p, x = fin$label, y = fin[[cols[i]]], type = "scatter", mode = "lines+markers", name = labels[i],
                           line = list(color = colours[i], width = 2), marker = list(color = colours[i], size = 8, line = list(color = "#fff", width = 2)),
                           hovertemplate = htmpl %+% "<extra>" %+% labels[i] %+% "</extra>")
  }
  mbs_layout(p, title = title, yfmt = switch(fmt, pct = ".0%", x = ".1f", ",.1f"), legend = length(cols) > 1, hovermode = "x unified")
}

# --- Scatter (e.g. P/B vs ROE) ---------------------------------------------------------
chart_scatter <- function(df, x, y, label = "code", subject = NULL, xfmt = ".0%", yfmt = ".1f", xlab = NULL, ylab = NULL,
                          title = NULL, fit = TRUE) {
  if (is.null(df) || nrow(df) == 0) return(empty_chart())
  d <- df[!is.na(df[[x]]) & !is.na(df[[y]]), ]
  if (nrow(d) == 0) return(empty_chart("Insufficient data"))
  d$is_sub <- !is.null(subject) & d[[label]] == subject
  p <- plotly::plot_ly()
  peers <- d[!d$is_sub, ]
  if (nrow(peers)) p <- plotly::add_trace(p, data = peers, x = peers[[x]], y = peers[[y]], type = "scatter", mode = "markers+text",
                                          text = peers[[label]], textposition = "top center", textfont = list(size = 10, color = MBS$grey),
                                          marker = list(color = MBS$grey2, size = 10, line = list(color = "#fff", width = 2)), name = "Peers",
                                          hovertemplate = "%{text}<br>" %+% xlab %+% ": %{x:" %+% xfmt %+% "}<br>" %+% ylab %+% ": %{y:" %+% yfmt %+% "}<extra></extra>")
  sub <- d[d$is_sub, ]
  if (nrow(sub)) p <- plotly::add_trace(p, data = sub, x = sub[[x]], y = sub[[y]], type = "scatter", mode = "markers+text",
                                        text = sub[[label]], textposition = "top center", textfont = list(size = 11, color = MBS$black),
                                        marker = list(color = MBS$primary, size = 14, line = list(color = "#fff", width = 2)), name = subject,
                                        hovertemplate = "%{text}<br>" %+% xlab %+% ": %{x:" %+% xfmt %+% "}<br>" %+% ylab %+% ": %{y:" %+% yfmt %+% "}<extra></extra>")
  if (fit && nrow(d) >= 4) {
    m <- tryCatch(stats::lm(d[[y]] ~ d[[x]]), error = function(e) NULL)
    if (!is.null(m)) {
      xs <- seq(min(d[[x]]), max(d[[x]]), length.out = 20)
      ys <- stats::coef(m)[1] + stats::coef(m)[2] * xs
      p <- plotly::add_lines(p, x = xs, y = ys, name = "Peer regression", line = list(color = MBS$grey3, width = 1), hoverinfo = "skip")
    }
  }
  mbs_layout(p, title = title, xlab = xlab, ylab = ylab, xfmt = xfmt, yfmt = yfmt, hovermode = "closest")
}

# --- Football field --------------------------------------------------------------------
chart_football <- function(ff, price, title = NULL) {
  if (is.null(ff) || nrow(ff) == 0) return(empty_chart())
  d <- ff[nrow(ff):1, ]
  d$method <- factor(d$method, levels = d$method)
  d$is_weighted <- d$method == "Weighted fair value"
  p <- plotly::plot_ly()
  # range bars (low -> high), drawn as a bar with base
  p <- plotly::add_trace(p, data = d, type = "bar", orientation = "h", y = ~method, x = ~pmax(high - low, 0.001), base = ~low,
                         marker = list(color = ifelse(d$is_weighted, MBS$primary, "rgba(163,0,70,0.28)"), line = list(width = 0)),
                         hovertemplate = "%{y}<br>Low: $%{base:,.2f}<br>High: $%{x:,.2f}<extra></extra>", showlegend = FALSE,
                         customdata = ~high, text = NULL)
  p <- plotly::add_trace(p, data = d, type = "scatter", mode = "markers", y = ~method, x = ~base, name = "Base value",
                         marker = list(color = MBS$dark, size = 9, symbol = "diamond", line = list(color = "#fff", width = 1.5)),
                         hovertemplate = "%{y}: $%{x:,.2f}<extra>Base</extra>", showlegend = TRUE)
  p <- mbs_layout(p, title = title, xfmt = "$,.0f", hovermode = "closest", margin_l = 190, legend = TRUE)
  if (!is.null(price) && !is.na(price)) {
    p <- plotly::layout(p, shapes = list(list(type = "line", x0 = price, x1 = price, y0 = -0.5, y1 = nrow(d) - 0.5,
                                              line = list(color = MBS$black, width = 1.5))),
                        annotations = list(list(x = price, y = nrow(d) - 0.5, text = paste0("Price ", fmt_price(price)), showarrow = FALSE,
                                                yanchor = "bottom", font = list(size = 11, color = MBS$black))))
  }
  plotly::layout(p, bargap = 0.5, yaxis = list(title = list(text = ""), gridcolor = "rgba(0,0,0,0)", tickfont = list(size = 11)), xaxis = list(title = list(text = ""), gridcolor = .grid))
}

# --- Sensitivity heatmap ---------------------------------------------------------------
chart_heatmap <- function(s2, price, title = NULL) {
  if (is.null(s2) || is.null(s2$matrix)) return(empty_chart("Sensitivity unavailable"))
  m <- s2$matrix
  mos <- m / price - 1
  xl <- fmt_pct(s2$x, 2); yl <- fmt_pct(s2$y, 2)
  text <- matrix(paste0("$", formatC(m, format = "f", digits = 2), "<br>", fmt_pct(mos, signed = TRUE)), nrow = nrow(m))
  lim <- max(abs(range(mos, na.rm = TRUE)), 0.05)
  p <- plotly::plot_ly(x = yl, y = xl, z = mos, type = "heatmap",
                       colorscale = list(c(0, "#C0392B"), c(0.5, "#F0EFEC"), c(1, "#2a78d6")), zmin = -lim, zmax = lim,
                       text = text, texttemplate = "%{text}", textfont = list(size = 11), xgap = 2, ygap = 2,
                       colorbar = list(title = "MoS", tickformat = ".0%", thickness = 10, len = 0.8),
                       hovertemplate = s2$x_label %+% ": %{y}<br>" %+% s2$y_label %+% ": %{x}<br>Value: %{text}<extra></extra>")
  mbs_layout(p, title = title, xlab = s2$y_label, ylab = s2$x_label, hovermode = "closest", margin_l = 70, legend = FALSE) %>%
    plotly::layout(xaxis = list(side = "top", type = "category", gridcolor = "rgba(0,0,0,0)"), yaxis = list(autorange = "reversed", type = "category", gridcolor = "rgba(0,0,0,0)"))
}

# --- Scenario columns -------------------------------------------------------------------
chart_scenarios <- function(scen, price, basis = "fc", title = NULL) {
  if (is.null(scen) || nrow(scen) == 0) return(empty_chart())
  v <- if (basis == "fc") scen$value_fc else scen$value_ex
  mos <- if (basis == "fc") scen$mos_fc else scen$mos_ex
  keep <- !is.na(v)
  if (!any(keep)) return(empty_chart("Scenario values unavailable on this basis"))
  scen <- scen[keep, , drop = FALSE]; v <- v[keep]; mos <- mos[keep]
  cols <- ifelse(scen$scenario == "Probability-weighted", MBS$primary,
                 ifelse(scen$scenario == "Bear", "#eb6834", ifelse(scen$scenario == "Bull", "#1baf7a", "#2a78d6")))
  p <- plotly::plot_ly(x = factor(scen$scenario, levels = scen$scenario), y = v, type = "bar",
                       marker = list(color = cols, line = list(width = 0)),
                       text = paste0(fmt_price(v), "<br>", fmt_pct(mos, signed = TRUE)), textposition = "outside",
                       textfont = list(size = 11, color = MBS$black), cliponaxis = FALSE,
                       hovertemplate = "%{x}: $%{y:,.2f}<extra></extra>", showlegend = FALSE)
  p <- mbs_layout(p, title = title, yfmt = "$,.0f", legend = FALSE, hovermode = "closest")
  if (!is.na(price)) p <- plotly::layout(p, shapes = list(list(type = "line", x0 = -0.5, x1 = nrow(scen) - 0.5, y0 = price, y1 = price,
                                                               line = list(color = MBS$black, width = 1.5))),
                                         annotations = list(list(x = nrow(scen) - 0.5, y = price, text = paste0("Price ", fmt_price(price)), showarrow = FALSE,
                                                                 xanchor = "right", yanchor = "bottom", font = list(size = 11))))
  plotly::layout(p, bargap = 0.45)
}

# --- EV bridge waterfall ------------------------------------------------------------------
chart_bridge <- function(dcf, shares, title = "Enterprise value to equity bridge") {
  if (is.null(dcf)) return(empty_chart("DCF unavailable"))
  a <- dcf$schedule
  items <- c("PV of forecast FCFF", "PV of terminal value", "Enterprise value", "Less net debt", "Non-operating items", "Equity value")
  vals <- c(dcf$pv_fcff_sum, dcf$pv_terminal, dcf$enterprise_value,
            -(dcf$enterprise_value - dcf$equity_value - 0), 0, dcf$equity_value) / 1e6
  measure <- c("relative", "relative", "total", "relative", "relative", "total")
  p <- plotly::plot_ly(type = "waterfall", x = items, y = vals, measure = measure,
                       connector = list(line = list(color = MBS$grey3, width = 1)),
                       increasing = list(marker = list(color = MBS$primary)), decreasing = list(marker = list(color = "#eb6834")),
                       totals = list(marker = list(color = MBS$dark)),
                       text = fmt_money(vals * 1e6), textposition = "outside", textfont = list(size = 11), cliponaxis = FALSE,
                       hovertemplate = "%{x}: $%{y:,.0f}m<extra></extra>")
  mbs_layout(p, title = title, ylab = "$ million", yfmt = ",.0f", legend = FALSE, hovermode = "closest")
}

# --- Dividend history ------------------------------------------------------------------------
chart_dividends <- function(divs, title = "Dividends per share (inferred from price adjustments)") {
  if (is.null(divs) || nrow(divs) == 0) return(empty_chart("No dividends detected in the selected window"))
  d <- divs[order(divs$ex_date), ]
  p <- plotly::plot_ly(d, x = ~ex_date, y = ~dps, type = "bar", marker = list(color = MBS$primary, line = list(width = 0)),
                       hovertemplate = "Ex-date %{x|%d %b %Y}<br>$%{y:.3f} per share<extra></extra>", showlegend = FALSE)
  mbs_layout(p, title = title, yfmt = "$,.2f", legend = FALSE, hovermode = "closest") %>% plotly::layout(bargap = 0.6)
}

# --- Returns distribution -----------------------------------------------------------------
chart_return_hist <- function(series) {
  if (is.null(series) || !"ret" %in% names(series)) return(empty_chart())
  r <- series$ret[!is.na(series$ret)]
  p <- plotly::plot_ly(x = r, type = "histogram", nbinsx = 60, marker = list(color = MBS$primary, line = list(color = "#fff", width = 1)),
                       hovertemplate = "Return %{x:.1%}<br>Days: %{y}<extra></extra>", showlegend = FALSE)
  mbs_layout(p, xlab = "Daily return", ylab = "Days", xfmt = ".0%", legend = FALSE, hovermode = "closest")
}

# --- Benchmark board sparks (multi-line rebased) --------------------------------------------
chart_benchmarks <- function(px, labels) {
  if (is.null(px) || nrow(px) == 0) return(empty_chart())
  long <- rebase_long(px, col = "close")
  long$series <- unname(labels[long$symbol])
  chart_rebased(long, subject = NULL, bench = character(0))
}

# --- DCF schedule columns + FCFF line (single axis: $m) ------------------------------------
chart_fcff <- function(dcf) {
  if (is.null(dcf)) return(empty_chart("DCF unavailable"))
  s <- dcf$schedule
  p <- plotly::plot_ly()
  p <- plotly::add_trace(p, x = s$label, y = s$nopat / 1e6, type = "bar", name = "NOPAT", marker = list(color = "#2a78d6", line = list(width = 0)), hovertemplate = "$%{y:,.0f}m<extra>NOPAT</extra>")
  p <- plotly::add_trace(p, x = s$label, y = s$da / 1e6, type = "bar", name = "D&A", marker = list(color = "#1baf7a", line = list(width = 0)), hovertemplate = "$%{y:,.0f}m<extra>D&A</extra>")
  p <- plotly::add_trace(p, x = s$label, y = -s$capex / 1e6, type = "bar", name = "Capex", marker = list(color = "#eb6834", line = list(width = 0)), hovertemplate = "$%{y:,.0f}m<extra>Capex</extra>")
  p <- plotly::add_trace(p, x = s$label, y = -s$delta_nwc / 1e6, type = "bar", name = "ΔNWC", marker = list(color = "#eda100", line = list(width = 0)), hovertemplate = "$%{y:,.0f}m<extra>Change in NWC</extra>")
  p <- plotly::add_trace(p, x = s$label, y = s$fcff / 1e6, type = "scatter", mode = "lines+markers", name = "FCFF",
                         line = list(color = MBS$primary, width = 2.5), marker = list(color = MBS$primary, size = 9, line = list(color = "#fff", width = 2)),
                         hovertemplate = "$%{y:,.0f}m<extra>FCFF</extra>")
  mbs_layout(p, ylab = "$ million", yfmt = ",.0f", hovermode = "x unified") %>% plotly::layout(barmode = "relative", bargap = 0.4)
}

chart_dividend_path <- function(ddm) {
  if (is.null(ddm)) return(empty_chart("Dividend model unavailable"))
  s <- ddm$schedule
  p <- plotly::plot_ly()
  p <- plotly::add_trace(p, x = s$label, y = s$eps, type = "bar", name = "EPS", marker = list(color = "#2a78d6", line = list(width = 0)), hovertemplate = "$%{y:.3f}<extra>EPS</extra>")
  p <- plotly::add_trace(p, x = s$label, y = s$dps, type = "bar", name = "DPS", marker = list(color = MBS$primary, line = list(width = 0)), hovertemplate = "$%{y:.3f}<extra>DPS</extra>")
  p <- plotly::add_trace(p, x = s$label, y = s$dps_grossed, type = "scatter", mode = "lines+markers", name = "DPS incl. franking",
                         line = list(color = MBS$dark, width = 2), marker = list(color = MBS$dark, size = 8, line = list(color = "#fff", width = 2)),
                         hovertemplate = "$%{y:.3f}<extra>Grossed-up DPS</extra>")
  mbs_layout(p, ylab = "$ per share", yfmt = "$,.2f", hovermode = "x unified") %>% plotly::layout(barmode = "group", bargap = 0.35)
}
