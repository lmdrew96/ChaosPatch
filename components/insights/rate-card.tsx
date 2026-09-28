"use client";

export type RateWindow = {
  // Completions per day over the window.
  rate: number;
  // Days actually divided by — less than the window when the account is younger.
  days: number;
  partial: boolean;
};

const fmtRate = (r: number): string => (r >= 10 ? Math.round(r).toString() : r.toFixed(1));

// Daily Rate tri-score: 7-day pace is the hero, 30-day and all-time give context.
export function RateCard({
  week,
  month,
  allTime,
  accent,
  glow,
  delay = 0,
}: {
  week: RateWindow | null;
  month: RateWindow | null;
  allTime: RateWindow | null;
  accent?: string;
  glow?: string;
  delay?: number;
}) {
  return (
    <div
      className="hud-panel relative rounded-lg border border-border bg-card p-4 overflow-hidden animate-fade-in"
      style={{
        animationDelay: `${delay}ms`,
        borderLeftWidth: 3,
        borderLeftColor: accent,
      }}
    >
      {accent && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: accent, opacity: 0.04 }}
        />
      )}
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 mb-2 relative">
        Daily Rate
      </p>

      {week === null || month === null || allTime === null ? (
        <>
          <p
            className="text-3xl font-bold font-mono tabular-nums tracking-tight relative"
            style={{ color: accent }}
          >
            —
          </p>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 font-mono relative">
            no data yet
          </p>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5 relative">
            <span
              className="text-3xl font-bold font-mono tabular-nums tracking-tight"
              style={{ color: accent, textShadow: glow ? `0 0 20px ${glow}` : undefined }}
            >
              {fmtRate(week.rate)}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/50">
              /day · 7d{week.partial ? "*" : ""}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-3 font-mono relative">
            <span className="flex items-baseline gap-1">
              <span className="text-base font-semibold tabular-nums text-foreground/70">
                {fmtRate(month.rate)}
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                30d{month.partial ? "*" : ""}
              </span>
            </span>
            <span className="flex items-baseline gap-1">
              <span className="text-[11px] tabular-nums text-muted-foreground/60">
                {fmtRate(allTime.rate)}
              </span>
              <span className="text-[10px] text-muted-foreground/40">all</span>
            </span>
          </div>
          {/* A younger account divides by the days it actually has, never the full window. */}
          {month.partial && (
            <p className="text-[9px] font-mono text-muted-foreground/40 mt-1 relative">
              * partial: only {month.days}d of history
            </p>
          )}
        </>
      )}
    </div>
  );
}
