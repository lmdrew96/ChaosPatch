"use client";

import type { PatchWithProject } from "@/lib/queries";
import { useContainerWidth } from "@/hooks/use-container-width";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEAT_COLOR = "#88739E"; // mauve purple

export function CompletionHeatmap({ patches }: { patches: PatchWithProject[] }) {
  const { ref, width } = useContainerWidth();
  // Build 7 (day-of-week, Mon=0) × 24 (hour) grid in browser local timezone
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(0)
  );

  let total = 0;
  for (const p of patches) {
    if (p.status !== "done" || !p.completed_at) continue;
    const d = new Date(p.completed_at);
    const dow = (d.getDay() + 6) % 7; // remap Sun=0..Sat=6 → Mon=0..Sun=6
    const hour = d.getHours();
    grid[dow][hour]++;
    total++;
  }

  if (total === 0) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/50"
      >
        Completion rhythm will appear here as you ship patches
      </div>
    );
  }

  let max = 0;
  let peakDow = 0;
  let peakHour = 0;
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 0; h < 24; h++) {
      if (grid[dow][h] > max) {
        max = grid[dow][h];
        peakDow = dow;
        peakHour = h;
      }
    }
  }

  const isMobile = width < 480;
  const W = Math.max(width, 1);
  const PAD = { top: 26, right: isMobile ? 8 : 14, bottom: isMobile ? 44 : 36, left: isMobile ? 30 : 38 };
  const innerW = W - PAD.left - PAD.right;
  const cellW = innerW / 24;
  const cellH = isMobile ? 26 : 22;
  const innerH = cellH * 7;
  const H = PAD.top + innerH + PAD.bottom;
  // Show labels every 6h on mobile, every 3h on desktop
  const hourLabelStep = isMobile ? 6 : 3;
  const hourLabels = Array.from({ length: 24 / hourLabelStep }, (_, i) => i * hourLabelStep);

  const intensity = (count: number): number => {
    if (count === 0) return 0;
    return 0.2 + 0.8 * (count / max);
  };

  const formatHour = (h: number): string => {
    if (h === 0) return "12a";
    if (h === 12) return "12p";
    if (h < 12) return `${h}a`;
    return `${h - 12}p`;
  };

  return (
    <div ref={ref} className="w-full overflow-x-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Hour column labels */}
        {hourLabels.map((h) => (
          <text
            key={h}
            x={PAD.left + h * cellW + cellW / 2}
            y={PAD.top - 8}
            textAnchor="middle"
            className="fill-muted-foreground/40"
            fontSize={isMobile ? 9 : 8}
            fontFamily="var(--font-geist-mono, monospace)"
          >
            {formatHour(h)}
          </text>
        ))}

        {/* Day row labels */}
        {DAY_LABELS.map((label, dow) => (
          <text
            key={label}
            x={PAD.left - 5}
            y={PAD.top + dow * cellH + cellH / 2}
            textAnchor="end"
            dominantBaseline="central"
            className="fill-muted-foreground/50"
            fontSize={isMobile ? 10 : 9}
            fontFamily="var(--font-geist-mono, monospace)"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {grid.map((row, dow) =>
          row.map((count, hour) => {
            const x = PAD.left + hour * cellW;
            const y = PAD.top + dow * cellH;
            const op = intensity(count);
            const isPeak = count === max && max > 0;
            return (
              <g key={`${dow}-${hour}`}>
                <rect
                  x={x + 0.5}
                  y={y + 0.5}
                  width={cellW - 1}
                  height={cellH - 1}
                  fill={op > 0 ? HEAT_COLOR : "none"}
                  fillOpacity={op}
                  stroke="var(--border)"
                  strokeWidth={0.4}
                  strokeOpacity={op > 0 ? 0 : 0.3}
                  rx={1.5}
                  className="animate-fade-in"
                  style={{
                    animationDelay: `${(dow * 24 + hour) * 4 + 150}ms`,
                  }}
                />
                {isPeak && (
                  <rect
                    x={x + 1.5}
                    y={y + 1.5}
                    width={cellW - 3}
                    height={cellH - 3}
                    fill="none"
                    stroke="#DFA649"
                    strokeWidth={1}
                    rx={1}
                    opacity={0.95}
                  />
                )}
                {count > 0 && (
                  <title>
                    {DAY_LABELS[dow]} {formatHour(hour)} — {count} patch
                    {count === 1 ? "" : "es"} completed
                  </title>
                )}
              </g>
            );
          })
        )}

        {/* Footer: peak callout */}
        <text
          x={PAD.left}
          y={H - (isMobile ? 28 : 18)}
          className="fill-muted-foreground/45"
          fontSize={isMobile ? 10 : 9}
          fontFamily="var(--font-geist-mono, monospace)"
        >
          peak: {DAY_LABELS[peakDow]} {formatHour(peakHour)}
          {" · "}
          {max} patch{max === 1 ? "" : "es"}
        </text>

        {/* Color scale legend */}
        <g transform={`translate(${W - PAD.right - (isMobile ? 86 : 100)}, ${H - (isMobile ? 42 : 26)})`}>
          <text
            x={-4}
            y={6}
            textAnchor="end"
            className="fill-muted-foreground/40"
            fontSize={isMobile ? 9 : 8}
            fontFamily="var(--font-geist-mono, monospace)"
          >
            0
          </text>
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((op, i) => (
            <rect
              key={i}
              x={i * (isMobile ? 14 : 16)}
              y={0}
              width={isMobile ? 12 : 14}
              height={isMobile ? 9 : 10}
              fill={HEAT_COLOR}
              fillOpacity={op}
              rx={1}
            />
          ))}
          <text
            x={5 * (isMobile ? 14 : 16) + 4}
            y={6}
            className="fill-muted-foreground/40"
            fontSize={isMobile ? 9 : 8}
            fontFamily="var(--font-geist-mono, monospace)"
          >
            {max}
          </text>
        </g>

        {/* X-axis label */}
        <text
          x={PAD.left + innerW / 2}
          y={H - (isMobile ? 12 : 4)}
          textAnchor="middle"
          className="fill-muted-foreground/30"
          fontSize={isMobile ? 8 : 8}
          fontFamily="var(--font-geist-mono, monospace)"
          letterSpacing="0.08em"
        >
          HOUR (LOCAL TIME)
        </text>
      </svg>
    </div>
  );
}
