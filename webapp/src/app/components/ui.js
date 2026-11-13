import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export function Card({ title, sub, actions, children, flush, className = "", bodyClass = "", }) {
    return (_jsxs("section", { className: `card ${flush ? "flush" : ""} ${className}`, children: [(title || actions) && (_jsxs("header", { className: "card-head", children: [_jsxs("div", { className: "card-title", children: [title, sub && _jsx("span", { className: "card-sub", children: sub })] }), actions && _jsx("div", { className: "chart-toolbar", children: actions })] })), children !== undefined && (_jsx("div", { className: flush ? "card-body flush" : `card-body ${bodyClass}`, children: children }))] }));
}
export function Tile({ label, value, note, tone, accent, tip, small, }) {
    return (_jsxs("div", { className: `tile${accent ? " accent" : ""}`, children: [_jsx("div", { className: `tile-label${tip ? " tile-tip" : ""}`, title: tip, children: label }), _jsx("div", { className: `tile-value${small ? " sm" : ""}${tone ? ` ${tone}` : ""}`, children: value }), note !== undefined && _jsx("div", { className: "tile-note", children: note })] }));
}
export function Tiles({ children }) {
    return _jsx("div", { className: "tiles", children: children });
}
export function Badge({ kind, children }) {
    return _jsx("span", { className: `badge ${kind}`, children: children });
}
export function RecBadge({ rec }) {
    const kind = rec === "Buy" ? "buy" : rec === "Sell" ? "sell" : rec === "Hold" ? "hold" : "neutral";
    return _jsx("span", { className: `badge ${kind}`, children: rec });
}
export function Seg({ options, value, onChange, }) {
    return (_jsx("div", { className: "seg", role: "tablist", children: options.map((o) => (_jsx("button", { role: "tab", "aria-selected": value === o.value, className: value === o.value ? "active" : "", onClick: () => onChange(o.value), children: o.label }, o.value))) }));
}
export function Pill({ active, onClick, children, small, title, }) {
    return (_jsx("button", { className: `pill${small ? " small" : ""}${active ? " active" : ""}`, onClick: onClick, title: title, type: "button", children: children }));
}
export function Empty({ title, message, action }) {
    return (_jsxs("div", { className: "empty", children: [_jsx("div", { style: { fontSize: 22, opacity: 0.35 }, children: "\u25CD" }), _jsx("h3", { children: title }), message && _jsx("p", { children: message }), action] }));
}
export function Spinner({ label }) {
    return (_jsxs("div", { className: "row", style: { padding: "18px 4px", color: "var(--mbs-grey-2)", fontSize: 12.5 }, children: [_jsx("span", { className: "spinner" }), label ?? "Loading…"] }));
}
export function ErrorBanner({ children }) {
    return _jsx("div", { className: "error-banner", children: children });
}
export function NoticeBanner({ children }) {
    return _jsx("div", { className: "notice-banner", children: children });
}
export function KeyValues({ rows }) {
    return (_jsx("dl", { className: "kv", children: rows.map(([k, v]) => (_jsxs("div", { style: { display: "contents" }, children: [_jsx("dt", { children: k }), _jsx("dd", { children: v })] }, k))) }));
}
export function DataTable({ columns, rows, rowKey, rowClass, maxHeight, footer, note, compact, sort, onSort, }) {
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "table-wrap", style: { maxHeight: maxHeight ?? undefined }, children: _jsxs("table", { className: `data${compact ? " compact" : ""}`, children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((c) => (_jsxs("th", { style: { textAlign: c.align ?? "right", width: c.width }, className: onSort && c.sortValue ? "sortable" : undefined, title: c.title, onClick: onSort && c.sortValue ? () => onSort(c.key) : undefined, children: [c.header, sort?.key === c.key && _jsx("span", { className: "sort-arrow", children: sort.dir === "asc" ? "▲" : "▼" })] }, c.key))) }) }), _jsx("tbody", { children: rows.map((row, i) => (_jsx("tr", { className: rowClass?.(row), children: columns.map((c) => (_jsx("td", { style: { textAlign: c.align ?? "right" }, children: c.render(row, i) }, c.key))) }, rowKey(row, i)))) }), footer && _jsx("tfoot", { children: footer })] }) }), note && _jsx("div", { className: "table-note", children: note })] }));
}
export function SectionTitle({ children, right }) {
    return (_jsxs("div", { className: "split-head", children: [_jsx("h4", { children: children }), right] }));
}
export function ScoreBar({ value }) {
    const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100;
    return (_jsx("div", { className: "score-bar", title: value === null ? undefined : `${Math.round(pct)}th percentile`, children: _jsx("i", { style: { width: `${pct}%` } }) }));
}
