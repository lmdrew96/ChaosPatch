"use client";

import type { WeekBucket } from "@/lib/queries";

const COLORS = {
  created: "#244952",   // deep teal
  started: "#DFA649",   // amber
  completed: "#97D181", // soft green
};

const W = 600;
const H = 180;
const PAD = { top: 12, right: 16, bottom: 28, left: 16 };

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function DotStrip({ data }: { data: WeekBucket[] }) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const dotR = 3.5;

  const isEmpty = data.every((d) => d.created === 0 && d.started === 0 && d.completed === 0);
  if (isEmpty) {
    return (
      <div className="flex items-center justify-center h-[140px] text-xs text-muted-foreground/50">
        Activity will appear here as you create and complete patches
      </div>
    );
  }

  const xStep = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const toX = (i: number) => PAD.left + i * xStep;

  // Three lanes
  const laneH = innerH / 3;
  const lanes = {
    created: PAD.top + laneH * 0.5,
    started: PAD.top + laneH * 1.5,
    completed: PAD.top + laneH * 2.5,
  };

  const spreadX = xStep * 0.3;
  const allDots: { x: number; y: number; color: string; delay: number }[] = [];

  data.forEach((d, i) => {
    const baseX = toX(i);
    const spreadY = laneH * 0.35;

    const addDots = (count: number, laneY: number, color: string, seedOffset: number) => {
      for (let j = 0; j < count; j++) {
        const seed = i * 100 + j + seedOffset;
        allDots.push({
          x: baseX + (seededRandom(seed) - 0.5) * spreadX,
          y: laneY + (seededRandom(seed + 50) - 0.5) * spreadY,
          color,
          delay: i * 30 + j * 15 + seedOffset / 30,
        });
      }
    };

    addDots(d.created, lanes.created, COLORS.created, 0);
    addDots(d.started, lanes.started, COLORS.started, 300);
    addDots(d.completed, lanes.completed, COLORS.completed, 600);
  });

  const formatWeek = (iso: string): string => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto min-w-[400px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="dot-strip-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Lane dividers */}
        {[PAD.top + laneH, PAD.top + laneH * 2].map((y, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={y}
            x2={W - PAD.right}
            y2={y}
            stroke="var(--border)"
            strokeWidth={0.5}
            opacity={0.2}
            strokeDasharray="4 4"
          />
        ))}

        {/* Lane labels */}
        {(["created", "started", "completed"] as const).map((key) => (
          <text
            key={key}
            x={PAD.left}
            y={lanes[key] - laneH * 0.35}
            className="fill-muted-foreground/25"
            fontSize={7}
            fontFamily="var(--font-geist-mono, monospace)"
            letterSpacing="0.1em"
          >
            {key.toUpperCase()}
          </text>
        ))}

        {/* Week column guides */}
        {data.map((_d, i) => (
          <line
            key={`guide-${i}`}
            x1={toX(i)}
            y1={PAD.top}
            x2={toX(i)}
            y2={H - PAD.bottom}
            stroke="var(--border)"
            strokeWidth={0.3}
            opacity={0.08}
            strokeDasharray="2 4"
          />
        ))}

        {/* Dots */}
        {allDots.map((dot, i) => (
          <circle
            key={i}
            cx={dot.x}
            cy={dot.y}
            r={dotR}
            fill={dot.color}
            opacity={0.8}
            filter="url(#dot-strip-glow)"
            className="strip-dot"
            style={{ animationDelay: `${dot.delay + 200}ms` }}
          />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={toX(i)}
              y={H - 4}
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
      <div className="flex gap-5 mt-2 justify-center">
        {(["created", "started", "completed"] as const).map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[key] }} />
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
