import { describe, expect, it } from "vitest";
import {
  BENCH_COLOUR,
  CAT,
  cagr,
  clamp,
  correlation,
  covariance,
  divColours,
  fmtBps,
  fmtDate,
  fmtInt,
  fmtMoney,
  fmtNum,
  fmtPct,
  fmtPrice,
  fmtRatio,
  fmtShortDate,
  fyLabel,
  mean,
  median,
  n1,
  quantile,
  safeDiv,
  sd,
  seqColours,
  seriesColours,
} from "./brand";

describe("math helpers", () => {
  it("safeDiv divides and guards zero / non-numeric", () => {
    expect(safeDiv(10, 2)).toBe(5);
    expect(safeDiv(0, 2)).toBe(0);
    expect(safeDiv(1, 0)).toBeNull();
    expect(safeDiv(null, 2)).toBeNull();
    expect(safeDiv(10, null)).toBeNull();
  });

  it("cagr compounds over the given span", () => {
    expect(cagr([100, 121])).toBeCloseTo(0.21, 8);
    expect(cagr([100, 110, 121], 2)).toBeCloseTo(0.1, 8);
    expect(cagr([100, null, 121], 2)).toBeCloseTo(0.1, 8);
    expect(cagr([100])).toBeNull();
    expect(cagr([-100, 200])).toBeNull();
    expect(cagr([0, 100])).toBeNull();
  });

  it("median and mean filter nulls", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([null, 5, null])).toBe(5);
    expect(median([])).toBeNull();
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([null, 2, 4])).toBe(3);
    expect(mean([])).toBeNull();
  });

  it("quantile matches R's type-7 interpolation", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10);
    expect(quantile([1, 2, 3, 4], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4], 1)).toBe(4);
    expect(quantile([7], 0.5)).toBe(7);
    expect(quantile([], 0.5)).toBeNull();
  });

  it("sd uses the sample (n-1) denominator", () => {
    expect(sd([1, 2, 3])).toBeCloseTo(1, 10);
    expect(sd([2, 2])).toBe(0);
    expect(sd([1, null, 3])).toBeCloseTo(Math.sqrt(2), 10);
    expect(sd([1])).toBeNull();
  });

  it("covariance and correlation handle degenerate inputs", () => {
    expect(covariance([1, 2, 3], [2, 4, 6])).toBeCloseTo(2, 10);
    expect(covariance([1, 2], [3])).toBeNull();
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(correlation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 10);
    expect(correlation([1, 1, 1], [2, 4, 6])).toBeNull();
  });

  it("clamp, n1 and safeDiv coerce sensibly", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(null, 0, 10)).toBe(0);
    expect(clamp("x", 2, 5)).toBe(2);
    expect(n1(null, undefined, "3", 5)).toBe(3);
    expect(n1("abc", null)).toBeNull();
    expect(n1()).toBeNull();
  });
});

describe("formatters", () => {
  it("fmtNum groups thousands and renders en dash for missing", () => {
    expect(fmtNum(1234.5)).toBe("1,234.50");
    expect(fmtNum(1234567, 0)).toBe("1,234,567");
    expect(fmtNum(-5)).toBe("-5.00");
    expect(fmtNum(null)).toBe("–");
    expect(fmtNum(NaN)).toBe("–");
  });

  it("fmtMoney picks bn/m/k scale automatically", () => {
    expect(fmtMoney(1_200_000_000)).toBe("$1.2bn");
    expect(fmtMoney(345_000_000)).toBe("$345.0m");
    expect(fmtMoney(12_300)).toBe("$12.3k");
    expect(fmtMoney(4.56)).toBe("$4.56");
    expect(fmtMoney(-5_000_000)).toBe("-$5.0m");
    expect(fmtMoney(null)).toBe("–");
  });

  it("fmtPrice, fmtPct, fmtRatio and fmtBps format signed values", () => {
    expect(fmtPrice(36.61)).toBe("$36.61");
    expect(fmtPrice(-1.5)).toBe("-$1.50");
    expect(fmtPrice(null)).toBe("–");
    expect(fmtPct(0.0756)).toBe("7.6%");
    expect(fmtPct(0.0756, 2)).toBe("7.56%");
    expect(fmtPct(0.05, 1, true)).toBe("+5.0%");
    expect(fmtRatio(2)).toBe("2.0x");
    expect(fmtRatio(1.5)).toBe("1.5x");
    expect(fmtBps(0.0004)).toBe("+4bp");
    expect(fmtBps(-0.0001)).toBe("-1bp");
    expect(fmtBps(0.00125)).toBe("+13bp");
  });

  it("fmtInt groups thousands", () => {
    expect(fmtInt(1234567)).toBe("1,234,567");
    expect(fmtInt(1234567.6)).toBe("1,234,568");
    expect(fmtInt(null)).toBe("–");
  });

  it("date formatters render en-AU and fiscal-year labels", () => {
    expect(fmtDate("2026-06-30")).toMatch(/^30 (Jun|June) 2026$/);
    expect(fmtShortDate("2026-06-30")).toMatch(/^30 (Jun|June) 26$/);
    expect(fmtDate(null)).toBe("–");
    expect(fmtDate("not-a-date")).toBe("–");
    expect(fyLabel("2026-06-30")).toBe("FY26");
  });
});

describe("colour ramps", () => {
  it("seqColours interpolates from light to dark magenta", () => {
    const cols = seqColours(5);
    expect(cols).toHaveLength(5);
    expect(cols[0]).toBe("#f7e9ef");
    expect(cols[4]).toBe("#5e0028");
    expect(seqColours(1)).toEqual(["#C9739A"]);
  });

  it("divColours returns a signed diverging ramp", () => {
    const cols = divColours(11);
    expect(cols).toHaveLength(11);
    expect(cols[0]).toBe("#c0392b");
    expect(cols[10]).toBe("#2a78d6");
  });

  it("seriesColours puts the subject first and benchmarks in grey", () => {
    const out = seriesColours(["WBC", "CBA", "S&P/ASX 200"], "WBC");
    expect(out["WBC"]).toBe(CAT[0]);
    expect(out["CBA"]).toBe(CAT[1]);
    expect(out["S&P/ASX 200"]).toBe(BENCH_COLOUR);
  });
});
