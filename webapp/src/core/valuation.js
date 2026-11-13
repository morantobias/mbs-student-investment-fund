// Valuation engine — sector-aware, assumption-driven, pure functions.
// Port of app/R/valuation.R. Identical maths so the web app and Shiny agree to
// the cent on the same inputs (verified by tests/valuation.test.ts vs R fixtures).
//
//   industrial : unlevered FCFF DCF + peer multiples + dividend cross-check
//   financial  : franking-grossed DDM, residual income, justified P/B, multiples
//   reit       : distribution model + NTA (P/B) + multiples
import { clamp, quantile } from "./brand.js";
export const CORP_TAX_AU = 0.3;
export const costOfEquity = (rf, beta, mrp) => rf + beta * mrp;
export const waccCalc = (ke, kd, tax, dw) => ke * (1 - dw) + kd * (1 - tax) * dw;
export const frankingFactor = (franking = 1, corpTax = CORP_TAX_AU) => 1 + (franking * corpTax) / (1 - corpTax);
const fade = (start, end, n) => n === 1 ? [end] : Array.from({ length: n }, (_, i) => start + ((end - start) * i) / (n - 1));
const round4 = (v) => Math.round(v * 1e4) / 1e4;
// ---------------------------------------------------------------------------
// Default assumptions derived from the loaded company
// ---------------------------------------------------------------------------
export function defaultAssumptions(family, ratios, opts = {}) {
    const r = ratios;
    const horizon = opts.horizon ?? 5;
    const price = opts.price !== undefined ? opts.price : r.price;
    const betaHist = opts.beta ?? null;
    const beta = betaHist !== null ? Math.round(clamp(betaHist, 0.4, 2.0) * 100) / 100 : 1.0;
    const mcap = r.marketCap;
    const debt = r.totalDebt ?? 0;
    const dw = mcap !== null && mcap > 0 && family === "industrial"
        ? clamp(debt / (debt + mcap), 0, 0.6)
        : 0.2;
    const taxEff = r.taxRateEff;
    const tax = taxEff !== null && taxEff > 0.05 && taxEff < 0.45 ? Math.round(taxEff * 1000) / 1000 : CORP_TAX_AU;
    const hasDiv = r.dps !== null && r.dps > 0;
    const tg = 0.025;
    const years = Array.from({ length: horizon }, (_, i) => i + 1);
    const lastFy = r.fy || new Date().getFullYear();
    const labels = years.map((y) => `FY${String(lastFy + y).slice(2)}E`);
    let grid;
    if (family === "industrial") {
        let g0 = r.revenueCagr;
        g0 = g0 === null ? 0.04 : clamp(g0, -0.05, 0.15);
        let m0 = r.ebitMargin;
        m0 = m0 === null ? 0.12 : clamp(m0, -0.2, 0.7);
        let da0 = r.daRevenue;
        da0 = da0 === null ? 0.03 : clamp(da0, 0, 0.3);
        let cx0 = r.capexRevenue;
        cx0 = cx0 === null ? Math.max(da0, 0.03) : clamp(cx0, 0, 0.4);
        let nwc0 = r.nwcRevenue;
        nwc0 = nwc0 === null ? 0.02 : clamp(nwc0, -0.3, 0.4);
        const growth = fade(g0, Math.max(tg, Math.min(g0, 0.05)), horizon);
        const capexFade = fade(cx0, (cx0 + da0) / 2, horizon);
        grid = years.map((year, i) => ({
            year,
            label: labels[i],
            revenueGrowth: round4(growth[i]),
            ebitMargin: round4(m0),
            daPct: round4(da0),
            capexPct: round4(capexFade[i]),
            nwcPct: round4(nwc0),
            taxRate: round4(tax),
        }));
    }
    else {
        let g0 = r.epsCagr ?? r.niCagr;
        g0 = g0 === null ? 0.03 : clamp(g0, -0.05, 0.12);
        let p0 = r.payout;
        p0 = p0 === null || p0 <= 0 ? (family === "bank" ? 0.75 : 0.6) : clamp(p0, 0.2, 1.0);
        const growth = fade(g0, Math.max(tg, Math.min(g0, 0.04)), horizon);
        grid = years.map((year, i) => ({
            year,
            label: labels[i],
            epsGrowth: round4(growth[i]),
            payout: round4(p0),
        }));
    }
    const weights = (() => {
        switch (family) {
            case "bank":
                return { ddm: 0.4, rim: 0.2, pe: 0.2, pb: 0.2, dcf: 0, evEbitda: 0 };
            case "insurer":
            case "financial":
                return { ddm: 0.35, rim: 0.15, pe: 0.3, pb: 0.2, dcf: 0, evEbitda: 0 };
            case "reit":
                return { ddm: 0.4, rim: 0, pe: 0.15, pb: 0.3, dcf: 0, evEbitda: 0.15 };
            default:
                return { dcf: 0.5, pe: 0.2, evEbitda: 0.2, pb: 0, ddm: hasDiv ? 0.1 : 0, rim: 0 };
        }
    })();
    const scenarios = [
        { scenario: "Bear", weight: 0.25, growthDelta: -0.02, marginDelta: -0.02, payoutDelta: -0.05, keDelta: 0.005, tgDelta: -0.005 },
        { scenario: "Base", weight: 0.5, growthDelta: 0, marginDelta: 0, payoutDelta: 0, keDelta: 0, tgDelta: 0 },
        { scenario: "Bull", weight: 0.25, growthDelta: 0.02, marginDelta: 0.02, payoutDelta: 0.05, keDelta: -0.005, tgDelta: 0.005 },
    ];
    return {
        family,
        price,
        shares: r.sharesOut,
        netDebt: r.netDebt ?? 0,
        cash: r.cash,
        nonopAssets: 0,
        minorityInterest: 0,
        rf: 0.045,
        beta,
        mrp: 0.06,
        costOfDebt: 0.06,
        debtWeight: Math.round(dw * 1000) / 1000,
        taxRate: tax,
        terminalGrowth: tg,
        franking: hasDiv ? 1.0 : 0,
        corpTax: CORP_TAX_AU,
        midyear: false,
        horizon,
        baseRevenue: r.revenue,
        baseEps: r.eps,
        baseDps: r.dps,
        baseBvps: r.bvps,
        baseRoe: r.roe,
        grid,
        weights,
        scenarios,
        headlineBasis: hasDiv && family !== "industrial" ? "fc" : "ex",
        recBuy: 0.1,
        recSell: -0.05,
    };
}
export function projectIndustrial(a) {
    const g = a.grid;
    const n = g.length;
    const rev0 = a.baseRevenue;
    if (rev0 === null || rev0 <= 0)
        return null;
    const revenue = [];
    let prev = rev0;
    for (let i = 0; i < n; i++) {
        prev = prev * (1 + (g[i].revenueGrowth ?? 0));
        revenue.push(prev);
    }
    const ebit = revenue.map((rv, i) => rv * (g[i].ebitMargin ?? 0));
    const tax = ebit.map((e, i) => e * (g[i].taxRate ?? 0));
    const nopat = ebit.map((e, i) => e * (1 - (g[i].taxRate ?? 0)));
    const da = revenue.map((rv, i) => rv * (g[i].daPct ?? 0));
    const capex = revenue.map((rv, i) => rv * (g[i].capexPct ?? 0));
    const nwc = revenue.map((rv, i) => rv * (g[i].nwcPct ?? 0));
    const nwc0 = rev0 * (g[0].nwcPct ?? 0);
    const deltaNwc = nwc.map((v, i) => (i === 0 ? v - nwc0 : v - nwc[i - 1]));
    const fcff = nopat.map((v, i) => v + da[i] - capex[i] - deltaNwc[i]);
    return revenue.map((rv, i) => ({
        year: g[i].year,
        label: g[i].label,
        revenue: rv,
        revenueGrowth: g[i].revenueGrowth ?? 0,
        ebit: ebit[i],
        ebitMargin: g[i].ebitMargin ?? 0,
        tax: tax[i],
        nopat: nopat[i],
        da: da[i],
        capex: capex[i],
        deltaNwc: deltaNwc[i],
        fcff: fcff[i],
        ebitda: ebit[i] + da[i],
        fcffMargin: rv ? fcff[i] / rv : 0,
    }));
}
export function runDcf(a, opts = {}) {
    const proj = opts.proj ?? projectIndustrial(a);
    if (!proj)
        return null;
    const ke = costOfEquity(a.rf, a.beta, a.mrp);
    const w = opts.waccOverride ?? waccCalc(ke, a.costOfDebt, a.taxRate, a.debtWeight);
    const tg = opts.tgOverride ?? a.terminalGrowth;
    const n = proj.length;
    const t = proj.map((p) => (a.midyear ? p.year - 0.5 : p.year));
    const disc = t.map((x) => 1 / Math.pow(1 + w, x));
    const pv = proj.map((p, i) => p.fcff * disc[i]);
    const terminalFcff = proj[n - 1].fcff * (1 + tg);
    const tv = w > tg ? terminalFcff / (w - tg) : null;
    const pvTv = tv === null ? 0 : tv / Math.pow(1 + w, proj[n - 1].year);
    const ev = pv.reduce((x, y) => x + y, 0) + pvTv;
    const equity = ev - (a.netDebt ?? 0) + (a.nonopAssets ?? 0) - (a.minorityInterest ?? 0);
    const perShare = a.shares !== null && a.shares > 0 ? equity / a.shares : null;
    const schedule = proj.map((p, i) => ({ ...p, discountFactor: disc[i], pvFcff: pv[i] }));
    return {
        schedule,
        ke,
        wacc: w,
        terminalGrowth: tg,
        terminalFcff,
        terminalValue: tv,
        pvTerminal: pvTv,
        pvFcffSum: pv.reduce((x, y) => x + y, 0),
        tvShare: ev !== 0 ? pvTv / ev : null,
        enterpriseValue: ev,
        equityValue: equity,
        perShare,
        upside: a.price !== null && a.price > 0 && perShare !== null ? perShare / a.price - 1 : null,
        impliedEvEbitda: proj[0].ebitda > 0 ? ev / proj[0].ebitda : null,
    };
}
/** Brent-style bisection: the uniform growth that reconciles the DCF to the price. */
function solve(f, lo, hi) {
    let flo = f(lo);
    let fhi = f(hi);
    if (flo === null || fhi === null || Math.sign(flo) === Math.sign(fhi))
        return null;
    let a = lo;
    let b = hi;
    for (let i = 0; i < 200; i++) {
        const m = (a + b) / 2;
        const fm = f(m);
        if (fm === null)
            return null;
        if (Math.abs(fm) < 1e-9)
            return m;
        if (Math.sign(fm) === Math.sign(flo)) {
            a = m;
            flo = fm;
        }
        else {
            b = m;
            fhi = fm;
        }
    }
    return (a + b) / 2;
}
export function reverseDcf(a) {
    if (a.price === null || a.price <= 0)
        return null;
    const fGrowth = (gg) => {
        const b = { ...a, grid: a.grid.map((r) => ({ ...r, revenueGrowth: gg })) };
        const d = runDcf(b);
        return d && d.perShare !== null ? d.perShare - a.price : null;
    };
    const fTg = (tg) => {
        const d = runDcf(a, { tgOverride: tg });
        return d && d.perShare !== null ? d.perShare - a.price : null;
    };
    const w = waccCalc(costOfEquity(a.rf, a.beta, a.mrp), a.costOfDebt, a.taxRate, a.debtWeight);
    return {
        impliedGrowth: solve(fGrowth, -0.3, 0.6),
        impliedTerminalGrowth: solve(fTg, -0.05, w - 0.002),
    };
}
export function projectFinancial(a) {
    const g = a.grid;
    const n = g.length;
    const eps0 = a.baseEps;
    if (eps0 === null || eps0 <= 0)
        return null;
    const b0 = a.baseBvps ?? 0;
    const eps = [];
    const dps = [];
    const bvps = [];
    const roe = [];
    let prevEps = eps0;
    let prevB = b0;
    for (let i = 0; i < n; i++) {
        const e = prevEps * (1 + (g[i].epsGrowth ?? 0));
        const d = e * (g[i].payout ?? 0);
        const b = prevB + e - d;
        eps.push(e);
        dps.push(d);
        bvps.push(b);
        roe.push(prevB > 0 ? e / prevB : null);
        prevEps = e;
        prevB = b;
    }
    return eps.map((e, i) => ({
        year: g[i].year,
        label: g[i].label,
        eps: e,
        epsGrowth: g[i].epsGrowth ?? 0,
        payout: g[i].payout ?? 0,
        dps: dps[i],
        bvpsOpen: i === 0 ? b0 : bvps[i - 1],
        bvps: bvps[i],
        roe: roe[i],
    }));
}
export function runDdm(a, opts = {}) {
    const proj = opts.proj ?? projectFinancial(a);
    if (!proj)
        return null;
    const ke = opts.keOverride ?? costOfEquity(a.rf, a.beta, a.mrp);
    const g = opts.gOverride ?? a.terminalGrowth;
    const ff = frankingFactor(a.franking ?? 0, a.corpTax ?? CORP_TAX_AU);
    const n = proj.length;
    const disc = proj.map((p) => 1 / Math.pow(1 + ke, p.year));
    const pvEx = proj.map((p, i) => p.dps * disc[i]);
    const tvEx = ke > g ? (proj[n - 1].dps * (1 + g)) / (ke - g) : null;
    const pvTvEx = tvEx === null ? 0 : tvEx * disc[n - 1];
    const valueEx = pvEx.reduce((x, y) => x + y, 0) + pvTvEx;
    const valueFc = valueEx * ff;
    const schedule = proj.map((p, i) => ({
        ...p,
        discountFactor: disc[i],
        pvDps: pvEx[i],
        dpsGrossed: p.dps * ff,
    }));
    return {
        schedule,
        ke,
        terminalGrowth: g,
        frankingFactor: ff,
        pvExplicit: pvEx.reduce((x, y) => x + y, 0),
        terminalValue: tvEx,
        pvTerminal: pvTvEx,
        tvShare: valueEx !== 0 ? pvTvEx / valueEx : null,
        valueEx,
        valueFc,
        upsideEx: a.price !== null && a.price > 0 ? valueEx / a.price - 1 : null,
        upsideFc: a.price !== null && a.price > 0 ? valueFc / a.price - 1 : null,
        yieldEx: a.price !== null && a.price > 0 && a.baseDps !== null ? a.baseDps / a.price : null,
        yieldFc: a.price !== null && a.price > 0 && a.baseDps !== null ? (a.baseDps * ff) / a.price : null,
    };
}
export function runRim(a, opts = {}) {
    const proj = opts.proj ?? projectFinancial(a);
    if (!proj || a.baseBvps === null || a.baseBvps <= 0)
        return null;
    const ke = opts.keOverride ?? costOfEquity(a.rf, a.beta, a.mrp);
    const g = opts.gOverride ?? a.terminalGrowth;
    const n = proj.length;
    const ri = proj.map((p) => p.eps - ke * p.bvpsOpen);
    const disc = proj.map((p) => 1 / Math.pow(1 + ke, p.year));
    const pvRi = ri.map((v, i) => v * disc[i]);
    const tv = ke > g ? (ri[n - 1] * (1 + g)) / (ke - g) : null;
    const pvTv = tv === null ? 0 : tv * disc[n - 1];
    const value = a.baseBvps + pvRi.reduce((x, y) => x + y, 0) + pvTv;
    return {
        schedule: proj.map((p, i) => ({ ...p, residualIncome: ri[i], pvRi: pvRi[i] })),
        ke,
        terminalGrowth: g,
        bookValue: a.baseBvps,
        pvRi: pvRi.reduce((x, y) => x + y, 0),
        terminalValue: tv,
        pvTerminal: pvTv,
        value,
        upside: a.price !== null && a.price > 0 ? value / a.price - 1 : null,
    };
}
export function runJustifiedPb(roe, g, ke, bvps, price) {
    const jpb = roe !== null && ke > g ? (roe - g) / (ke - g) : null;
    const value = jpb !== null && bvps !== null && jpb > 0 ? jpb * bvps : null;
    return {
        roe,
        growth: g,
        ke,
        bvps,
        justifiedPb: jpb,
        value,
        spread: roe !== null ? roe - ke : null,
        upside: price !== null && price > 0 && value !== null ? value / price - 1 : null,
    };
}
const peerStat = (xs, p) => {
    const v = xs.filter((x) => x !== null && Number.isFinite(x) && x > 0);
    if (!v.length)
        return null;
    return p === undefined ? quantile(v, 0.5) : quantile(v, p);
};
export function runRelative(r, peers) {
    const set = peers.filter((p) => p.ticker !== r.ticker);
    const n = set.length;
    const get = (k) => set.map((p) => p[k] ?? null);
    const q = (k, p) => (n ? peerStat(get(k), p) : null);
    const med = (k) => (n ? peerStat(get(k)) : null);
    const eps = r.eps;
    const bvps = r.bvps;
    const ebitda = r.ebitda;
    const dps = r.dps;
    const shares = r.sharesOut;
    const nd = r.netDebt ?? 0;
    const vFromEv = (mult) => mult !== null && ebitda !== null && ebitda > 0 && shares !== null && shares > 0
        ? (mult * ebitda - nd) / shares
        : null;
    const vPe = (m) => (m !== null && eps !== null && eps > 0 ? eps * m : null);
    const vPb = (m) => (m !== null && bvps !== null && bvps > 0 ? bvps * m : null);
    const vDy = (y) => (y !== null && y > 0 && dps !== null && dps > 0 ? dps / y : null);
    return [
        {
            method: "pe",
            label: "Peer P/E",
            multipleLow: q("peRatio", 0.25),
            multiple: med("peRatio"),
            multipleHigh: q("peRatio", 0.75),
            companyMultiple: r.peRatio,
            valueLow: vPe(q("peRatio", 0.25)),
            value: vPe(med("peRatio")),
            valueHigh: vPe(q("peRatio", 0.75)),
            nPeers: n,
        },
        {
            method: "pb",
            label: "Peer P/B",
            multipleLow: q("pbRatio", 0.25),
            multiple: med("pbRatio"),
            multipleHigh: q("pbRatio", 0.75),
            companyMultiple: r.pbRatio,
            valueLow: vPb(q("pbRatio", 0.25)),
            value: vPb(med("pbRatio")),
            valueHigh: vPb(q("pbRatio", 0.75)),
            nPeers: n,
        },
        {
            method: "ev_ebitda",
            label: "Peer EV/EBITDA",
            multipleLow: q("evEbitda", 0.25),
            multiple: med("evEbitda"),
            multipleHigh: q("evEbitda", 0.75),
            companyMultiple: r.evEbitda,
            valueLow: vFromEv(q("evEbitda", 0.25)),
            value: vFromEv(med("evEbitda")),
            valueHigh: vFromEv(q("evEbitda", 0.75)),
            nPeers: n,
        },
        {
            method: "div_yield",
            label: "Peer dividend yield",
            multipleLow: q("dividendYield", 0.75),
            multiple: med("dividendYield"),
            multipleHigh: q("dividendYield", 0.25),
            companyMultiple: r.dividendYield,
            valueLow: vDy(q("dividendYield", 0.75)),
            value: vDy(med("dividendYield")),
            valueHigh: vDy(q("dividendYield", 0.25)),
            nPeers: n,
        },
    ];
}
export function recommendation(mos, buy = 0.1, sell = -0.05) {
    if (mos === null)
        return "n/a";
    if (mos >= buy)
        return "Buy";
    if (mos <= sell)
        return "Sell";
    return "Hold";
}
export function runValuation(ratios, peers, a, delta = {}) {
    const { keDelta = 0, gDelta = 0, tgDelta = 0, marginDelta = 0, payoutDelta = 0 } = delta;
    const price = a.price;
    const fam = a.family;
    const b = {
        ...a,
        rf: a.rf + keDelta,
        terminalGrowth: a.terminalGrowth + tgDelta,
        grid: a.grid.map((row) => fam === "industrial"
            ? {
                ...row,
                revenueGrowth: (row.revenueGrowth ?? 0) + gDelta,
                ebitMargin: (row.ebitMargin ?? 0) + marginDelta,
            }
            : {
                ...row,
                epsGrowth: (row.epsGrowth ?? 0) + gDelta,
                payout: clamp((row.payout ?? 0) + payoutDelta, 0, 1.2),
            }),
    };
    const ke = costOfEquity(b.rf, b.beta, b.mrp);
    const wacc = waccCalc(ke, b.costOfDebt, b.taxRate, b.debtWeight);
    const isFin = ["bank", "insurer", "financial", "reit"].includes(fam);
    const dcf = fam === "industrial" ? safe(() => runDcf(b)) : null;
    const projf = b.baseEps !== null && b.baseEps > 0 && b.baseDps !== null && b.baseDps > 0
        ? safe(() => projectFinancial(b))
        : null;
    const ddm = projf ? runDdm(b, { proj: projf, keOverride: ke }) : null;
    const rim = projf && isFin ? runRim(b, { proj: projf, keOverride: ke }) : null;
    const jpb = isFin ? runJustifiedPb(ratios.roe, b.terminalGrowth, ke, ratios.bvps, price) : null;
    const rel = runRelative(ratios, peers ?? []);
    const w = b.weights;
    const ff = frankingFactor(b.franking ?? 0, b.corpTax ?? CORP_TAX_AU);
    const relVal = (m) => rel.find((x) => x.method === m);
    const defs = [
        { method: "dcf", label: "FCFF DCF", valueEx: dcf?.perShare ?? null, valueFc: dcf?.perShare ?? null, low: null, high: null, weight: w.dcf ?? 0 },
        { method: "ddm", label: "Dividend discount model", valueEx: ddm?.valueEx ?? null, valueFc: ddm?.valueFc ?? null, low: null, high: null, weight: w.ddm ?? 0 },
        { method: "rim", label: "Residual income model", valueEx: rim?.value ?? null, valueFc: rim?.value ?? null, low: null, high: null, weight: w.rim ?? 0 },
        { method: "pe", label: "Peer P/E", valueEx: relVal("pe")?.value ?? null, valueFc: relVal("pe")?.value ?? null, low: relVal("pe")?.valueLow ?? null, high: relVal("pe")?.valueHigh ?? null, weight: w.pe ?? 0 },
        { method: "pb", label: "Peer P/B", valueEx: relVal("pb")?.value ?? null, valueFc: relVal("pb")?.value ?? null, low: relVal("pb")?.valueLow ?? null, high: relVal("pb")?.valueHigh ?? null, weight: w.pb ?? 0 },
        { method: "ev_ebitda", label: "Peer EV/EBITDA", valueEx: relVal("ev_ebitda")?.value ?? null, valueFc: relVal("ev_ebitda")?.value ?? null, low: relVal("ev_ebitda")?.valueLow ?? null, high: relVal("ev_ebitda")?.valueHigh ?? null, weight: w.evEbitda ?? 0 },
    ];
    const methods = defs.map((d) => {
        let available = d.valueEx !== null && d.valueEx > 0;
        if (["bank", "insurer", "financial"].includes(fam) && d.method === "ev_ebitda")
            available = false;
        const inUse = available && d.weight > 0;
        return {
            ...d,
            available,
            inUse,
            weightUsed: 0,
            upsideEx: price !== null && price > 0 && d.valueEx !== null ? d.valueEx / price - 1 : null,
            upsideFc: price !== null && price > 0 && d.valueFc !== null ? d.valueFc / price - 1 : null,
            note: "",
        };
    });
    const tot = methods.filter((m) => m.inUse).reduce((s, m) => s + m.weight, 0);
    for (const m of methods)
        m.weightUsed = m.inUse && tot > 0 ? m.weight / tot : 0;
    for (const m of methods) {
        if (m.method === "dcf" && !m.available && fam !== "industrial")
            m.note = "Not applied to financials / REITs";
        else if (m.method === "dcf" && !m.available)
            m.note = "DCF unavailable (no revenue base or negative value)";
        else if ((m.method === "ddm" || m.method === "rim") && !m.available)
            m.note = "No positive dividend / EPS base";
        else if (m.method === "ev_ebitda" && ["bank", "insurer", "financial"].includes(fam))
            m.note = "Not meaningful for financials (interest is operating)";
        else if (["pe", "pb", "ev_ebitda"].includes(m.method) && !m.available)
            m.note = "Peer multiple or company metric unavailable";
        else if (m.available && m.weight === 0)
            m.note = "Shown for reference (zero weight)";
    }
    const inUse = methods.filter((m) => m.inUse);
    const weightedValueEx = tot > 0 ? inUse.reduce((s, m) => s + (m.valueEx ?? 0) * m.weightUsed, 0) : null;
    const weightedValueFc = tot > 0 ? inUse.reduce((s, m) => s + (m.valueFc ?? 0) * m.weightUsed, 0) : null;
    const mosEx = price !== null && price > 0 && weightedValueEx !== null ? weightedValueEx / price - 1 : null;
    const mosFc = price !== null && price > 0 && weightedValueFc !== null ? weightedValueFc / price - 1 : null;
    const basis = a.headlineBasis ?? "ex";
    const weightedValue = basis === "fc" ? weightedValueFc : weightedValueEx;
    const upside = basis === "fc" ? mosFc : mosEx;
    return {
        family: fam,
        isFinancial: isFin,
        assumptions: b,
        price,
        ke,
        wacc,
        frankingFactor: ff,
        dcf,
        ddm,
        rim,
        jpb,
        rel,
        methods,
        weightedValueEx,
        weightedValueFc,
        mosEx,
        mosFc,
        headlineBasis: basis,
        weightedValue,
        upside,
        recommendation: recommendation(upside, a.recBuy ?? 0.1, a.recSell ?? -0.05),
    };
}
const safe = (f) => {
    try {
        return f();
    }
    catch {
        return null;
    }
};
export function runScenarios(ratios, peers, a) {
    const rows = a.scenarios.map((s) => {
        const v = runValuation(ratios, peers, a, {
            keDelta: s.keDelta,
            gDelta: s.growthDelta,
            tgDelta: s.tgDelta,
            marginDelta: s.marginDelta,
            payoutDelta: s.payoutDelta,
        });
        return {
            scenario: s.scenario,
            weight: s.weight,
            growthDelta: s.growthDelta,
            marginDelta: s.marginDelta,
            payoutDelta: s.payoutDelta,
            keDelta: s.keDelta,
            tgDelta: s.tgDelta,
            ke: v.ke,
            valueEx: v.weightedValueEx,
            mosEx: v.mosEx,
            valueFc: v.weightedValueFc,
            mosFc: v.mosFc,
        };
    });
    const wsum = rows.reduce((s, r) => s + r.weight, 0);
    const ok = rows.filter((r) => r.valueEx !== null);
    const wt = wsum > 0 ? rows.map((r) => r.weight / wsum) : rows.map(() => null);
    const wsumOk = rows.reduce((s, r, i) => (r.valueEx !== null && wt[i] !== null ? s + wt[i] : s), 0);
    const weighted = (key) => ok.length && wsumOk > 0
        ? rows.reduce((s, r, i) => (r[key] !== null && wt[i] !== null ? s + r[key] * wt[i] : s), 0) / wsumOk
        : null;
    const finalEx = weighted("valueEx");
    const finalFc = weighted("valueFc");
    const price = a.price;
    rows.push({
        scenario: "Probability-weighted",
        weight: wsum,
        growthDelta: null,
        marginDelta: null,
        payoutDelta: null,
        keDelta: null,
        tgDelta: null,
        ke: null,
        valueEx: finalEx,
        mosEx: price !== null && price > 0 && finalEx !== null ? finalEx / price - 1 : null,
        valueFc: finalFc,
        mosFc: price !== null && price > 0 && finalFc !== null ? finalFc / price - 1 : null,
    });
    return rows;
}
const DEFAULT_STEPS = {
    ke: [-0.02, -0.015, -0.01, -0.005, 0, 0.005, 0.01, 0.015, 0.02],
    growth: [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03],
    tg: [-0.01, -0.0075, -0.005, -0.0025, 0, 0.0025, 0.005, 0.0075, 0.01],
    margin: [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03],
};
export function sensitivity1d(ratios, peers, a, variable, steps) {
    const use = steps ?? DEFAULT_STEPS[variable];
    return use.map((d) => {
        const delta = variable === "ke" ? { keDelta: d }
            : variable === "growth" ? { gDelta: d }
                : variable === "tg" ? { tgDelta: d }
                    : { marginDelta: d };
        const v = runValuation(ratios, peers, a, delta);
        return {
            delta: d,
            ke: v.ke,
            valueEx: v.weightedValueEx,
            mosEx: v.mosEx,
            valueFc: v.weightedValueFc,
            mosFc: v.mosFc,
        };
    });
}
export function sensitivity2d(a, opts = {}) {
    const xSteps = opts.xSteps ?? [-0.02, -0.01, 0, 0.01, 0.02];
    const ySteps = opts.ySteps ?? [-0.01, -0.005, 0, 0.005, 0.01];
    const basis = opts.basis ?? "fc";
    const ke = costOfEquity(a.rf, a.beta, a.mrp);
    if (a.family === "industrial") {
        const w0 = waccCalc(ke, a.costOfDebt, a.taxRate, a.debtWeight);
        const proj = projectIndustrial(a);
        if (!proj)
            return null;
        const xs = xSteps.map((d) => w0 + d);
        const ys = ySteps.map((d) => a.terminalGrowth + d);
        const matrix = xs.map((w) => ys.map((g) => {
            const d = runDcf(a, { waccOverride: w, tgOverride: g, proj });
            return d ? d.perShare : null;
        }));
        return { x: xs, y: ys, matrix, xLabel: "WACC", yLabel: "Terminal growth", method: "FCFF DCF value per share" };
    }
    const proj = projectFinancial(a);
    if (!proj)
        return null;
    const xs = xSteps.map((d) => ke + d);
    const ys = ySteps.map((d) => a.terminalGrowth + d);
    const matrix = xs.map((k) => ys.map((g) => {
        const d = runDdm(a, { proj, keOverride: k, gOverride: g });
        if (!d)
            return null;
        return basis === "fc" ? d.valueFc : d.valueEx;
    }));
    return {
        x: xs,
        y: ys,
        matrix,
        xLabel: "Cost of equity",
        yLabel: "Terminal growth",
        method: `Dividend discount value per share (${basis === "fc" ? "incl." : "excl."} franking)`,
    };
}
export function footballField(quote, v, scen, sensKe) {
    const basis = v.headlineBasis;
    const pick = (ex, fc) => (basis === "fc" ? fc : ex);
    const rows = [];
    const push = (method, low, base, high) => {
        if (base === null || !Number.isFinite(base))
            return;
        const lo = low !== null && Number.isFinite(low) ? low : base * 0.9;
        const hi = high !== null && Number.isFinite(high) ? high : base * 1.1;
        rows.push({ method, low: Math.min(lo, base), base, high: Math.max(hi, base) });
    };
    push("52-week trading range", quote.week52Low, quote.price, quote.week52High);
    for (const m of v.methods) {
        if (!m.available)
            continue;
        const base = pick(m.valueEx, m.valueFc);
        let lo = m.low;
        let hi = m.high;
        if (["dcf", "ddm", "rim"].includes(m.method) && sensKe && sensKe.length > 0) {
            const vals = sensKe.map((s) => pick(s.valueEx, s.valueFc));
            const band = sensKe.map((s, i) => ({ d: s.delta, v: vals[i] })).filter((x) => Math.abs(x.d) <= 0.0101 && x.v !== null);
            const zero = sensKe.reduce((best, s, i) => (Math.abs(s.delta) < Math.abs(sensKe[best].delta) ? i : best), 0);
            const anchor = vals[zero];
            if (anchor && anchor !== 0 && band.length) {
                const ratios = band.map((x) => x.v / anchor).filter(Number.isFinite);
                if (ratios.length) {
                    lo = base !== null ? base * Math.min(...ratios) : lo;
                    hi = base !== null ? base * Math.max(...ratios) : hi;
                }
            }
        }
        push(m.label, lo, base, hi);
    }
    if (scen && scen.length > 1) {
        const s = scen.filter((r) => r.scenario !== "Probability-weighted");
        const vals = s.map((r) => pick(r.valueEx, r.valueFc)).filter((x) => x !== null && Number.isFinite(x));
        const last = scen[scen.length - 1];
        if (vals.length) {
            push("Scenario range (bear – bull)", Math.min(...vals), pick(last.valueEx, last.valueFc), Math.max(...vals));
        }
    }
    push("Weighted fair value", v.weightedValue, v.weightedValue, v.weightedValue);
    return rows;
}
