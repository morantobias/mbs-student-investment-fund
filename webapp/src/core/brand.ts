// MBS brand system — colour tokens, chart palette and number formatters.
// Mirrors app/R/brand.R so the web app and the Shiny app stay visually identical.

export const MBS = {
  primary: "#A30046",
  dark: "#5E0028",
  tint: "#F2E3EA",
  tint2: "#FAF3F6",
  border: "#D9BFCB",
  grey: "#595959",
  grey2: "#8C8C8C",
  grey3: "#C9C9C9",
  black: "#212121",
  white: "#FFFFFF",
  surface: "#FBF9FA",
  accent: "#8A0F3E",
  positive: "#1E7A46",
  negative: "#C0392B",
  warning: "#B7791F",
} as const;

export const FONT_STACK =
  '"Calibri", "Carlito", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

/** Fixed categorical slots — never cycled past 8. Slot 1 is always the subject. */
export const CAT = [
  "#A30046",
  "#eda100",
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#6250d6",
  "#e87ba4",
  "#008300",
] as const;

export const BENCH_COLOUR = "#8C8C8C";

/** One-hue sequential ramp built on the brand magenta (light → dark). */
export function seqColours(n = 7): string[] {
  const stops = ["#F7E9EF", "#E3B3C6", "#C9739A", "#A30046", "#5E0028"];
  return interpolate(stops, n);
}

/** Diverging ramp for signed quantities (downside red ← neutral → upside blue). */
export function divColours(n = 11): string[] {
  const stops = ["#C0392B", "#E8A79F", "#F0EFEC", "#9BBFEA", "#2a78d6"];
  return interpolate(stops, n);
}

function interpolate(stops: string[], n: number): string[] {
  if (n <= 1) return [stops[Math.floor(stops.length / 2)]];
  const rgb = stops.map(hexToRgb);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (rgb.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, rgb.length - 1);
    const f = t - lo;
    const mix = rgb[lo].map((c, k) => Math.round(c + (rgb[hi][k] - c) * f));
    return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Assign categorical colours: the subject first, benchmarks in de-emphasis grey. */
export function seriesColours(
  names: string[],
  subject?: string | null,
  bench: string | string[] = "S&P/ASX 200",
): Record<string, string> {
  const benchList = Array.isArray(bench) ? bench : [bench];
  const uniq = [...new Set(names)];
  const out: Record<string, string> = {};
  let slot = 0;
  for (const nm of uniq) {
    if (benchList.includes(nm)) {
      out[nm] = BENCH_COLOUR;
    } else if (subject && nm === subject) {
      out[nm] = CAT[0];
    } else {
      slot += 1;
      out[nm] = CAT[Math.min(slot, CAT.length - 1)];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting. Every helper is null-safe and renders an en dash for missing data.
// ---------------------------------------------------------------------------
export const NA = "–";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fixed(v: number, digits: number): string {
  const neg = v < 0;
  const [i, f] = Math.abs(v).toFixed(digits).split(".");
  const body = f !== undefined && digits > 0 ? `${group(i)}.${f}` : group(i);
  return neg ? `-${body}` : body;
}

export function fmtNum(x: unknown, digits = 2): string {
  return isNum(x) ? fixed(x, digits) : NA;
}

/** Money with an automatic scale: $1.2bn / $345m / $12.3k / $4.56. */
export function fmtMoney(x: unknown, digits = 1, force?: "bn" | "m" | "k"): string {
  if (!isNum(x)) return NA;
  const a = Math.abs(x);
  const sgn = x < 0 ? "-" : "";
  const unit = force ?? (a >= 1e9 ? "bn" : a >= 1e6 ? "m" : a >= 1e3 ? "k" : "");
  const div = unit === "bn" ? 1e9 : unit === "m" ? 1e6 : unit === "k" ? 1e3 : 1;
  return `${sgn}$${fixed(a / div, unit === "" ? 2 : digits)}${unit}`;
}

/** Per-share price: $36.61 */
export function fmtPrice(x: unknown, digits = 2): string {
  if (!isNum(x)) return NA;
  return `${x < 0 ? "-$" : "$"}${fixed(Math.abs(x), digits)}`;
}

export function fmtPct(x: unknown, digits = 1, signed = false): string {
  if (!isNum(x)) return NA;
  const body = `${fixed(x * 100, digits)}%`;
  return signed && x > 0 ? `+${body}` : body;
}

export function fmtRatio(x: unknown, digits = 1, suffix = "x"): string {
  return isNum(x) ? `${fixed(x, digits)}${suffix}` : NA;
}

export function fmtBps(x: unknown): string {
  return isNum(x) ? `${x > 0 ? "+" : ""}${Math.round(x * 1e4)}bp` : NA;
}

export function fmtInt(x: unknown): string {
  return isNum(x) ? group(String(Math.round(x))) : NA;
}

export function fmtCompact(x: unknown): string {
  if (!isNum(x)) return NA;
  return fmtMoney(x, 1);
}

export function fmtDate(x: string | Date | null | undefined): string {
  if (!x) return NA;
  const d = typeof x === "string" ? new Date(x) : x;
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtShortDate(x: string | Date | null | undefined): string {
  if (!x) return NA;
  const d = typeof x === "string" ? new Date(x) : x;
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "2-digit" });
}

/** Fiscal-year label from a period-end date: "FY25". */
export function fyLabel(d: string | Date): string {
  const y = new Date(d).getFullYear();
  return `FY${String(y).slice(2)}`;
}

export function clamp(x: unknown, lo: number, hi: number): number {
  return isNum(x) ? Math.max(lo, Math.min(hi, x)) : lo;
}

/** First finite number from a list, else null. */
export function n1(...xs: unknown[]): number | null {
  for (const x of xs) {
    const v = typeof x === "string" ? Number(x) : x;
    if (isNum(v)) return v;
  }
  return null;
}

export function safeDiv(a: unknown, b: unknown): number | null {
  if (!isNum(a) || !isNum(b) || b === 0) return null;
  const v = a / b;
  return Number.isFinite(v) ? v : null;
}

export function cagr(values: (number | null)[], years?: number): number | null {
  const v = values.filter(isNum);
  if (v.length < 2) return null;
  const first = v[0];
  const last = v[v.length - 1];
  if (first <= 0 || last <= 0) return null;
  const n = years ?? v.length - 1;
  if (n <= 0) return null;
  return Math.pow(last / first, 1 / n) - 1;
}

export function median(xs: (number | null)[]): number | null {
  const v = xs.filter(isNum).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Linear-interpolated quantile, matching R's type-7 default. */
export function quantile(xs: (number | null)[], p: number): number | null {
  const v = xs.filter(isNum).sort((a, b) => a - b);
  if (v.length === 0) return null;
  if (v.length === 1) return v[0];
  const pos = (v.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, v.length - 1);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export function mean(xs: (number | null)[]): number | null {
  const v = xs.filter(isNum);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

/** Sample standard deviation (n − 1), like R's sd(). */
export function sd(xs: (number | null)[]): number | null {
  const v = xs.filter(isNum);
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const ss = v.reduce((a, b) => a + (b - m) ** 2, 0);
  return Math.sqrt(ss / (v.length - 1));
}

export function covariance(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / (n - 1);
}

export function correlation(xs: number[], ys: number[]): number | null {
  const c = covariance(xs, ys);
  const sx = sd(xs);
  const sy = sd(ys);
  if (c === null || sx === null || sy === null || sx === 0 || sy === 0) return null;
  return c / (sx * sy);
}
