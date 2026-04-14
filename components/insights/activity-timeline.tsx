"use client";

import type { WeekBucket } from "@/lib/queries";

const CHART_H = 180;
const CHART_W = 600;
const PAD = { top: 12, right: 12, bottom: 28, left: 32 };

const COLORS = {
  created: "#6366f1",
  completed: "#10b981",
};

export function ActivityTimeline({ data }: { data: WeekBucket[] }) {
  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.flatMap((d) => [d.created, d.completed]), 1);
  // Round up to next nice number for grid
  const gridMax = Math.ceil(maxVal / 2) * 2 || 2;
  const gridLines = [0, Math.round(gridMax / 2), gridMax];

  const xStep = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const toY = (v: number): number => PAD.top + innerH - (v / gridMax) * innerH;
  const toX = (i: number): number => PAD.left + i * xStep;

  const makePath = (key: "created" | "completed"): string =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(d[key])}`)
      .join(" ");

  const makeArea = (key: "created" | "completed"): string => {
    const line = data.map((d, i) => `${toX(i)} ${toY(d[key])}`).join(" L ");
    const baseline = `${toX(data.length - 1)} ${toY(0)} L ${toX(0)} ${toY(0)}`;
    return `M ${line} L ${baseline} Z`;
  };

  const formatWeek = (iso: string): string => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const isEmpty = data.every((d) => d.created === 0 && d.completed === 0);

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground/50">
        Activity will appear here as you create and complete patches
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto min-w-[400px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {gridLines.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={toY(v)}
              x2={CHART_W - PAD.right}
              y2={toY(v)}
              stroke="var(--border)"
              strokeWidth={0.5}
              strokeDasharray={v === 0 ? undefined : "2 3"}
              opacity={v === 0 ? 0.6 : 0.3}
            />
            <text
              x={PAD.left - 6}
              y={toY(v) + 3}
              textAnchor="end"
              className="fill-muted-foreground/40"
              fontSize={9}
              fontFamily="var(--font-geist-mono, monospace)"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Area fills */}
        <path
          d={makeArea("created")}
          fill={COLORS.created}
          opacity={0.08}
          className="timeline-area"
        />
        <path
          d={makeArea("completed")}
          fill={COLORS.completed}
          opacity={0.1}
          className="timeline-area"
        />

        {/* Lines */}
        <path
          d={makePath("created")}
          fill="none"
          stroke={COLORS.created}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="timeline-line"
          opacity={0.7}
        />
        <path
          d={makePath("completed")}
          fill="none"
          stroke={COLORS.completed}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="timeline-line"
          opacity={0.9}
        />

        {/* Data points */}
        {data.map((d, i) => (
          <g key={i}>
            {d.created > 0 && (
              <circle
                cx={toX(i)}
                cy={toY(d.created)}
                r={2.5}
                fill={COLORS.created}
                opacity={0.8}
              />
            )}
            {d.completed > 0 && (
              <circle
                cx={toX(i)}
                cy={toY(d.completed)}
                r={2.5}
                fill={COLORS.completed}
                opacity={0.9}
              />
            )}
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          // Show every other label if many weeks
          if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1)
            return null;
          return (
            <text
              key={i}
              x={toX(i)}
              y={CHART_H - 4}
              textAnchor="middle"
              className="fill-muted-foreground/40"
              fontSize={8}
              fontFamily="var(--font-geist-mono, monospace)"
            >
              {formatWeek(d.week)}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS.created }} />
          <span className="text-[10px] text-muted-foreground/60 font-mono">Created</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: COLORS.completed }} />
          <span className="text-[10px] text-muted-foreground/60 font-mono">Completed</span>
        </div>
      </div>
    </div>
  );
}
