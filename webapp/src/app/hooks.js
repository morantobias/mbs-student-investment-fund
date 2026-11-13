import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBenchmarks, getCompany, getSector } from "./client.js";
import { defaultAssumptions, runScenarios, runValuation } from "../core/valuation.js";
/** Fetch a company snapshot; keeps the previous data visible while refreshing. */
export function useCompany(symbol, period) {
    const [state, setState] = useState({
        data: null,
        loading: true,
        error: null,
        refreshing: false,
    });
    const [nonce, setNonce] = useState(0);
    const lastSymbol = useRef(null);
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
            if (cancelled)
                return;
            lastSymbol.current = `${symbol}:${period}`;
            setState({ data, loading: false, error: null, refreshing: false });
        })
            .catch((err) => {
            if (cancelled)
                return;
            setState((s) => ({ ...s, loading: false, refreshing: false, error: err.message }));
        });
        return () => {
            cancelled = true;
        };
    }, [symbol, period, nonce]);
    const refresh = useCallback(() => setNonce((n) => n + 1), []);
    return { ...state, refresh };
}
export function useBenchmarks(enabled) {
    const [state, setState] = useState({ data: null, loading: false, error: null, refreshing: false });
    useEffect(() => {
        if (!enabled || state.data)
            return;
        let cancelled = false;
        setState((s) => ({ ...s, loading: true }));
        getBenchmarks()
            .then((data) => !cancelled && setState({ data, loading: false, error: null, refreshing: false }))
            .catch((err) => !cancelled && setState({ data: null, loading: false, error: err.message, refreshing: false }));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);
    return state;
}
export function useSector(sector, industry, enabled) {
    const [state, setState] = useState({ data: null, loading: false, error: null, refreshing: false });
    useEffect(() => {
        if (!enabled || !sector)
            return;
        let cancelled = false;
        setState((s) => ({ data: s.data, loading: !s.data, error: null, refreshing: !!s.data }));
        getSector(sector, industry)
            .then((data) => !cancelled && setState({ data, loading: false, error: null, refreshing: false }))
            .catch((err) => !cancelled && setState((s) => ({ ...s, loading: false, refreshing: false, error: err.message })));
        return () => {
            cancelled = true;
        };
    }, [sector, industry, enabled]);
    return state;
}
/**
 * Valuation state lives client-side so assumption edits recompute instantly —
 * no server round-trip. Reset whenever the company changes.
 */
export function useValuation(snapshot) {
    const [assumptions, setAssumptions] = useState(null);
    const defaults = useMemo(() => {
        if (!snapshot?.ok)
            return null;
        return defaultAssumptions(snapshot.info.family, snapshot.ratios, {
            price: snapshot.quote.price,
            beta: snapshot.metrics?.beta ?? null,
        });
    }, [snapshot]);
    useEffect(() => {
        setAssumptions(defaults ? structuredClone(defaults) : null);
    }, [defaults]);
    const bundle = useMemo(() => {
        if (!snapshot?.ok || !assumptions)
            return null;
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
        dirty: useMemo(() => !!(assumptions && defaults && JSON.stringify(assumptions) !== JSON.stringify(defaults)), [assumptions, defaults]),
    };
}
