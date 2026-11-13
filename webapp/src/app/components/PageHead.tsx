import type { ReactNode } from "react";
import { MBS, fmtPct, fmtPrice } from "../../core/brand.js";
import { useApp } from "../App.js";
import { Badge, RecBadge } from "./ui.js";

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/** Company identity + valuation verdict, repeated at the top of every page. */
export function CompanyStrip({ compact }: { compact?: boolean }) {
  const { snapshot, valuation } = useApp();
  if (!snapshot?.ok) return null;
  const { info, quote, ratios } = snapshot;
  const v = valuation?.valuation;

  return (
    <div
      className="card pad"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
        marginBottom: 16,
        background: "linear-gradient(120deg, #fff 0%, var(--mbs-tint-2) 100%)",
        borderColor: MBS.border,
      }}
    >
      <div style={{ minWidth: 240, flex: "1 1 260px" }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="mono" style={{ fontWeight: 700, color: MBS.primary, fontSize: 12.5 }}>
            {info.code}
          </span>
          <span className="mono muted" style={{ fontSize: 10.5 }}>
            {info.sector} · {info.industry}
          </span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: MBS.dark, letterSpacing: "-0.015em", marginTop: 1 }}>
          {info.name}
        </div>
        {!compact && (
          <div className="small muted" style={{ marginTop: 2 }}>
            FY{String(ratios.fy ?? "").slice(2)} · {ratios.nYears} years of accounts · {snapshot.meta.exchange ?? "ASX"}
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 22, flexWrap: "wrap" }}>
        <Stat label="Price" value={fmtPrice(quote.price)} sub={fmtPct(quote.changePct, 2, true)} tone={quote.changePct ?? 0} />
        <Stat
          label="Fair value"
          value={fmtPrice(v?.weightedValue ?? null)}
          sub={v ? `${fmtPct(v.upside, 1, true)} ${v.headlineBasis === "fc" ? "incl. franking" : "ex-franking"}` : undefined}
          tone={v?.upside ?? 0}
        />
        <div className="field" style={{ minWidth: 92 }}>
          <span className="tile-label">Recommendation</span>
          <div style={{ marginTop: 4 }}>
            <RecBadge rec={v?.recommendation ?? "n/a"} />
          </div>
        </div>
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {v && <Badge kind="outline">{v.isFinancial ? "Financial model" : v.family === "reit" ? "REIT model" : "Industrial model"}</Badge>}
        {snapshot.quote.week52Low !== null && (
          <Badge kind="neutral">
            52w {fmtPrice(snapshot.quote.week52Low)} – {fmtPrice(snapshot.quote.week52High)}
          </Badge>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: number }) {
  const cls = tone > 0 ? "pos" : tone < 0 ? "neg" : "muted";
  return (
    <div className="field">
      <span className="tile-label">{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      {sub && (
        <span className={`small ${cls}`} style={{ fontWeight: 700 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function Pct({ value, digits = 1, signed = true }: { value: number | null | undefined; digits?: number; signed?: boolean }) {
  const cls = value === null || value === undefined ? "muted" : value > 0 ? "pos" : value < 0 ? "neg" : "";
  return <span className={cls}>{fmtPct(value, digits, signed)}</span>;
}
