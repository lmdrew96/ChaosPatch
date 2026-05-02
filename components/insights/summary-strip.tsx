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

  // Donut math — radius 16, circumference ~100.5
  const R = 16;
  const C = 2 * Math.PI * R;
  const safeTotal = totals.total || 1;
  const doneLen = (totals.done / safeTotal) * C;
  const ipLen = (totals.in_progress / safeTotal) * C;
  const openLen = (totals.open / safeTotal) * C;

  return (
    <div className="rounded-lg border border-border bg-card/60 backdrop-blur p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Donut — done · in_progress · open */}
          <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90 shrink-0">
            <circle
              cx="22"
              cy="22"
              r={R}
              fill="none"
              stroke="var(--border)"
              strokeWidth="6"
              opacity={0.3}
            />
            {totals.total > 0 && (
              <>
                {totals.done > 0 && (
                  <circle
                    cx="22"
                    cy="22"
                    r={R}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="6"
                    strokeDasharray={`${doneLen} ${C}`}
                    strokeDashoffset="0"
                  />
                )}
                {totals.in_progress > 0 && (
                  <circle
                    cx="22"
                    cy="22"
                    r={R}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="6"
                    strokeDasharray={`${ipLen} ${C}`}
                    strokeDashoffset={`${-doneLen}`}
                  />
                )}
                {totals.open > 0 && (
                  <circle
                    cx="22"
                    cy="22"
                    r={R}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="6"
                    strokeDasharray={`${openLen} ${C}`}
                    strokeDashoffset={`${-(doneLen + ipLen)}`}
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
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
              {completionRate}% complete
            </span>
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
