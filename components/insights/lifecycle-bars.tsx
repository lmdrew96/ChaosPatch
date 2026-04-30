"use client";

import type { PatchWithProject } from "@/lib/queries";

type Bucket = "sameDay" | "week" | "month" | "long";

const BUCKET_ORDER: Bucket[] = ["sameDay", "week", "month", "long"];
const BUCKET_LABELS: Record<Bucket, string> = {
  sameDay: "<1d",
  week: "1–7d",
  month: "1–4w",
  long: "1mo+",
};
const BUCKET_COLORS: Record<Bucket, string> = {
  sameDay: "#97D181", // soft green — quick ship
  week: "#8CBDB9",    // sage teal — normal cadence
  month: "#DFA649",   // amber — slow burn
  long: "#88739E",    // mauve — deep cuts
};

const bucketFor = (days: number): Bucket => {
  if (days < 1) return "sameDay";
  if (days <= 7) return "week";
  if (days <= 28) return "month";
  return "long";
};

type ProjectRow = {
  name: string;
  color: string;
  total: number;
  buckets: Record<Bucket, number>;
};

export function LifecycleBars({ patches }: { patches: PatchWithProject[] }) {
  // Aggregate completed patches per project, by lifecycle bucket
  const byProject = new Map<string, ProjectRow>();
  for (const p of patches) {
    if (p.status !== "done" || !p.completed_at || !p.created_at) continue;
    const days =
      (new Date(p.completed_at).getTime() - new Date(p.created_at).getTime()) /
      (1000 * 60 * 60 * 24);
    const bucket = bucketFor(Math.max(0, days));
    const row = byProject.get(p.project_name) ?? {
      name: p.project_name,
      color: p.project_color,
      total: 0,
      buckets: { sameDay: 0, week: 0, month: 0, long: 0 },
    };
    row.buckets[bucket]++;
    row.total++;
    byProject.set(p.project_name, row);
  }

  const rows = Array.from(byProject.values()).sort((a, b) => b.total - a.total);

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground/50">
        No completed patches yet
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

          // Compute segment x-offsets cumulatively
          let cursor = 0;
          const segments = BUCKET_ORDER.map((bucket) => {
            const count = row.buckets[bucket];
            if (count === 0) return null;
            const segW = (count / row.total) * barW;
            const segX = PAD.left + cursor;
            cursor += segW;
            return { bucket, count, segX, segW };
          }).filter((s): s is NonNullable<typeof s> => s !== null);

          return (
            <g key={row.name}>
              {/* Project label */}
              <circle
                cx={PAD.left - 116}
                cy={y}
                r={3}
                fill={row.color}
              />
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

              {/* Track outline (so empty space registers visually) */}
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

              {/* Bar segments */}
              {segments.map((seg, si) => {
                const isFirst = si === 0;
                const isLast = si === segments.length - 1;
                // Clamp corner radius — a tiny segment (e.g. 2px wide) would
                // otherwise produce a malformed path with negative H steps.
                const r = Math.min(2, seg.segW / 2);
                // Round only outermost corners so the bar reads as one unit
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
                    key={seg.bucket}
                    className="animate-fade-in"
                    style={{ animationDelay: `${ri * 80 + si * 40 + 150}ms` }}
                  >
                    <path
                      d={path}
                      fill={BUCKET_COLORS[seg.bucket]}
                      opacity={0.85}
                    />
                    <title>
                      {row.name} · {BUCKET_LABELS[seg.bucket]}: {seg.count}{" "}
                      patch{seg.count === 1 ? "" : "es"}
                    </title>
                  </g>
                );
              })}

              {/* Total count at bar end */}
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
          COMPLETED PATCHES (BAR LENGTH = VOLUME, SEGMENTS = TIME-TO-SHIP)
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-1 justify-center text-[10px] text-muted-foreground/60 font-mono">
        {BUCKET_ORDER.map((b) => (
          <div key={b} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: BUCKET_COLORS[b], opacity: 0.85 }}
            />
            <span>{BUCKET_LABELS[b]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
