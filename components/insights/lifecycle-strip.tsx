"use client";

import type { PatchWithProject } from "@/lib/queries";

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type LifecyclePatch = {
  project_name: string;
  project_color: string;
  days: number;
};

export function LifecycleStrip({ patches }: { patches: PatchWithProject[] }) {
  // Derive lifecycle data from completed patches
  const lifecycleData: LifecyclePatch[] = patches
    .filter((p) => p.status === "done" && p.created_at && p.completed_at)
    .map((p) => ({
      project_name: p.project_name,
      project_color: p.project_color,
      days: Math.max(
        0,
        Math.round(
          (new Date(p.completed_at!).getTime() - new Date(p.created_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      ),
    }));

  if (lifecycleData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground/50">
        No completed patches yet
      </div>
    );
  }

  const W = 600;
  const dotR = 3.5;

  // Group by project, sorted by count
  const projectMap = new Map<string, LifecyclePatch[]>();
  lifecycleData.forEach((p) => {
    if (!projectMap.has(p.project_name)) projectMap.set(p.project_name, []);
    projectMap.get(p.project_name)!.push(p);
  });
  const projects = Array.from(projectMap.entries()).sort((a, b) => b[1].length - a[1].length);

  const maxDays = Math.max(...lifecycleData.map((p) => p.days), 7);
  const rowH = 28;
  const PAD = { top: 20, right: 20, bottom: 32, left: 110 };
  const H = PAD.top + projects.length * rowH + PAD.bottom;
  const innerW = W - PAD.left - PAD.right;

  const toX = (days: number): number => PAD.left + (days / maxDays) * innerW;

  const gridDays = [...new Set([0, Math.round(maxDays / 4), Math.round(maxDays / 2), Math.round(maxDays * 3 / 4), maxDays])];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto min-w-[400px]" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="life-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
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

        {/* Project rows */}
        {projects.map(([name, projectPatches], pi) => {
          const y = PAD.top + pi * rowH + rowH / 2;
          const color = projectPatches[0].project_color;

          return (
            <g key={name} className="lifecycle-row" style={{ animationDelay: `${pi * 60 + 200}ms` }}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="var(--border)"
                strokeWidth={0.3}
                opacity={0.1}
              />
              <text
                x={PAD.left - 8}
                y={y + 1}
                textAnchor="end"
                dominantBaseline="central"
                className="fill-foreground/60"
                fontSize={10}
                fontFamily="var(--font-geist-sans, sans-serif)"
              >
                {name}
              </text>
              {projectPatches.map((patch, di) => {
                const jitterY = (seededRandom(pi * 200 + di) - 0.5) * (rowH * 0.5);
                return (
                  <circle
                    key={di}
                    cx={toX(patch.days)}
                    cy={y + jitterY}
                    r={dotR}
                    fill={color}
                    opacity={0.75}
                    filter="url(#life-glow)"
                    className="strip-dot"
                    style={{ animationDelay: `${pi * 60 + di * 8 + 250}ms` }}
                  />
                );
              })}
            </g>
          );
        })}

        {/* X-axis label */}
        <text
          x={W / 2}
          y={H - 4}
          textAnchor="middle"
          className="fill-muted-foreground/30"
          fontSize={8}
          fontFamily="var(--font-geist-mono, monospace)"
          letterSpacing="0.1em"
        >
          DAYS TO COMPLETE
        </text>
      </svg>
    </div>
  );
}
