import type { ReactNode } from "react";

export function Card({
  title,
  sub,
  actions,
  children,
  flush,
  className = "",
  bodyClass = "",
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  flush?: boolean;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`card ${flush ? "flush" : ""} ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div className="card-title">
            {title}
            {sub && <span className="card-sub">{sub}</span>}
          </div>
          {actions && <div className="chart-toolbar">{actions}</div>}
        </header>
      )}
      {children !== undefined && (
        <div className={flush ? "card-body flush" : `card-body ${bodyClass}`}>{children}</div>
      )}
    </section>
  );
}

export function Tile({
  label,
  value,
  note,
  tone,
  accent,
  tip,
  small,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "pos" | "neg";
  accent?: boolean;
  tip?: string;
  small?: boolean;
}) {
  return (
    <div className={`tile${accent ? " accent" : ""}`}>
      <div className={`tile-label${tip ? " tile-tip" : ""}`} title={tip}>
        {label}
      </div>
      <div className={`tile-value${small ? " sm" : ""}${tone ? ` ${tone}` : ""}`}>{value}</div>
      {note !== undefined && <div className="tile-note">{note}</div>}
    </div>
  );
}

export function Tiles({ children }: { children: ReactNode }) {
  return <div className="tiles">{children}</div>;
}

export function Badge({ kind, children }: { kind: "buy" | "sell" | "hold" | "neutral" | "outline"; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function RecBadge({ rec }: { rec: string }) {
  const kind = rec === "Buy" ? "buy" : rec === "Sell" ? "sell" : rec === "Hold" ? "hold" : "neutral";
  return <span className={`badge ${kind}`}>{rec}</span>;
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? "active" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pill({
  active,
  onClick,
  children,
  small,
  title,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  small?: boolean;
  title?: string;
}) {
  return (
    <button
      className={`pill${small ? " small" : ""}${active ? " active" : ""}`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

export function Empty({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div style={{ fontSize: 22, opacity: 0.35 }}>◍</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="row" style={{ padding: "18px 4px", color: "var(--mbs-grey-2)", fontSize: 12.5 }}>
      <span className="spinner" />
      {label ?? "Loading…"}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <div className="error-banner">{children}</div>;
}

export function NoticeBanner({ children }: { children: ReactNode }) {
  return <div className="notice-banner">{children}</div>;
}

export function KeyValues({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T, index: number) => ReactNode;
  sortValue?: (row: T) => number | string | null;
  width?: string;
  title?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowClass,
  maxHeight,
  footer,
  note,
  compact,
  sort,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  rowClass?: (row: T) => string;
  maxHeight?: number | string;
  footer?: ReactNode;
  note?: ReactNode;
  compact?: boolean;
  sort?: { key: string; dir: "asc" | "desc" } | null;
  onSort?: (key: string) => void;
}) {
  return (
    <>
      <div className="table-wrap" style={{ maxHeight: maxHeight ?? undefined }}>
        <table className={`data${compact ? " compact" : ""}`}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ textAlign: c.align ?? "right", width: c.width }}
                  className={onSort && c.sortValue ? "sortable" : undefined}
                  title={c.title}
                  onClick={onSort && c.sortValue ? () => onSort(c.key) : undefined}
                >
                  {c.header}
                  {sort?.key === c.key && <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={rowKey(row, i)} className={rowClass?.(row)}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? "right" }}>
                    {c.render(row, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {note && <div className="table-note">{note}</div>}
    </>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="split-head">
      <h4>{children}</h4>
      {right}
    </div>
  );
}

export function ScoreBar({ value }: { value: number | null }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="score-bar" title={value === null ? undefined : `${Math.round(pct)}th percentile`}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}
