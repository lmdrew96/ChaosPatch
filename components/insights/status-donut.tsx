"use client";

const STATUS_COLORS = {
  open: "#3b82f6",
  in_progress: "#f59e0b",
  done: "#10b981",
};

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  done: "Done",
};

type StatusKey = keyof typeof STATUS_COLORS;

export function StatusDonut({
  counts,
  size = 160,
  strokeWidth = 20,
}: {
  counts: { open: number; in_progress: number; done: number };
  size?: number;
  strokeWidth?: number;
}) {
  const total = counts.open + counts.in_progress + counts.done;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <svg width={size} height={size} className="opacity-30">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
        </svg>
        <p className="text-xs text-muted-foreground/50">No patches yet</p>
      </div>
    );
  }

  const segments: { key: StatusKey; value: number; offset: number }[] = [];
  let cumulativeOffset = 0;
  for (const key of ["done", "in_progress", "open"] as StatusKey[]) {
    if (counts[key] > 0) {
      segments.push({ key, value: counts[key], offset: cumulativeOffset });
      cumulativeOffset += counts[key];
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{ filter: "drop-shadow(0 0 8px rgba(99, 102, 241, 0.1))" }}
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
            opacity={0.3}
          />
          {/* Segments */}
          {segments.map(({ key, value, offset }, i) => {
            const segLen = (value / total) * circumference;
            const segOffset = (offset / total) * circumference;
            return (
              <circle
                key={key}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={STATUS_COLORS[key]}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segLen} ${circumference - segLen}`}
                strokeDashoffset={-segOffset}
                strokeLinecap="butt"
                className="donut-segment"
                style={{
                  animationDelay: `${i * 150 + 200}ms`,
                  opacity: 0.9,
                }}
              />
            );
          })}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-mono font-semibold tabular-nums">
            {total}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
            total
          </span>
        </div>
      </div>
      {/* Legend */}
      <div className="flex gap-4">
        {(["done", "in_progress", "open"] as StatusKey[]).map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[key] }}
            />
            <span className="text-[10px] text-muted-foreground/70 font-mono">
              {counts[key]} {STATUS_LABELS[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
