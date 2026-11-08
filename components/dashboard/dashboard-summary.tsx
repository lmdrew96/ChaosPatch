"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, CircleCheck, Eye, Sparkles, Zap } from "lucide-react";
import type { DashboardSummaryData, PatchWithProject } from "@/lib/queries";
import { PatchListItem, timeAgo } from "./patch-list-item";

// ── Needs Review, grouped by project ──────────────────────────────────────

type ReviewGroup = {
  slug: string;
  name: string;
  color: string;
  patches: PatchWithProject[];
};

/**
 * One collapsible row per project with patches waiting on review. Rows keep
 * the server's oldest-first order, so the project with the longest wait is
 * on top. Hidden when nothing is waiting — it's a to-do, not a stat.
 */
export function ReviewQueue({ patches }: { patches: PatchWithProject[] }) {
  const groups = useMemo(() => {
    const bySlug = new Map<string, ReviewGroup>();
    for (const p of patches) {
      const group = bySlug.get(p.project_slug) ?? {
        slug: p.project_slug,
        name: p.project_name,
        color: p.project_color,
        patches: [],
      };
      group.patches.push(p);
      bySlug.set(p.project_slug, group);
    }
    return [...bySlug.values()];
  }, [patches]);

  // A single project has nothing to scan past, so start it open.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(groups.length === 1 ? [groups[0].slug] : [])
  );
  const toggle = (slug: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  if (patches.length === 0) return null;

  return (
    <section
      aria-labelledby="needs-review-heading"
      className="hud-panel rounded-lg border border-border bg-card/60 backdrop-blur p-4 animate-fade-in"
    >
      <h2 id="needs-review-heading" className="flex items-baseline gap-2 mb-3">
        <Eye aria-hidden className="h-4 w-4 self-center text-cyan-600 dark:text-cyan-400" />
        <span className="text-sm font-medium text-foreground/90">Needs Review</span>
        <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
          ({patches.length})
        </span>
      </h2>
      <ul className="space-y-1.5">
        {groups.map((g) => {
          const isOpen = open.has(g.slug);
          const highCount = g.patches.filter((p) => p.priority === "high").length;
          // Oldest first, so [0] has waited longest.
          const oldest = g.patches[0].reviewed_at ?? g.patches[0].updated_at;
          const listId = `review-${g.slug}`;
          return (
            <li key={g.slug} className="list-none">
              <button
                type="button"
                onClick={() => toggle(g.slug)}
                aria-expanded={isOpen}
                aria-controls={listId}
                className="flex w-full items-center gap-2.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-left hover:border-muted-foreground/40 hover:bg-card transition-colors"
              >
                <ChevronRight
                  aria-hidden
                  className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: g.color }}
                />
                <span className="text-sm text-foreground/90 truncate flex-1 min-w-0">
                  {g.name}
                </span>
                {highCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-destructive bg-destructive/10 border border-destructive/30 rounded px-1.5 py-0.5 shrink-0">
                    {highCount} High
                  </span>
                )}
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">
                  {g.patches.length}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider text-muted-foreground/50 shrink-0 tabular-nums hidden sm:inline"
                  title="Longest wait in this project"
                >
                  {timeAgo(oldest)}
                </span>
              </button>
              {isOpen && (
                <ul id={listId} className="mt-1.5 ml-4 space-y-1.5">
                  {g.patches.map((p) => (
                    <PatchListItem
                      key={p.id}
                      patch={p}
                      timestamp={p.reviewed_at ?? p.updated_at}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Activity strip ────────────────────────────────────────────────────────

/** In progress · recently done · recently added, about one line per item. */
export function ActivityStrip({ data }: { data: DashboardSummaryData }) {
  const { inProgress, recentlyCompleted, recentlyAdded, counts } = data;
  if (
    counts.inProgress === 0 &&
    recentlyCompleted.length === 0 &&
    recentlyAdded.length === 0
  ) {
    return null;
  }

  return (
    <section
      aria-label="Recent activity"
      className="hud-panel rounded-lg border border-border bg-card/60 backdrop-blur px-4 py-3 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-5"
    >
      <ActivityColumn
        icon={<Zap aria-hidden className="h-3.5 w-3.5 text-primary" />}
        label="In progress"
        count={counts.inProgress}
        extra={`${counts.open} open`}
        empty="Nothing in progress."
        items={inProgress.map((p) => ({ patch: p, at: p.started_at, daysOnly: true }))}
      />
      <ActivityColumn
        icon={<CircleCheck aria-hidden className="h-3.5 w-3.5 text-success" />}
        label="Recently done"
        count={recentlyCompleted.length}
        empty="Nothing shipped in 14 days."
        items={recentlyCompleted.map((p) => ({ patch: p, at: p.completed_at }))}
      />
      <ActivityColumn
        icon={<Sparkles aria-hidden className="h-3.5 w-3.5 text-primary" />}
        label="Recently added"
        count={recentlyAdded.length}
        empty="No new patches in 7 days."
        items={recentlyAdded.map((p) => ({ patch: p, at: p.created_at }))}
      />
    </section>
  );
}

function ActivityColumn({
  icon,
  label,
  count,
  extra,
  empty,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  extra?: string;
  empty: string;
  items: { patch: PatchWithProject; at: string | null; daysOnly?: boolean }[];
}) {
  return (
    <div className="min-w-0">
      <h3 className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
        {icon}
        {label}
        <span className="font-mono tabular-nums">({count})</span>
        {extra && (
          <span className="ml-auto normal-case tracking-normal font-mono text-muted-foreground/50">
            {extra}
          </span>
        )}
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/50">{empty}</p>
      ) : (
        <ul>
          {items.map(({ patch, at, daysOnly }) => (
            <li key={patch.id} className="list-none">
              <Link
                href={`/projects/${patch.project_slug}?patch=${patch.id}`}
                className="flex items-center gap-2 rounded px-1 -mx-1 py-1 hover:bg-muted/50 transition-colors"
              >
                <span
                  aria-hidden
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: patch.project_color }}
                />
                <span className="text-xs text-foreground/85 truncate flex-1 min-w-0" title={patch.title}>
                  {patch.title}
                </span>
                <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums">
                  {timeAgo(at, daysOnly)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
