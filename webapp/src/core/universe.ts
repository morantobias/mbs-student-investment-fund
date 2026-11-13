import universeJson from "./universe.json";
import type { CompanyInfo, ModelFamily, Universe, UniverseCompany } from "./types.js";

const universe = universeJson as unknown as Universe;

export const COMPANIES: UniverseCompany[] = universe.companies;
export const BENCHMARKS = universe.benchmarks;
export const SECTOR_INDEX_MAP = universe.sectorIndexMap;
export const FX_PAIRS = universe.fxPairs;
export const FAMILY_LABELS = universe.familyLabels;

export const SECTORS = [...new Set(COMPANIES.map((c) => c.sector))].sort();
export const INDUSTRIES = [...new Set(COMPANIES.map((c) => c.industry))].sort();

const BY_CODE = new Map(COMPANIES.map((c) => [c.code, c]));

/** "wbc" → "WBC.AX"; passes through ^AXJO / AUDUSD=X / BRK-B.AX style symbols. */
export function normaliseTicker(input: string | null | undefined): string {
  const x = (input ?? "").trim().toUpperCase();
  if (!x) return "";
  if (/\.[A-Z]{1,3}$/.test(x) || x.startsWith("^") || x.includes("=")) return x;
  return `${x}.AX`;
}

export function codeFromSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/\.AX$/, "");
}

export function modelFamilyFor(industry: string, sector?: string | null): ModelFamily {
  if (industry === "Banks") return "bank";
  if (industry === "Insurance") return "insurer";
  if (sector === "Financials") return "financial";
  if (sector === "Real Estate") return "reit";
  return "industrial";
}

export function lookupCompany(symbol: string): CompanyInfo {
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

export function sectorCodes(sector: string, exclude?: string | null): string[] {
  return COMPANIES.filter((c) => c.sector === sector && c.code !== exclude).map((c) => c.code);
}

export function industryCodes(industry: string, exclude?: string | null): string[] {
  return COMPANIES.filter((c) => c.industry === industry && c.code !== exclude).map((c) => c.code);
}

export function defaultPeers(symbol: string, maxN = 8): string[] {
  return lookupCompany(symbol).peers.slice(0, maxN);
}

/** Grouped picker options: "Sector" → [{ code, name }] */
export function universeBySector(): { sector: string; companies: UniverseCompany[] }[] {
  return SECTORS.map((sector) => ({
    sector,
    companies: COMPANIES.filter((c) => c.sector === sector).sort((a, b) => a.code.localeCompare(b.code)),
  }));
}
