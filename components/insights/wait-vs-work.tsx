"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { PatchWithProject } from "@/lib/queries";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MIN_PATCHES = 10;

type PhaseKey = "toStart" | "building" | "toReview";

const PHASES: { key: PhaseKey; label: string; hint: string; color: string }[] = [
  { key: "toStart", label: "Waiting to start", hint: "filed → started", color: "#3A5874" },
  { key: "building", label: "Building", hint: "started → sent to review", color: "#9F8DEF" },
  { key: "toReview", label: "Waiting for review", hint: "sent to review → done", color: "#4E3459" },
];

type WindowOption = { label: string; days: number | null };
const WINDOWS: WindowOption[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "All", days: null },
];

type Durations = Record<PhaseKey, number[]>;

type Phases = {
  durations: Durations;
  // Done patches with no started_at: can't fill waiting-to-start or building.
  skipped: number;
  // Done patches with no reviewed_at: building runs to completed_at, so it may
  // include review wait (reviewed_at only exists from v0.58.0 on).
  untrackedReview: number;
};

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : null);

const splitPhases = (patches: PatchWithProject[]): Phases => {
  const durations: Durations = { toStart: [], building: [], toReview: [] };
  let skipped = 0;
  let untrackedReview = 0;
  for (const p of patches) {
    const created = ms(p.created_at)!;
    const started = ms(p.started_at);
    const reviewed = ms(p.reviewed_at);
    const completed = ms(p.completed_at)!;
    if (reviewed !== null) durations.toReview.push(Math.max(0, completed - reviewed));
    else untrackedReview++;
    if (started === null) {
      skipped++;
      continue;
    }
    durations.toStart.push(Math.max(0, started - created));
    durations.building.push(Math.max(0, (reviewed ?? completed) - started));
  }
  return { durations, skipped, untrackedReview };
};

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const oneDecimal = (n: number) => (n < 10 ? n.toFixed(1).replace(/\.0$/, "") : Math.round(n).toString());

// Minutes under an hour, hours under a day, then days only.
const fmtDuration = (d: number | null): string => {
  if (d === null) return "—";
  if (d < HOUR_MS) return `${Math.max(1, Math.round(d / 60_000))}m`;
  if (d < DAY_MS) return `${oneDecimal(d / HOUR_MS)}h`;
  return `${oneDecimal(d / DAY_MS)}d`;
};

/**
 * Wait vs. work: where a finished patch's time goes. Median time per phase
 * over the chosen window (by completion date), plus a per-project breakdown.
 * Expects all patches, archived included; filters to done itself.
 */
export function WaitVsWork({ patches, now }: { patches: PatchWithProject[]; now: number }) {
  const [windowIdx, setWindowIdx] = useState(1); // default: 30 days
  const [byProjectOpen, setByProjectOpen] = useState(false);
  const win = WINDOWS[windowIdx];

  const since = win.days === null ? -Infinity : now - win.days * DAY_MS;
  const done = patches.filter(
    (p) => p.status === "done" && p.completed_at && new Date(p.completed_at).getTime() >= since
  );

  const toggle = (
    <div className="flex justify-end gap-1 mb-4">
      {WINDOWS.map((w, i) => (
        <button
          key={w.label}
          type="button"
          onClick={() => setWindowIdx(i)}
          className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
            i === windowIdx
              ? "bg-foreground/10 text-foreground/80"
              : "text-muted-foreground/50 hover:text-foreground/60"
          }`}
        >
          {w.label}
        </button>
      ))}
    </div>
  );

  if (done.length < MIN_PATCHES) {
    return (
      <>
        {toggle}
        <div className="flex items-center justify-center h-[100px] text-xs text-muted-foreground/50 text-center">
          Not enough data yet — {done.length} finished patch{done.length === 1 ? "" : "es"}{" "}
          {win.days === null ? "so far" : `in the last ${win.days} days`} (needs {MIN_PATCHES})
        </div>
      </>
    );
  }

  const { durations, skipped, untrackedReview } = splitPhases(done);
  const medians = Object.fromEntries(
    PHASES.map(({ key }) => [key, median(durations[key])])
  ) as Record<PhaseKey, number | null>;
  const maxMedian = Math.max(1, ...PHASES.map(({ key }) => medians[key] ?? 0));

  // Per-project medians, busiest first.
  const byProject = new Map<string, { name: string; color: string; patches: PatchWithProject[] }>();
  for (const p of done) {
    const g = byProject.get(p.project_slug) ?? {
      name: p.project_name,
      color: p.project_color,
      patches: [],
    };
    g.patches.push(p);
    byProject.set(p.project_slug, g);
  }
  const projectRows = [...byProject.entries()]
    .map(([slug, g]) => {
      const { durations: d } = splitPhases(g.patches);
      return {
        slug,
        name: g.name,
        color: g.color,
        count: g.patches.length,
        medians: Object.fromEntries(PHASES.map(({ key }) => [key, median(d[key])])) as Record<
          PhaseKey,
          number | null
        >,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <>
      {toggle}

      {/* Three medians, each bar scaled to the longest phase */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PHASES.map(({ key, label, hint, color }) => {
          const m = medians[key];
          return (
            <div key={key} className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50">
                {label}
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums tracking-tight text-foreground/90 mt-1">
                {fmtDuration(m)}
              </p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-foreground/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: m === null ? 0 : `${Math.max(2, (m / maxMedian) * 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/40 mt-1.5">
                median · {hint} · {durations[key].length} patch
                {durations[key].length === 1 ? "" : "es"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footnotes: what couldn't be measured */}
      {(skipped > 0 || untrackedReview > 0) && (
        <div className="mt-4 space-y-0.5 text-[10px] font-mono text-muted-foreground/40">
          {skipped > 0 && (
            <p>
              {skipped} skipped for waiting/building: never marked started
            </p>
          )}
          {untrackedReview > 0 && (
            <p>
              {untrackedReview} finished before review times were tracked: their building time
              runs to done, so it may include review wait
            </p>
          )}
        </div>
      )}

      {/* Per-project breakdown, collapsed by default */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setByProjectOpen((v) => !v)}
          aria-expanded={byProjectOpen}
          className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <ChevronRight
            aria-hidden
            className={`h-3 w-3 transition-transform ${byProjectOpen ? "rotate-90" : ""}`}
          />
          By project · {projectRows.length}
        </button>
        {byProjectOpen && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  <th className="text-left font-normal py-1 pr-2">Project</th>
                  <th className="text-right font-normal py-1 px-2">Done</th>
                  {PHASES.map(({ key, label }) => (
                    <th key={key} className="text-right font-normal py-1 pl-2 whitespace-nowrap">
                      {label.replace("Waiting ", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectRows.map((r) => (
                  <tr key={r.slug} className="border-t border-border/40">
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: r.color }}
                          aria-hidden
                        />
                        <span className="truncate text-foreground/80">{r.name}</span>
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-muted-foreground/70">
                      {r.count}
                    </td>
                    {PHASES.map(({ key }) => (
                      <td
                        key={key}
                        className="py-1.5 pl-2 text-right font-mono tabular-nums text-foreground/80"
                      >
                        {fmtDuration(r.medians[key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
