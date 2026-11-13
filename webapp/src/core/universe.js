import universeJson from "./universe.json";
const universe = universeJson;
export const COMPANIES = universe.companies;
export const BENCHMARKS = universe.benchmarks;
export const SECTOR_INDEX_MAP = universe.sectorIndexMap;
export const FX_PAIRS = universe.fxPairs;
export const FAMILY_LABELS = universe.familyLabels;
export const SECTORS = [...new Set(COMPANIES.map((c) => c.sector))].sort();
export const INDUSTRIES = [...new Set(COMPANIES.map((c) => c.industry))].sort();
const BY_CODE = new Map(COMPANIES.map((c) => [c.code, c]));
/** "wbc" → "WBC.AX"; passes through ^AXJO / AUDUSD=X / BRK-B.AX style symbols. */
export function normaliseTicker(input) {
    const x = (input ?? "").trim().toUpperCase();
    if (!x)
        return "";
    if (/\.[A-Z]{1,3}$/.test(x) || x.startsWith("^") || x.includes("="))
        return x;
    return `${x}.AX`;
}
export function codeFromSymbol(symbol) {
    return symbol.toUpperCase().replace(/\.AX$/, "");
}
export function modelFamilyFor(industry, sector) {
    if (industry === "Banks")
        return "bank";
    if (industry === "Insurance")
        return "insurer";
    if (sector === "Financials")
        return "financial";
    if (sector === "Real Estate")
        return "reit";
    return "industrial";
}
export function lookupCompany(symbol) {
    const code = codeFromSymbol(symbol);
    const row = BY_CODE.get(code);
    if (!row) {
        return {
            code,
            name: code,
            sector: "Unclassified",
            industry: "Unclassified",
            inUniverse: false,
            peers: [],
            family: "industrial",
        };
    }
    const peers = row.peers.length
        ? row.peers
        : COMPANIES.filter((c) => c.industry === row.industry && c.code !== code).map((c) => c.code);
    return {
        code,
        name: row.name,
        sector: row.sector,
        industry: row.industry,
        inUniverse: true,
        peers,
        family: modelFamilyFor(row.industry, row.sector),
    };
}
export function sectorCodes(sector, exclude) {
    return COMPANIES.filter((c) => c.sector === sector && c.code !== exclude).map((c) => c.code);
}
export function industryCodes(industry, exclude) {
    return COMPANIES.filter((c) => c.industry === industry && c.code !== exclude).map((c) => c.code);
}
export function defaultPeers(symbol, maxN = 8) {
    return lookupCompany(symbol).peers.slice(0, maxN);
}
/** Grouped picker options: "Sector" → [{ code, name }] */
export function universeBySector() {
    return SECTORS.map((sector) => ({
        sector,
        companies: COMPANIES.filter((c) => c.sector === sector).sort((a, b) => a.code.localeCompare(b.code)),
    }));
}
