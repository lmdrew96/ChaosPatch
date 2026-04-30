"use client";

import Link from "next/link";
import type { ProjectSummary, PatchWithProject } from "@/lib/queries";
import { StatCard } from "@/components/insights/stat-card";
import { ActiveBeeswarm } from "@/components/insights/active-beeswarm";
import { LifecycleBars } from "@/components/insights/lifecycle-bars";
import { CompletionHeatmap } from "@/components/insights/completion-heatmap";

export function InsightsContent({
  summary,
  patches,
}: {
  summary: ProjectSummary[];
  patches: PatchWithProject[];
}) {
  const totals = summary.reduce(
    (acc, p) => ({
      open: acc.open + p.open,
      in_progress: acc.in_progress + p.in_progress,
      done: acc.done + p.done,
      total: acc.total + p.total,
    }),
    { open: 0, in_progress: 0, done: 0, total: 0 }
  );

  const activeCount = totals.open + totals.in_progress;

  // Priority breakdown for active patches
  const activePatches = patches.filter(
    (p) => p.status === "open" || p.status === "in_progress"
  );
  const highCount = activePatches.filter((p) => p.priority === "high").length;
  const medCount = activePatches.filter((p) => p.priority === "medium").length;
  const lowCount = activePatches.filter((p) => p.priority === "low").length;
  const prioritySub =
    activeCount > 0
      ? `${highCount} high · ${medCount} med · ${lowCount} low`
      : "all clear";

  // Daily completion rate: completions / days since first patch was created
  const completedCount = patches.filter((p) => p.status === "done").length;
  const earliestCreated = patches.reduce<number | null>((min, p) => {
    const t = new Date(p.created_at).getTime();
    return min === null || t < min ? t : min;
  }, null);
  const daysSinceFirst =
    earliestCreated !== null
      ? Math.max(
          1,
          Math.ceil((Date.now() - earliestCreated) / (1000 * 60 * 60 * 24))
        )
      : 0;
  const dailyRate = daysSinceFirst > 0 ? completedCount / daysSinceFirst : 0;
  const dailyRateDisplay =
    daysSinceFirst > 0
      ? dailyRate >= 10
        ? Math.round(dailyRate).toString()
        : dailyRate.toFixed(1)
      : "—";
  const dailySub =
    daysSinceFirst > 0
      ? `across ${daysSinceFirst} day${daysSinceFirst === 1 ? "" : "s"} · ${completedCount} done`
      : "no data yet";

  // Busiest project
  const busiest =
    summary.length > 0
      ? summary.reduce((max, p) => (p.total > max.total ? p : max), summary[0])
      : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #88739E, #DFA649, #8CBDB9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Insights
          </h1>
          <p className="text-xs text-muted-foreground/50 mt-0.5">
            Patch activity across {summary.length} project
            {summary.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground/50 hover:text-foreground/70 transition-colors"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Active"
          value={activeCount}
          sub={prioritySub}
          accent="#88739E"
          glow="rgba(136, 115, 158, 0.4)"
          delay={0}
        />
        <StatCard
          label="Completed"
          value={totals.done}
          sub={
            totals.total > 0
              ? `${Math.round((totals.done / totals.total) * 100)}% lifetime rate`
              : undefined
          }
          accent="#8CBDB9"
          glow="rgba(140, 189, 185, 0.4)"
          delay={80}
        />
        <StatCard
          label="Daily Rate"
          value={dailyRateDisplay}
          sub={dailySub}
          accent="#DFA649"
          glow="rgba(223, 166, 73, 0.4)"
          delay={160}
        />
        <StatCard
          label="Projects"
          value={summary.length}
          sub={busiest ? `busiest: ${busiest.project_name}` : undefined}
          accent="#244952"
          glow="rgba(36, 73, 82, 0.4)"
          delay={240}
        />
      </div>

      {/* Active patches — beeswarm by age, lanes by priority */}
      <div className="rounded-lg border border-border bg-card p-6 animate-fade-in animation-delay-200">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-5">
          Active Patches
        </h2>
        <ActiveBeeswarm patches={patches} />
      </div>

      {/* Lifecycle by project — horizontal stacked bars */}
      <div className="rounded-lg border border-border bg-card p-6 animate-fade-in animation-delay-400">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">
          Lifecycle by Project
        </h2>
        <LifecycleBars patches={patches} />
      </div>

      {/* Completion heatmap — day of week × hour of day */}
      <div className="rounded-lg border border-border bg-card p-6 animate-fade-in animation-delay-400">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">
          Completion Rhythm
        </h2>
        <CompletionHeatmap patches={patches} />
      </div>
    </div>
  );
}
