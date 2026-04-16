"use client";

import Link from "next/link";
import type { ProjectSummary, PatchWithProject, WeekBucket } from "@/lib/queries";
import { StatCard } from "@/components/insights/stat-card";
import { PriorityMatrix } from "@/components/insights/priority-matrix";
import { LifecycleStrip } from "@/components/insights/lifecycle-strip";
import { DotStrip } from "@/components/insights/dot-strip";

export function InsightsContent({
  summary,
  patches,
  timeline,
}: {
  summary: ProjectSummary[];
  patches: PatchWithProject[];
  timeline: WeekBucket[];
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
  const activePatches = patches.filter((p) => p.status === "open" || p.status === "in_progress");
  const highCount = activePatches.filter((p) => p.priority === "high").length;
  const medCount = activePatches.filter((p) => p.priority === "medium").length;
  const lowCount = activePatches.filter((p) => p.priority === "low").length;
  const prioritySub = activeCount > 0
    ? `${highCount} high · ${medCount} med · ${lowCount} low`
    : "all clear";

  // Completed patches sorted by completion date (most recent first)
  const completedWithTimes = patches
    .filter((p) => p.status === "done" && p.created_at && p.completed_at)
    .sort(
      (a, b) =>
        new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
    );
  const avgDays =
    completedWithTimes.length > 0
      ? Math.round(
          completedWithTimes.reduce((sum, p) => {
            const created = new Date(p.created_at).getTime();
            const completed = new Date(p.completed_at!).getTime();
            return sum + (completed - created) / (1000 * 60 * 60 * 24);
          }, 0) / completedWithTimes.length
        )
      : null;

  // Busiest project
  const busiest = summary.length > 0
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
            Patch activity across {summary.length} project{summary.length !== 1 ? "s" : ""}
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
          sub={totals.total > 0 ? `${Math.round((totals.done / totals.total) * 100)}% lifetime rate` : undefined}
          accent="#8CBDB9"
          glow="rgba(140, 189, 185, 0.4)"
          delay={80}
        />
        <StatCard
          label="Avg. Lifecycle"
          value={avgDays !== null ? `${avgDays}d` : "—"}
          sub={avgDays !== null ? `across ${completedWithTimes.length} patches` : "no data yet"}
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

      {/* Priority matrix — what needs attention */}
      <div className="rounded-lg border border-border bg-card p-6 animate-fade-in animation-delay-200">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-5">
          Active Patches
        </h2>
        <PriorityMatrix patches={activePatches} />
      </div>

      {/* Lifecycle strip — how fast patches close */}
      <div className="rounded-lg border border-border bg-card p-6 animate-fade-in animation-delay-400">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">
          Lifecycle by Project
        </h2>
        <LifecycleStrip patches={patches} />
      </div>

      {/* Dot strip — 3-lane activity timeline */}
      <div className="rounded-lg border border-border bg-card p-6 animate-fade-in animation-delay-400">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">
          Activity — Last 12 Weeks
        </h2>
        <DotStrip data={timeline} />
      </div>

      {/* Recent completions */}
      {completedWithTimes.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 animate-fade-in animation-delay-400">
          <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">
            Recent Completions
          </h2>
          <div className="space-y-2">
            {completedWithTimes.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 text-xs"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: p.project_color }}
                />
                <span className="text-foreground/80 truncate flex-1" title={p.title}>
                  {p.title}
                </span>
                <span className="text-muted-foreground/40 font-mono text-[10px] tabular-nums shrink-0">
                  {new Date(p.completed_at!).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
