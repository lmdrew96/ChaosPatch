"use client";

import { useState } from "react";
import type { PatchWithProject } from "@/lib/queries";
import { useContainerWidth } from "@/hooks/use-container-width";

// Momentum panel: daily completion volume (stacked by project) with a
// 7-day trailing rolling-average line showing trajectory. Replaces the
// lifecycle-by-project panel. Buckets days in BROWSER-LOCAL time to stay
// consistent with completion-heatmap (which uses Date.getDay/getHours).

type RangeOption = { label: string; days: number | null };
const RANGES: RangeOption[] = [
  { label: "30", days: 30 },
  { label: "60", days: 60 },
  { label: "90", days: 90 },
  { label: "All", days: null },
];

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

const TOP_N = 6;
const OTHER_KEY = "Other";
const OTHER_COLOR = "#8A8780"; // neutral warm gray for the long tail

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
// Local calendar-day key — deliberately NOT toISOString (that's UTC and would
// split days at the wrong boundary vs. the heatmap's local bucketing).
const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmtDay = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

type DayCell = {
  key: string;
  date: Date;
  total: number;
  byProject: Map<string, number>;
};

export function MomentumTrend({ patches }: { patches: PatchWithProject[] }) {
  const { ref, width } = useContainerWidth();
  const [rangeIdx, setRangeIdx] = useState(0); // default: 30 days
  const range = RANGES[rangeIdx];

  const done = patches.filter((p) => p.status === "done" && p.completed_at);

  if (done.length === 0) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/50"
      >
        Momentum will appear here as you ship patches
      </div>
    );
  }

  // Window bounds (local). End = today; start = today-(days-1), or earliest
  // completion for "All".
  const today = startOfLocalDay(new Date());
  const earliest = done.reduce<Date>((min, p) => {
    const d = startOfLocalDay(new Date(p.completed_at!));
    return d < min ? d : min;
  }, today);
  const start =
    range.days === null
      ? earliest
      : startOfLocalDay(new Date(today.getTime() - (range.days - 1) * 86_400_000));

  // Pre-build a continuous day spine so zero-days render as gaps, not skips.
  const cells: DayCell[] = [];
  const cellByKey = new Map<string, DayCell>();
  for (let t = start.getTime(); t <= today.getTime(); t += 86_400_000) {
    const date = new Date(t);
    const cell: DayCell = { key: localKey(date), date, total: 0, byProject: new Map() };
    cells.push(cell);
    cellByKey.set(cell.key, cell);
  }

  // Tally completions into the spine + per-project totals over the window.
  const projectTotals = new Map<string, number>();
  const projectColor = new Map<string, string>();
  for (const p of done) {
    const cell = cellByKey.get(localKey(new Date(p.completed_at!)));
    if (!cell) continue; // outside window
    cell.total++;
    cell.byProject.set(p.project_name, (cell.byProject.get(p.project_name) ?? 0) + 1);
    projectTotals.set(p.project_name, (projectTotals.get(p.project_name) ?? 0) + 1);
    if (!projectColor.has(p.project_name)) projectColor.set(p.project_name, p.project_color);
  }

  // Top N projects keep their brand color; the rest collapse into "Other"
  // so the stack stays legible instead of a 19-color rainbow.
  const ranked = Array.from(projectTotals.entries()).sort((a, b) => b[1] - a[1]);
  const topNames = ranked.slice(0, TOP_N).map(([name]) => name);
  const hasOther = ranked.length > TOP_N;
  const stackOrder = hasOther ? [...topNames, OTHER_KEY] : topNames;
  const colorFor = (key: string) =>
    key === OTHER_KEY ? OTHER_COLOR : projectColor.get(key) ?? OTHER_COLOR;

  // Fold tail projects into Other per day, in stack order.
  const stacked = cells.map((c) => {
    const segs = stackOrder.map((key) => {
      if (key === OTHER_KEY) {
        let sum = 0;
        for (const [name, n] of c.byProject) if (!topNames.includes(name)) sum += n;
        return { key, count: sum };
      }
      return { key, count: c.byProject.get(key) ?? 0 };
    });
    return { cell: c, segs };
  });

  // 7-day trailing rolling average of daily totals = the momentum signal.
  const totals = cells.map((c) => c.total);
  const rolling = totals.map((_, i) => {
    const w = totals.slice(Math.max(0, i - 6), i + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });

  // Peak day (single-day high).
  let peakIdx = 0;
  for (let i = 1; i < totals.length; i++) if (totals[i] > totals[peakIdx]) peakIdx = i;
  const peakVal = totals[peakIdx];

  const isMobile = width < 480;
  const W = Math.max(width, 1);
  const PAD = {
    top: 22,
    right: isMobile ? 10 : 14,
    bottom: isMobile ? 52 : 44,
    left: isMobile ? 26 : 32,
  };
  const innerW = W - PAD.left - PAD.right;
  const plotH = isMobile ? 150 : 168;
  const H = PAD.top + plotH + PAD.bottom;
  const baseY = PAD.top + plotH;

  const maxVal = Math.max(1, ...totals);
  const slot = innerW / Math.max(1, cells.length);
  const barW = Math.max(1, Math.min(slot - 1.5, isMobile ? 7 : 9));
  const cx = (i: number) => PAD.left + i * slot + slot / 2;
  const yFor = (v: number) => baseY - (v / maxVal) * plotH;

  // 2–3 y gridlines at rounded values.
  const tickStep = maxVal <= 10 ? 5 : maxVal <= 20 ? 10 : maxVal <= 50 ? 20 : 50;
  const ticks: number[] = [];
  for (let t = tickStep; t <= maxVal; t += tickStep) ticks.push(t);

  // ~5 evenly spaced x labels.
  const labelEvery = Math.max(1, Math.ceil(cells.length / 5));
  const rollPts = rolling.map((r, i) => `${cx(i).toFixed(1)},${yFor(r).toFixed(1)}`).join(" ");

  return (
    <div ref={ref} className="w-full overflow-x-hidden">
      {/* Range toggle */}
      <div className="flex justify-end gap-1 mb-2">
        {RANGES.map((r, i) => (
          <button
            key={r.label}
            onClick={() => setRangeIdx(i)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
              i === rangeIdx
                ? "bg-foreground/10 text-foreground/80"
                : "text-muted-foreground/50 hover:text-foreground/60"
            }`}
          >
            {r.label}
            {r.days ? "d" : ""}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Gridlines + y labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              y1={yFor(t)}
              x2={PAD.left + innerW}
              y2={yFor(t)}
              stroke="var(--border)"
              strokeWidth={0.5}
              opacity={0.18}
            />
            <text
              x={PAD.left - 5}
              y={yFor(t)}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-muted-foreground/40"
              fontSize={isMobile ? 9 : 8}
              fontFamily="var(--font-geist-mono, monospace)"
            >
              {t}
            </text>
          </g>
        ))}
        {/* Baseline */}
        <line
          x1={PAD.left}
          y1={baseY}
          x2={PAD.left + innerW}
          y2={baseY}
          stroke="var(--border)"
          strokeWidth={0.5}
          opacity={0.4}
        />

        {/* Stacked daily bars */}
        {stacked.map(({ cell, segs }, i) => {
          let cursorY = baseY;
          return (
            <g
              key={cell.key}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(i * 6, 400) + 120}ms` }}
            >
              {segs.map((seg) => {
                if (seg.count === 0) return null;
                const h = (seg.count / maxVal) * plotH;
                cursorY -= h;
                return (
                  <rect
                    key={seg.key}
                    x={cx(i) - barW / 2}
                    y={cursorY}
                    width={barW}
                    height={h}
                    fill={colorFor(seg.key)}
                    opacity={0.8}
                    rx={1}
                  >
                    <title>
                      {fmtDay(cell.date)} · {seg.key}: {seg.count} patch
                      {seg.count === 1 ? "" : "es"}
                    </title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {/* 7-day rolling average — neutral foreground line so it reads as the
            aggregate signal over the colored stack, in both light/dark mode. */}
        <g className="text-foreground">
          <polyline
            points={rollPts}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.75}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>

        {/* Peak marker */}
        <circle cx={cx(peakIdx)} cy={yFor(peakVal)} r={3} fill="#DFA649" />

        {/* X-axis date labels */}
        {cells.map((c, i) =>
          i % labelEvery === 0 ? (
            <text
              key={c.key}
              x={cx(i)}
              y={baseY + 14}
              textAnchor="middle"
              className="fill-muted-foreground/40"
              fontSize={isMobile ? 9 : 8}
              fontFamily="var(--font-geist-mono, monospace)"
            >
              {fmtDay(c.date)}
            </text>
          ) : null
        )}

        {/* Peak callout — mirrors the heatmap footer style */}
        <text
          x={PAD.left}
          y={H - (isMobile ? 30 : 22)}
          className="fill-muted-foreground/45"
          fontSize={isMobile ? 10 : 9}
          fontFamily="var(--font-geist-mono, monospace)"
        >
          peak: {fmtDay(cells[peakIdx].date)} · {peakVal} patch
          {peakVal === 1 ? "" : "es"}
        </text>

        {/* X-axis caption */}
        <text
          x={PAD.left + innerW / 2}
          y={H - (isMobile ? 14 : 6)}
          textAnchor="middle"
          className="fill-muted-foreground/30"
          fontSize={8}
          fontFamily="var(--font-geist-mono, monospace)"
          letterSpacing="0.08em"
        >
          {isMobile
            ? "DAILY VOLUME · LINE = 7-DAY AVG"
            : "COMPLETED PER DAY BY PROJECT · LINE = 7-DAY AVERAGE"}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-1 justify-center text-[10px] text-muted-foreground/60 font-mono">
        {stackOrder.map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: colorFor(key), opacity: 0.8 }}
            />
            <span>
              {key.length > 14 ? key.slice(0, 13) + "…" : key}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-[2px] bg-foreground/75 rounded" />
          <span>7-day avg</span>
        </div>
      </div>
    </div>
  );
}
