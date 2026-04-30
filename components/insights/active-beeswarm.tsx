"use client";

import type { PatchWithProject } from "@/lib/queries";

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Priority = "high" | "medium" | "low";
const PRIORITY_ORDER: Priority[] = ["high", "medium", "low"];
const PRIORITY_LABELS: Record<Priority, string> = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};
const PRIORITY_ACCENT: Record<Priority, string> = {
  high: "#f43f5e",
  medium: "#DFA649",
  low: "#64748b",
};

const niceMax = (raw: number): number => {
  if (raw <= 7) return 7;
  if (raw <= 14) return 14;
  if (raw <= 30) return 30;
  if (raw <= 60) return 60;
  if (raw <= 90) return 90;
  return Math.ceil(raw / 30) * 30;
};

export function ActiveBeeswarm({ patches }: { patches: PatchWithProject[] }) {
  const active = patches.filter(
    (p) => p.status === "open" || p.status === "in_progress"
  );

  if (active.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground/50">
        All clear — no active patches
      </div>
    );
  }

  const now = Date.now();
  const enriched = active.map((p) => ({
    ...p,
    ageDays: Math.max(
      0,
      (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  const maxAge = niceMax(Math.max(...enriched.map((p) => p.ageDays)));

  const W = 600;
  const laneH = 56;
  const PAD = { top: 18, right: 18, bottom: 34, left: 56 };
  const H = PAD.top + laneH * 3 + PAD.bottom;
  const innerW = W - PAD.left - PAD.right;

  const toX = (days: number): number =>
    PAD.left + (days / maxAge) * innerW;

  const gridDays = [
    0,
    Math.round(maxAge / 4),
    Math.round(maxAge / 2),
    Math.round((maxAge * 3) / 4),
    maxAge,
  ];

  const half = 4; // half-diagonal of diamond marker

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto min-w-[400px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="bee-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Vertical grid lines */}
        {gridDays.map((d) => (
          <g key={d}>
            <line
              x1={toX(d)}
              y1={PAD.top - 4}
              x2={toX(d)}
              y2={H - PAD.bottom + 4}
              stroke="var(--border)"
              strokeWidth={0.5}
              opacity={d === 0 ? 0.4 : 0.15}
              strokeDasharray={d === 0 ? undefined : "2 4"}
            />
            <text
              x={toX(d)}
              y={H - PAD.bottom + 18}
              textAnchor="middle"
              className="fill-muted-foreground/40"
              fontSize={8}
              fontFamily="var(--font-geist-mono, monospace)"
            >
              {d}d
            </text>
          </g>
        ))}

        {/* Priority lanes */}
        {PRIORITY_ORDER.map((priority, li) => {
          const laneCenter = PAD.top + laneH * li + laneH / 2;
          const lanePatches = enriched.filter((p) => p.priority === priority);
          const spreadY = laneH * 0.55;

          return (
            <g key={priority}>
              {/* Lane baseline */}
              <line
                x1={PAD.left}
                y1={laneCenter}
                x2={W - PAD.right}
                y2={laneCenter}
                stroke="var(--border)"
                strokeWidth={0.3}
                opacity={0.1}
              />

              {/* Priority label + accent dot */}
              <circle
                cx={PAD.left - 26}
                cy={laneCenter}
                r={1.75}
                fill={PRIORITY_ACCENT[priority]}
              />
              <text
                x={PAD.left - 18}
                y={laneCenter}
                dominantBaseline="central"
                className="fill-muted-foreground/50"
                fontSize={9}
                fontFamily="var(--font-geist-mono, monospace)"
                letterSpacing="0.12em"
              >
                {PRIORITY_LABELS[priority]}
              </text>

              {/* Empty lane indicator */}
              {lanePatches.length === 0 && (
                <text
                  x={(PAD.left + W - PAD.right) / 2}
                  y={laneCenter}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-muted-foreground/25"
                  fontSize={9}
                  fontFamily="var(--font-geist-mono, monospace)"
                >
                  —
                </text>
              )}

              {/* Patch diamonds */}
              {lanePatches.map((p, di) => {
                const cx = toX(p.ageDays);
                const cy =
                  laneCenter +
                  (seededRandom(li * 200 + di * 7 + 11) - 0.5) * spreadY;
                const isInProgress = p.status === "in_progress";
                const points = `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;
                return (
                  <polygon
                    key={p.id}
                    points={points}
                    fill={isInProgress ? p.project_color : "none"}
                    stroke={p.project_color}
                    strokeWidth={isInProgress ? 0.5 : 1.4}
                    opacity={isInProgress ? 0.95 : 0.85}
                    filter={isInProgress ? "url(#bee-glow)" : undefined}
                    className="strip-dot"
                    style={{ animationDelay: `${li * 80 + di * 12 + 200}ms` }}
                  >
                    <title>
                      {p.title} · {p.project_name} · {Math.round(p.ageDays)}d
                      old · {p.status === "in_progress" ? "in progress" : "open"}
                    </title>
                  </polygon>
                );
              })}
            </g>
          );
        })}

        {/* X-axis label */}
        <text
          x={PAD.left + innerW / 2}
          y={H - 4}
          textAnchor="middle"
          className="fill-muted-foreground/30"
          fontSize={8}
          fontFamily="var(--font-geist-mono, monospace)"
          letterSpacing="0.1em"
        >
          AGE (DAYS SINCE CREATED)
        </text>
      </svg>

      {/* Legend */}
      <div className="flex gap-5 mt-2 justify-center text-[10px] text-muted-foreground/60 font-mono">
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="-5 -5 10 10">
            <polygon
              points="0,-3.5 3.5,0 0,3.5 -3.5,0"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.4}
            />
          </svg>
          <span>Open</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="-5 -5 10 10">
            <polygon points="0,-3.5 3.5,0 0,3.5 -3.5,0" fill="currentColor" />
          </svg>
          <span>In progress</span>
        </div>
      </div>
    </div>
  );
}
