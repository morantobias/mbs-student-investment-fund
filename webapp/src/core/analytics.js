// Cross-sectional analytics — DuPont, common-size statements, peer statistics,
// screening and composite scoring. Port of app/R/analytics.R.
import { median, n1 } from "./brand.js";
export function dupontTable(fin) {
    return fin.map((r) => {
        const nm = r.net_margin;
        const at = r.asset_turnover;
        const lev = r.leverage;
        return {
            label: r.label,
            netMargin: nm,
            assetTurnover: at,
            leverage: lev,
            roeDupont: nm !== null && at !== null && lev !== null ? nm * at * lev : null,
            roe: r.roe,
        };
    });
}
const INCOME_ITEMS = [
    ["revenue", "Revenue"],
    ["cost_of_revenue", "Cost of revenue"],
    ["gross_profit", "Gross profit"],
    ["operating_expense", "Operating expenses"],
    ["ebitda", "EBITDA"],
    ["da", "D&A"],
    ["ebit", "EBIT"],
    ["interest_net", "Net interest"],
    ["pretax_income", "Pre-tax income"],
    ["tax", "Tax"],
    ["net_income", "Net income"],
];
const BALANCE_ITEMS = [
    ["cash_total", "Cash & investments"],
    ["receivables", "Receivables"],
    ["net_ppe", "Net PP&E"],
    ["goodwill_intang", "Goodwill & intangibles"],
    ["total_assets", "Total assets"],
    ["payables", "Payables"],
    ["total_debt", "Total debt"],
    ["total_liabilities", "Total liabilities"],
    ["equity", "Shareholders' equity"],
];
/** Common-size statement: each line as a share of revenue (income) or assets (balance). */
export function commonSize(fin, which) {
    const items = which === "income" ? INCOME_ITEMS : BALANCE_ITEMS;
    const base = fin.map((r) => (which === "income" ? r.revenue : r.total_assets));
    return {
        labels: fin.map((r) => r.label),
        items: items.map(([key, line]) => ({
            line,
            values: fin.map((r, i) => {
                const v = r[key];
                return v !== null && base[i] !== null && base[i] !== 0 ? v / base[i] : null;
            }),
        })),
    };
}
/** Percentile rank of the subject within its peer set for each metric (0–1). */
export function peerPercentiles(table, subjectCode, metrics) {
    const subject = table.find((r) => r.code === subjectCode);
    if (!subject)
        return [];
    return metrics.map((metric) => {
        const all = table.map((r) => r[metric]).filter((v) => typeof v === "number" && Number.isFinite(v));
        const value = subject[metric] ?? null;
        return {
            metric,
            value,
            percentile: value === null || all.length < 2 ? null : all.filter((x) => x <= value).length / all.length,
            peerMedian: all.length ? median(all) : null,
            n: all.length,
        };
    });
}
/** Filter a ratios table by named ranges; a null/absent range means "no filter". */
export function screenTable(table, ranges, opts = {}) {
    let out = table;
    if (opts.sectors?.length)
        out = out.filter((r) => r.sector && opts.sectors.includes(r.sector));
    if (opts.industries?.length)
        out = out.filter((r) => r.industry && opts.industries.includes(r.industry));
    for (const [key, range] of Object.entries(ranges)) {
        if (!range)
            continue;
        const [lo, hi] = range;
        out = out.filter((r) => {
            const v = r[key];
            return v === null || v === undefined || (v >= lo && v <= hi);
        });
    }
    return out;
}
function percentileRank(xs, higherBetter = true) {
    const valid = xs.filter((v) => v !== null && Number.isFinite(v));
    if (valid.length < 2)
        return xs.map(() => null);
    const sorted = [...valid].sort((a, b) => a - b);
    const rank = (v) => {
        // R's rank(): ties share the average rank.
        const idx = sorted.indexOf(v);
        const lastIdx = sorted.lastIndexOf(v);
        const avg = (idx + lastIdx) / 2;
        return higherBetter ? avg : sorted.length - 1 - avg;
    };
    return xs.map((v) => (v === null || !Number.isFinite(v) ? null : rank(v) / (valid.length - 1)));
}
const rowMeans = (...cols) => cols[0].map((_, i) => {
    const vals = cols.map((c) => c[i]).filter((v) => v !== null && Number.isFinite(v));
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
});
/** Equal-weighted percentile composite: quality, value, growth and momentum. */
export function compositeScores(table) {
    if (table.length < 2) {
        return table.map((r) => ({ ...r, scoreQuality: null, scoreValue: null, scoreGrowth: null, scoreMomentum: null, scoreTotal: null }));
    }
    const get = (k) => table.map((r) => r[k] ?? null);
    const quality = rowMeans(percentileRank(get("roe")), percentileRank(get("netMargin")), percentileRank(get("cashConversion")));
    const value = rowMeans(percentileRank(get("peRatio"), false), percentileRank(get("pbRatio"), false), percentileRank(get("evEbitda"), false), percentileRank(get("dividendYield")));
    const growth = rowMeans(percentileRank(get("revenueCagr")), percentileRank(get("epsCagr")));
    const momentum = percentileRank(get("return1y"));
    const total = rowMeans(quality, value, growth, momentum);
    return table.map((r, i) => ({
        ...r,
        scoreQuality: quality[i],
        scoreValue: value[i],
        scoreGrowth: growth[i],
        scoreMomentum: momentum[i],
        scoreTotal: total[i],
    }));
}
/** Closing price on or just before a date (null when history does not reach it). */
export function priceAt(history, date) {
    if (!history?.length || !date)
        return null;
    const eligible = history.filter((h) => h.date <= date);
    if (!eligible.length)
        return null;
    const last = eligible[eligible.length - 1];
    const gap = (new Date(date).getTime() - new Date(last.date).getTime()) / 864e5;
    return gap > 10 ? null : last.close;
}
export const latest = (v) => n1(v);
