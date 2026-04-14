"use client";

import Link from "next/link";
import type { ProjectSummary } from "@/lib/queries";

export function SummaryStrip({ summary }: { summary: ProjectSummary[] }) {
  const totals = summary.reduce(
    (acc, p) => ({
      open: acc.open + p.open,
      in_progress: acc.in_progress + p.in_progress,
      done: acc.done + p.done,
      total: acc.total + p.total,
    }),
    { open: 0, in_progress: 0, done: 0, total: 0 }
  );

  const completionRate =
    totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;

  // Mini bar widths
  const barTotal = totals.total || 1;
  const donePct = (totals.done / barTotal) * 100;
  const ipPct = (totals.in_progress / barTotal) * 100;
  const openPct = (totals.open / barTotal) * 100;

  return (
    <div className="rounded-lg border border-border bg-card/60 backdrop-blur p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Mini donut */}
          <svg width="32" height="32" className="-rotate-90">
            <circle
              cx="16"
              cy="16"
              r="12"
              fill="none"
              stroke="var(--border)"
              strokeWidth="4"
              opacity={0.3}
            />
            {totals.total > 0 && (
              <>
                {totals.done > 0 && (
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="4"
                    strokeDasharray={`${(totals.done / barTotal) * 75.4} 75.4`}
                    strokeDashoffset="0"
                  />
                )}
                {totals.in_progress > 0 && (
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    strokeDasharray={`${(totals.in_progress / barTotal) * 75.4} 75.4`}
                    strokeDashoffset={`${-(totals.done / barTotal) * 75.4}`}
                  />
                )}
              </>
            )}
          </svg>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-mono font-semibold tabular-nums">
                {totals.total}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                patches
              </span>
            </div>
            {/* Status mini bar */}
            <div className="flex h-1 w-32 rounded-full overflow-hidden mt-1 bg-muted/40">
              {donePct > 0 && (
                <div style={{ width: `${donePct}%`, backgroundColor: "#10b981" }} />
              )}
              {ipPct > 0 && (
                <div style={{ width: `${ipPct}%`, backgroundColor: "#f59e0b" }} />
              )}
              {openPct > 0 && (
                <div style={{ width: `${openPct}%`, backgroundColor: "#3b82f6" }} />
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-6">
          <MiniStat label="Done" value={totals.done} color="#10b981" />
          <MiniStat label="Active" value={totals.in_progress} color="#f59e0b" />
          <MiniStat label="Open" value={totals.open} color="#3b82f6" />
          <MiniStat label="Rate" value={`${completionRate}%`} />
        </div>

        <Link
          href="/insights"
          className="text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground/70 transition-colors shrink-0"
        >
          Insights →
        </Link>
      </div>

      {/* Mobile stats */}
      <div className="flex sm:hidden items-center gap-4 pt-2 border-t border-border/50">
        <MiniStat label="Done" value={totals.done} color="#10b981" />
        <MiniStat label="Active" value={totals.in_progress} color="#f59e0b" />
        <MiniStat label="Open" value={totals.open} color="#3b82f6" />
        <MiniStat label="Rate" value={`${completionRate}%`} />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-sm font-mono font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40">
        {label}
      </span>
    </div>
  );
}
