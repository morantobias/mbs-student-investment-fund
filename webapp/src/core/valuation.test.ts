import { describe, expect, it } from "vitest";
import {
  CORP_TAX_AU,
  costOfEquity,
  frankingFactor,
  recommendation,
  runRelative,
  waccCalc,
} from "./valuation";
import type { Ratios } from "./types";

const asRatios = (r: Partial<Ratios>) => r as unknown as Ratios;

describe("cost of capital helpers", () => {
  it("computes cost of equity, WACC and franking factor", () => {
    expect(CORP_TAX_AU).toBe(0.3);
    expect(costOfEquity(0.045, 1.1, 0.06)).toBeCloseTo(0.111, 10);
    expect(waccCalc(0.11, 0.05, 0.3, 0.4)).toBeCloseTo(0.08, 10);
    expect(frankingFactor()).toBeCloseTo(1.4285714285714286, 10);
    expect(frankingFactor(0)).toBe(1);
    expect(frankingFactor(0.5)).toBeCloseTo(1.2142857142857142, 10);
  });
});

describe("recommendation", () => {
  it("maps margin of safety to Buy / Hold / Sell / n/a", () => {
    expect(recommendation(null)).toBe("n/a");
    expect(recommendation(0.1)).toBe("Buy");
    expect(recommendation(0.0999)).toBe("Hold");
    expect(recommendation(0)).toBe("Hold");
    expect(recommendation(-0.05)).toBe("Sell");
    expect(recommendation(-0.0499)).toBe("Hold");
  });
});

describe("runRelative", () => {
  it("values the subject off peer multiples", () => {
    const r = asRatios({
      ticker: "WBC.AX",
      eps: 2,
      bvps: 10,
      ebitda: 100,
      dps: 0.5,
      sharesOut: 50,
      netDebt: 0,
      peRatio: 25,
      pbRatio: 2,
      evEbitda: 15,
      dividendYield: 0.05,
    });
    const peers = [
      asRatios({ ticker: "CBA.AX", peRatio: 10, pbRatio: 1, evEbitda: 10, dividendYield: 0.04 }),
      asRatios({ ticker: "NAB.AX", peRatio: 20, pbRatio: 1.5, evEbitda: 12, dividendYield: 0.05 }),
      asRatios({ ticker: "ANZ.AX", peRatio: 30, pbRatio: 2.5, evEbitda: 14, dividendYield: 0.06 }),
    ];
    const rel = runRelative(r, peers);

    const pe = rel.find((x) => x.method === "pe");
    expect(pe?.multiple).toBe(20);
    expect(pe?.multipleLow).toBe(15);
    expect(pe?.multipleHigh).toBe(25);
    expect(pe?.value).toBe(40);
    expect(pe?.valueLow).toBe(30);
    expect(pe?.valueHigh).toBe(50);
    expect(pe?.companyMultiple).toBe(25);
    expect(pe?.nPeers).toBe(3);

    const ev = rel.find((x) => x.method === "ev_ebitda");
    expect(ev?.value).toBe(24); // median 12 × 100 EBITDA / 50 shares

    const dy = rel.find((x) => x.method === "div_yield");
    expect(dy?.value).toBe(10); // 0.5 dps / 0.05 median yield
  });
});
