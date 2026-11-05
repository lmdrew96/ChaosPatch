"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ProjectSummary, PatchWithProject } from "@/lib/queries";
import { StatCard } from "@/components/insights/stat-card";
import { RateCard, type RateWindow } from "@/components/insights/rate-card";
import { StuckList } from "@/components/insights/stuck-list";
import { ActiveBars } from "@/components/insights/active-bars";
import { MomentumTrend } from "@/components/insights/momentum-trend";
import { CompletionHeatmap } from "@/components/insights/completion-heatmap";
import { ShippedWall } from "@/components/insights/shipped-wall";
import { WaitingList, reviewSince, daysSince } from "@/components/insights/waiting-list";

export function InsightsContent({
  summary,
  patches,
}: {
  summary: ProjectSummary[];
  patches: PatchWithProject[];
}) {
  // Active = work still to do (open + in progress). Review is finished work
  // waiting on Nae, so it gets its own card. Archived patches/projects are
  // hidden from the board, so leave them out.
  const onBoard = patches.filter((p) => !p.archived && !p.project_archived);
  const activePatches = onBoard.filter(
    (p) => p.status === "open" || p.status === "in_progress"
  );
  const reviewPatches = onBoard.filter((p) => p.status === "review");
  const activeCount = activePatches.length;
  const highCount = activePatches.filter((p) => p.priority === "high").length;
  const medCount = activePatches.filter((p) => p.priority === "medium").length;
  const lowCount = activePatches.filter((p) => p.priority === "low").length;
  const prioritySub =
    activeCount > 0
      ? `${highCount} high · ${medCount} med · ${lowCount} low`
      : "all clear";

  // Completions include archived patches (summary counts exclude them).
  const completed = patches.filter((p) => p.status === "done" && p.completed_at);
  const completedCount = completed.length;

  // Daily rate tri-score: completions ÷ days in each window. When the account
  // is younger than a window, divide by the days actually elapsed.
  const DAY_MS = 86_400_000;
  const [now] = useState(() => Date.now());
  const earliestCreated = patches.reduce<number | null>((min, p) => {
    const t = new Date(p.created_at).getTime();
    return min === null || t < min ? t : min;
  }, null);
  const historyDays =
    earliestCreated !== null ? Math.max(1, Math.ceil((now - earliestCreated) / DAY_MS)) : 0;
  const rateOver = (windowDays: number | null): RateWindow | null => {
    if (historyDays === 0) return null;
    const days = windowDays === null ? historyDays : Math.min(windowDays, historyDays);
    const since = windowDays === null ? -Infinity : now - windowDays * DAY_MS;
    const count = completed.filter((p) => new Date(p.completed_at!).getTime() >= since).length;
    return {
      rate: count / days,
      days,
      partial: windowDays !== null && historyDays < windowDays,
    };
  };

  // Net flow this week: added minus done. Shown as plain numbers, not a
  // verdict — it rises when specs are filed in batches, which is healthy.
  const weekAgo = now - 7 * DAY_MS;
  const addedWeek = patches.filter((p) => new Date(p.created_at).getTime() >= weekAgo).length;
  const doneWeek = completed.filter((p) => new Date(p.completed_at!).getTime() >= weekAgo).length;
  const netFlow = addedWeek - doneWeek;
  // This week's wins, newest first; archived work still counts.
  const shippedWeek = completed
    .filter((p) => new Date(p.completed_at!).getTime() >= weekAgo)
    .sort(
      (a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime()
    );
  const netFlowDisplay = netFlow > 0 ? `+${netFlow}` : netFlow < 0 ? `−${-netFlow}` : "0";

  // Waiting on you: oldest wait among review patches, in days.
  const oldestWait = reviewPatches.reduce<{ days: number; approximate: boolean } | null>(
    (oldest, p) => {
      const { since, approximate } = reviewSince(p);
      const days = daysSince(since, now);
      return oldest === null || days > oldest.days ? { days, approximate } : oldest;
    },
    null
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #9F8DEF, #AFCEFD, #3A5874)",
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
          className="inline-flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-foreground/70 transition-colors"
        >
          <ArrowLeft aria-hidden className="h-3 w-3" />
          Dashboard
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Active"
          value={activeCount}
          sub={prioritySub}
          accent="#9F8DEF"
          glow="rgba(159, 141, 239, 0.4)"
        />
        <StatCard
          label="Backlog · 7d"
          value={netFlowDisplay}
          sub={`${addedWeek} added · ${doneWeek} done`}
          sub2={`${completedCount} done all-time`}
          accent="#3A5874"
          glow="rgba(58, 88, 116, 0.4)"
        />
        <RateCard
          week={rateOver(7)}
          month={rateOver(30)}
          allTime={rateOver(null)}
          accent="#AFCEFD"
          glow="rgba(175, 206, 253, 0.4)"
        />
        <StatCard
          label="Waiting on you"
          value={reviewPatches.length}
          sub={
            oldestWait
              ? `oldest: ${oldestWait.approximate ? "~" : ""}${oldestWait.days}d in review`
              : "nothing in review"
          }
          accent="#4E3459"
          glow="rgba(78, 52, 89, 0.4)"
          href={reviewPatches.length > 0 ? "#waiting-on-you" : undefined}
        />
      </div>

      {/* Waiting on you — finished patches awaiting review */}
      {reviewPatches.length > 0 && (
        <div
          id="waiting-on-you"
          className="hud-panel scroll-mt-24 rounded-lg border border-border bg-card p-6"
        >
          <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">
            Waiting on you
          </h2>
          <WaitingList patches={reviewPatches} now={now} />
        </div>
      )}

      <ShippedWall patches={shippedWeek} />

      {/* Active patches — load per project, segmented by priority */}
      <div className="hud-panel rounded-lg border border-border bg-card p-6">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-5">
          Active Patches
        </h2>
        <ActiveBars patches={activePatches} />
      </div>

      {/* Stuck — stalled in-progress work and never-started backlog; hides when empty */}
      <StuckList patches={activePatches} now={now} />

      {/* Completion momentum — daily volume stacked by project + 7-day avg */}
      <div className="hud-panel rounded-lg border border-border bg-card p-6">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">
          Completion Momentum
        </h2>
        <MomentumTrend patches={patches} />
      </div>

      {/* Completion heatmap — day of week × hour of day */}
      <div className="hud-panel rounded-lg border border-border bg-card p-6">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">
          Completion Rhythm
        </h2>
        <CompletionHeatmap patches={patches} />
      </div>
    </div>
  );
}
