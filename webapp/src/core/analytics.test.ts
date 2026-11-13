import { describe, expect, it } from "vitest";
import { commonSize, compositeScores, dupontTable, peerPercentiles, priceAt, screenTable } from "./analytics";
import type { FinRow, Ratios } from "./types";

const asRatios = (r: Partial<Ratios>) => r as unknown as Ratios;

describe("dupontTable", () => {
  it("multiplies the three drivers and guards nulls", () => {
    const fin: FinRow[] = [
      { fy: 2025, date: "2025-09-30", label: "FY25", net_margin: 0.1, asset_turnover: 2, leverage: 3, roe: 0.6 },
      { fy: 2024, date: "2024-09-30", label: "FY24", net_margin: 0.05, asset_turnover: null, leverage: 2, roe: 0.2 },
    ];
    const rows = dupontTable(fin);
    expect(rows[0].roeDupont).toBeCloseTo(0.6, 10);
    expect(rows[0].roe).toBeCloseTo(0.6, 10);
    expect(rows[1].roeDupont).toBeNull();
  });
});

describe("commonSize", () => {
  it("scales income lines by revenue and balance lines by assets", () => {
    const fin: FinRow[] = [
      { fy: 2025, date: "2025-09-30", label: "FY25", revenue: 1000, cost_of_revenue: 400, ebitda: 200, total_assets: 5000 },
    ];
    const income = commonSize(fin, "income");
    expect(income.labels).toEqual(["FY25"]);
    expect(income.items.find((i) => i.line === "Revenue")?.values[0]).toBeCloseTo(1, 10);
    expect(income.items.find((i) => i.line === "Cost of revenue")?.values[0]).toBeCloseTo(0.4, 10);

    const balance = commonSize(fin, "balance");
    expect(balance.items.find((i) => i.line === "Total assets")?.values[0]).toBeCloseTo(1, 10);
  });
});

describe("peerPercentiles", () => {
  it("ranks the subject within the peer set (0–1)", () => {
    const table = [
      asRatios({ code: "A", roe: 0.1 }),
      asRatios({ code: "B", roe: 0.15 }),
      asRatios({ code: "C", roe: 0.2 }),
    ];
    const rows = peerPercentiles(table, "B", ["roe"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].percentile).toBeCloseTo(2 / 3, 10);
    expect(rows[0].peerMedian).toBeCloseTo(0.15, 10);
    expect(rows[0].n).toBe(3);
  });

  it("returns an empty list for an unknown subject", () => {
    expect(peerPercentiles([asRatios({ code: "A", roe: 0.1 })], "Z", ["roe"])).toEqual([]);
  });
});

describe("screenTable", () => {
  const table = [
    asRatios({ code: "A", sector: "Financials", peRatio: 10 }),
    asRatios({ code: "B", sector: "Financials", peRatio: 20 }),
    asRatios({ code: "C", sector: "Mining", peRatio: 30 }),
  ];

  it("filters by numeric range", () => {
    expect(screenTable(table, { peRatio: [10, 20] }).map((r) => r.code)).toEqual(["A", "B"]);
  });

  it("filters by sector and treats a null range as no filter", () => {
    expect(screenTable(table, {}, { sectors: ["Financials"] }).map((r) => r.code)).toEqual(["A", "B"]);
    expect(screenTable(table, { peRatio: null }).map((r) => r.code)).toEqual(["A", "B", "C"]);
  });
});

describe("compositeScores", () => {
  it("produces 0–1 percentile composites", () => {
    const table = [
      asRatios({
        code: "HI",
        roe: 0.2, netMargin: 0.2, cashConversion: 0.2,
        peRatio: 10, pbRatio: 1, evEbitda: 8, dividendYield: 0.06,
        revenueCagr: 0.1, epsCagr: 0.1, return1y: 0.3,
      }),
      asRatios({
        code: "MID",
        roe: 0.15, netMargin: 0.15, cashConversion: 0.15,
        peRatio: 15, pbRatio: 1.5, evEbitda: 12, dividendYield: 0.04,
        revenueCagr: 0.05, epsCagr: 0.05, return1y: 0.1,
      }),
      asRatios({
        code: "LO",
        roe: 0.1, netMargin: 0.1, cashConversion: 0.1,
        peRatio: 20, pbRatio: 2, evEbitda: 16, dividendYield: 0.02,
        revenueCagr: 0.01, epsCagr: 0.01, return1y: -0.1,
      }),
    ];
    const scored = compositeScores(table);
    const hi = scored.find((s) => s.code === "HI");
    const lo = scored.find((s) => s.code === "LO");
    expect(hi?.scoreTotal).toBeCloseTo(1, 10);
    expect(lo?.scoreTotal).toBeCloseTo(0, 10);
    for (const s of scored) {
      expect(s.scoreTotal).not.toBeNull();
      expect(s.scoreTotal!).toBeGreaterThanOrEqual(0);
      expect(s.scoreTotal!).toBeLessThanOrEqual(1);
    }
  });

  it("returns null scores when there are fewer than two rows", () => {
    const scored = compositeScores([asRatios({ code: "X", roe: 0.1 })]);
    expect(scored[0].scoreTotal).toBeNull();
  });
});

describe("priceAt", () => {
  const history = [
    { date: "2026-01-01", close: 10 },
    { date: "2026-01-10", close: 12 },
  ];

  it("finds the last close on or before the date", () => {
    expect(priceAt(history, "2026-01-05")).toBe(10);
    expect(priceAt(history, "2026-01-10")).toBe(12);
    expect(priceAt(history, "2026-01-20")).toBe(12);
  });

  it("returns null when the gap exceeds 10 days or history is empty", () => {
    expect(priceAt(history, "2026-02-01")).toBeNull();
    expect(priceAt([], "2026-01-01")).toBeNull();
    expect(priceAt(history, "")).toBeNull();
  });
});
