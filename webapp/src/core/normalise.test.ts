import { describe, expect, it } from "vitest";
import { inferDividends, rebaseSeries, tidyStatement, ttmDividends } from "./normalise";
import type { RawRow } from "./normalise";
import type { DividendRow, PriceRow } from "./types";

const px = (date: string, close: number, adjClose: number): PriceRow => ({
  date,
  open: close,
  high: close,
  low: close,
  close,
  adjClose,
  volume: null,
});

describe("tidyStatement", () => {
  it("drops invalid dates and keeps the most complete row per year", () => {
    const rows: RawRow[] = [
      { date: "2026-09-30", revenue: "1000", net_income: "100" },
      { date: "2026-09-30", revenue: "1000", net_income: null },
      { date: "not-a-date", revenue: "999" },
    ];
    const out = tidyStatement(rows);
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-09-30");
    expect(out[0].revenue).toBe(1000);
    expect(out[0].net_income).toBe(100);
  });

  it("sorts fiscal years ascending and coerces numerics", () => {
    const rows: RawRow[] = [
      { date: "2025-09-30", revenue: "2" },
      { date: "2024-09-30", revenue: "1" },
    ];
    const out = tidyStatement(rows);
    expect(out.map((r) => r.date)).toEqual(["2024-09-30", "2025-09-30"]);
    expect(out[0].revenue).toBe(1);
  });

  it("handles empty input", () => {
    expect(tidyStatement([])).toEqual([]);
  });
});

describe("inferDividends", () => {
  it("detects an ex-date price drop from the adjClose/close ratio", () => {
    const history = [px("2026-01-05", 10, 9.5), px("2026-01-06", 9.5, 9.5), px("2026-01-07", 9.5, 9.5)];
    const divs = inferDividends(history);
    expect(divs).toHaveLength(1);
    expect(divs[0].exDate).toBe("2026-01-06");
    expect(divs[0].dps).toBeCloseTo(0.5, 4);
  });

  it("ignores jumps outside the plausible dividend band", () => {
    const history = [px("2026-01-05", 10, 5), px("2026-01-06", 10, 10), px("2026-01-07", 10, 10)];
    expect(inferDividends(history)).toEqual([]);
  });

  it("requires at least three rows", () => {
    expect(inferDividends([px("2026-01-05", 10, 10), px("2026-01-06", 10, 10)])).toEqual([]);
  });
});

describe("ttmDividends", () => {
  const divs: DividendRow[] = [
    { exDate: "2025-06-01", dps: 1 },
    { exDate: "2026-01-15", dps: 2 },
    { exDate: "2026-07-01", dps: 3 },
  ];
  const asof = new Date("2026-06-30T00:00:00Z");

  it("sums dividends within the trailing 366 days", () => {
    expect(ttmDividends(divs, asof)).toBeCloseTo(2, 10);
  });

  it("returns null when nothing falls in the window", () => {
    expect(ttmDividends([], asof)).toBeNull();
    expect(ttmDividends([{ exDate: "2024-01-01", dps: 1 }], asof)).toBeNull();
  });
});

describe("rebaseSeries", () => {
  it("indexes each series to 100 at the latest common start", () => {
    const series = [
      { code: "WBC", rows: [px("2026-01-01", 10, 10), px("2026-01-02", 11, 11)] },
      { code: "CBA", rows: [px("2026-01-01", 20, 20), px("2026-01-02", 21, 21)] },
    ];
    const out = rebaseSeries(series);
    expect(out[0].code).toBe("WBC");
    expect(out[0].points[0].value).toBe(100);
    expect(out[0].points[1].value).toBeCloseTo(110, 10);
    expect(out[1].code).toBe("CBA");
    expect(out[1].points[1].value).toBeCloseTo(105, 10);
  });

  it("handles empty input", () => {
    expect(rebaseSeries([])).toEqual([]);
  });
});
