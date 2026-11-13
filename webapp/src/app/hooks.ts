import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBenchmarks, getCompany, getSector } from "./client.js";
import type { BenchmarksPayload, CompanySnapshot, SectorPayload } from "../core/types.js";
import { defaultAssumptions, runScenarios, runValuation, type Assumptions, type ValuationResult } from "../core/valuation.js";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

/** Fetch a company snapshot; keeps the previous data visible while refreshing. */
export function useCompany(symbol: string, period: string) {
  const [state, setState] = useState<AsyncState<CompanySnapshot>>({
    data: null,
    loading: true,
    error: null,
    refreshing: false,
  });
  const [nonce, setNonce] = useState(0);
  const lastSymbol = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sameTarget = lastSymbol.current === `${symbol}:${period}`;
    setState((s) => ({
      ...s,
      loading: !s.data || !sameTarget,
      refreshing: !!s.data && sameTarget,
      error: null,
    }));
    getCompany(symbol, period)
      .then((data) => {
        if (cancelled) return;
        lastSymbol.current = `${symbol}:${period}`;
        setState({ data, loading: false, error: null, refreshing: false });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, refreshing: false, error: err.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, period, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, refresh };
}

export function useBenchmarks(enabled: boolean) {
  const [state, setState] = useState<AsyncState<BenchmarksPayload>>({ data: null, loading: false, error: null, refreshing: false });

  useEffect(() => {
    if (!enabled || state.data) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    getBenchmarks()
      .then((data) => !cancelled && setState({ data, loading: false, error: null, refreshing: false }))
      .catch((err: Error) => !cancelled && setState({ data: null, loading: false, error: err.message, refreshing: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return state;
}

export function useSector(sector: string | null, industry: string | null, enabled: boolean) {
  const [state, setState] = useState<AsyncState<SectorPayload>>({ data: null, loading: false, error: null, refreshing: false });

  useEffect(() => {
    if (!enabled || !sector) return;
    let cancelled = false;
    setState((s) => ({ data: s.data, loading: !s.data, error: null, refreshing: !!s.data }));
    getSector(sector, industry)
      .then((data) => !cancelled && setState({ data, loading: false, error: null, refreshing: false }))
      .catch((err: Error) => !cancelled && setState((s) => ({ ...s, loading: false, refreshing: false, error: err.message })));
    return () => {
      cancelled = true;
    };
  }, [sector, industry, enabled]);

  return state;
}

export interface ValuationBundle {
  assumptions: Assumptions;
  valuation: ValuationResult;
  scenarios: ReturnType<typeof runScenarios>;
}

/**
 * Valuation state lives client-side so assumption edits recompute instantly —
 * no server round-trip. Reset whenever the company changes.
 */
export function useValuation(snapshot: CompanySnapshot | null) {
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);

  const defaults = useMemo(() => {
    if (!snapshot?.ok) return null;
    return defaultAssumptions(snapshot.info.family, snapshot.ratios, {
      price: snapshot.quote.price,
      beta: snapshot.metrics?.beta ?? null,
    });
  }, [snapshot]);

  useEffect(() => {
    setAssumptions(defaults ? structuredClone(defaults) : null);
  }, [defaults]);

  const bundle: ValuationBundle | null = useMemo(() => {
    if (!snapshot?.ok || !assumptions) return null;
    const peers = snapshot.peers?.table ?? null;
    const valuation = runValuation(snapshot.ratios, peers, assumptions);
    const scenarios = runScenarios(snapshot.ratios, peers, assumptions);
    return { assumptions, valuation, scenarios };
  }, [snapshot, assumptions]);

  return {
    bundle,
    assumptions,
    setAssumptions,
    reset: () => setAssumptions(defaults ? structuredClone(defaults) : null),
    dirty: useMemo(
      () => !!(assumptions && defaults && JSON.stringify(assumptions) !== JSON.stringify(defaults)),
      [assumptions, defaults],
    ),
  };
}
