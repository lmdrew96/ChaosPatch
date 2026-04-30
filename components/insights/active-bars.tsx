"use client";

import type { PatchWithProject } from "@/lib/queries";

type Priority = "high" | "medium" | "low";

const PRIORITY_ORDER: Priority[] = ["high", "medium", "low"];
const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
const PRIORITY_COLORS: Record<Priority, string> = {
  high: "#f43f5e",   // rose
  medium: "#DFA649", // amber
  low: "#64748b",    // slate
};

type ProjectRow = {
  name: string;
  color: string;
  total: number;
  buckets: Record<Priority, number>;
};

export function ActiveBars({ patches }: { patches: PatchWithProject[] }) {
  // Aggregate active patches per project, by priority
  const byProject = new Map<string, ProjectRow>();
  for (const p of patches) {
    if (p.status !== "open" && p.status !== "in_progress") continue;
    const row = byProject.get(p.project_name) ?? {
      name: p.project_name,
      color: p.project_color,
      total: 0,
      buckets: { high: 0, medium: 0, low: 0 },
    };
    row.buckets[p.priority]++;
    row.total++;
    byProject.set(p.project_name, row);
  }

  const rows = Array.from(byProject.values()).sort((a, b) => b.total - a.total);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground/50">
        All clear — no active patches
      </div>
    );
  }

  const W = 600;
  const rowH = 28;
  const PAD = { top: 14, right: 36, bottom: 38, left: 130 };
  const H = PAD.top + rows.length * rowH + PAD.bottom;
  const innerW = W - PAD.left - PAD.right;
  const maxTotal = Math.max(...rows.map((r) => r.total));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto min-w-[400px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {rows.map((row, ri) => {
          const y = PAD.top + ri * rowH + rowH / 2;
          const barH = 14;
          const barY = y - barH / 2;
          const barW = (row.total / maxTotal) * innerW;

          // Cumulative segment offsets
          let cursor = 0;
          const segments = PRIORITY_ORDER.map((priority) => {
            const count = row.buckets[priority];
            if (count === 0) return null;
            const segW = (count / row.total) * barW;
            const segX = PAD.left + cursor;
            cursor += segW;
            return { priority, count, segX, segW };
          }).filter((s): s is NonNullable<typeof s> => s !== null);

          return (
            <g key={row.name}>
              {/* Project label */}
              <circle cx={PAD.left - 116} cy={y} r={3} fill={row.color} />
              <text
                x={PAD.left - 108}
                y={y}
                dominantBaseline="central"
                className="fill-foreground/70"
                fontSize={10}
                fontFamily="var(--font-geist-sans, sans-serif)"
              >
                {row.name.length > 16 ? row.name.slice(0, 15) + "…" : row.name}
              </text>

              {/* Track outline */}
              <rect
                x={PAD.left}
                y={barY}
                width={innerW}
                height={barH}
                fill="none"
                stroke="var(--border)"
                strokeWidth={0.5}
                opacity={0.15}
                rx={2}
              />

              {/* Priority segments */}
              {segments.map((seg, si) => {
                const isFirst = si === 0;
                const isLast = si === segments.length - 1;
                const r = Math.min(2, seg.segW / 2);
                const path = `
                  M ${seg.segX + (isFirst ? r : 0)} ${barY}
                  H ${seg.segX + seg.segW - (isLast ? r : 0)}
                  ${isLast ? `Q ${seg.segX + seg.segW} ${barY} ${seg.segX + seg.segW} ${barY + r}` : ""}
                  V ${barY + barH - (isLast ? r : 0)}
                  ${isLast ? `Q ${seg.segX + seg.segW} ${barY + barH} ${seg.segX + seg.segW - r} ${barY + barH}` : ""}
                  H ${seg.segX + (isFirst ? r : 0)}
                  ${isFirst ? `Q ${seg.segX} ${barY + barH} ${seg.segX} ${barY + barH - r}` : ""}
                  V ${barY + (isFirst ? r : 0)}
                  ${isFirst ? `Q ${seg.segX} ${barY} ${seg.segX + r} ${barY}` : ""}
                  Z
                `;
                return (
                  <g
                    key={seg.priority}
                    className="animate-fade-in"
                    style={{ animationDelay: `${ri * 80 + si * 40 + 150}ms` }}
                  >
                    <path
                      d={path}
                      fill={PRIORITY_COLORS[seg.priority]}
                      opacity={0.85}
                    />
                    <title>
                      {row.name} · {PRIORITY_LABELS[seg.priority]}: {seg.count}{" "}
                      patch{seg.count === 1 ? "" : "es"}
                    </title>
                  </g>
                );
              })}

              {/* Total count */}
              <text
                x={PAD.left + barW + 6}
                y={y}
                dominantBaseline="central"
                className="fill-muted-foreground/50"
                fontSize={9}
                fontFamily="var(--font-geist-mono, monospace)"
              >
                {row.total}
              </text>
            </g>
          );
        })}

        {/* X-axis label */}
        <text
          x={PAD.left + innerW / 2}
          y={H - 18}
          textAnchor="middle"
          className="fill-muted-foreground/30"
          fontSize={8}
          fontFamily="var(--font-geist-mono, monospace)"
          letterSpacing="0.1em"
        >
          ACTIVE PATCHES (BAR LENGTH = LOAD, SEGMENTS = PRIORITY MIX)
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-1 justify-center text-[10px] text-muted-foreground/60 font-mono">
        {PRIORITY_ORDER.map((p) => (
          <div key={p} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: PRIORITY_COLORS[p], opacity: 0.85 }}
            />
            <span>{PRIORITY_LABELS[p]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
