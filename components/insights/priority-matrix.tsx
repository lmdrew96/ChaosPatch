"use client";

import type { PatchWithProject } from "@/lib/queries";

const STATUS_COLORS = {
  open: "#88739E",
  in_progress: "#DFA649",
  done: "#8CBDB9",
};

const PRIORITY_LABELS = { high: "High", medium: "Medium", low: "Low" };
const PRIORITY_BORDER = { high: "#f43f5e", medium: "#DFA649", low: "#64748b" };

type Priority = "high" | "medium" | "low";

export function PriorityMatrix({ patches }: { patches: PatchWithProject[] }) {
  const groups = {
    high: patches.filter((p) => p.priority === "high"),
    medium: patches.filter((p) => p.priority === "medium"),
    low: patches.filter((p) => p.priority === "low"),
  };

  if (patches.length === 0) {
    return (
      <div className="flex items-center justify-center h-[120px] text-xs text-muted-foreground/50">
        All clear — no active patches
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(["high", "medium", "low"] as Priority[]).map((priority) => {
        const group = groups[priority];
        if (group.length === 0) return null;
        return (
          <div key={priority} className="animate-fade-in" style={{ animationDelay: `${priority === "high" ? 200 : priority === "medium" ? 300 : 400}ms` }}>
            {/* Priority label */}
            <div className="flex items-center gap-2 mb-2.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: PRIORITY_BORDER[priority] }}
              />
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/50 font-mono">
                {PRIORITY_LABELS[priority]}
              </span>
              <span className="text-[10px] text-muted-foreground/30 font-mono">
                {group.length}
              </span>
            </div>
            {/* Patch chips */}
            <div className="flex flex-wrap gap-2">
              {group.map((patch) => (
                <div
                  key={patch.id}
                  className="flex items-center gap-2 rounded-md border border-border/50 px-2.5 py-1.5 bg-card/50"
                  style={{
                    borderLeftWidth: 3,
                    borderLeftColor: patch.project_color,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: STATUS_COLORS[patch.status],
                      boxShadow: patch.status === "in_progress"
                        ? `0 0 6px ${STATUS_COLORS.in_progress}`
                        : undefined,
                    }}
                  />
                  <span className="text-[11px] text-foreground/70 truncate max-w-[200px]" title={patch.title}>
                    {patch.title}
                  </span>
                  <span className="text-[9px] text-muted-foreground/30 font-mono shrink-0">
                    {patch.project_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
