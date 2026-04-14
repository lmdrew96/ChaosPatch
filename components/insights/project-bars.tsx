"use client";

import type { ProjectSummary } from "@/lib/queries";

export function ProjectBars({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/50 py-8 text-center">
        No projects yet
      </p>
    );
  }

  const maxTotal = Math.max(...projects.map((p) => p.total), 1);

  return (
    <div className="space-y-3">
      {projects.map((project, i) => {
        const pct = (n: number) => (n / maxTotal) * 100;
        return (
          <div
            key={project.project_slug}
            className="animate-fade-in"
            style={{ animationDelay: `${i * 80 + 100}ms` }}
          >
            {/* Label row */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: project.project_color }}
                />
                <span className="text-xs text-foreground/80 truncate">
                  {project.project_name}
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums shrink-0 ml-2">
                {project.total}
              </span>
            </div>
            {/* Stacked bar */}
            <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden flex">
              {project.done > 0 && (
                <div
                  className="h-full bar-segment"
                  style={{
                    width: `${pct(project.done)}%`,
                    backgroundColor: "#10b981",
                    animationDelay: `${i * 80 + 200}ms`,
                  }}
                />
              )}
              {project.in_progress > 0 && (
                <div
                  className="h-full bar-segment"
                  style={{
                    width: `${pct(project.in_progress)}%`,
                    backgroundColor: "#f59e0b",
                    animationDelay: `${i * 80 + 300}ms`,
                  }}
                />
              )}
              {project.open > 0 && (
                <div
                  className="h-full bar-segment"
                  style={{
                    width: `${pct(project.open)}%`,
                    backgroundColor: "#3b82f6",
                    animationDelay: `${i * 80 + 400}ms`,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
