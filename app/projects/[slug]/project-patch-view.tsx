"use client";

import { useState, useMemo } from "react";
import type { Patch } from "@/lib/queries";
import { PatchList } from "./patch-list";

function CompletedAccordion({ patches }: { patches: Patch[] }) {
  const [open, setOpen] = useState(false);
  if (patches.length === 0) return null;
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground/70 hover:bg-muted/40 transition-colors"
      >
        <span>
          Completed
          <span className="ml-1.5 font-mono text-[10px] opacity-60">
            {patches.length}
          </span>
        </span>
        <span className="text-muted-foreground/50 transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }}>
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-border">
          <PatchList patches={patches} />
        </div>
      )}
    </div>
  );
}

type StatusFilter = "all" | "open" | "in_progress" | "done";
type PriorityFilter = "all" | "low" | "medium" | "high";
type SortField = "created" | "priority" | "status";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER: Record<string, number> = { in_progress: 0, open: 1, done: 2 };

export function ProjectPatchView({ patches }: { patches: Patch[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const statusCounts = useMemo(() => {
    const counts = { open: 0, in_progress: 0, done: 0 };
    patches.forEach((p) => counts[p.status]++);
    return counts;
  }, [patches]);

  const filteredPatches = useMemo(() => {
    let result = [...patches];

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((p) => p.priority === priorityFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "created":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "priority":
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case "status":
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [patches, statusFilter, priorityFilter, sortField, sortDir]);

  if (patches.length === 0) {
    return (
      <p className="text-center text-muted-foreground/50 text-sm py-16">
        No patches yet. Add one with the button above.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter chips */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mr-1">
            Status
          </span>
          {(
            [
              { value: "all", label: "All", count: patches.length },
              { value: "open", label: "Open", count: statusCounts.open },
              { value: "in_progress", label: "In Progress", count: statusCounts.in_progress },
              { value: "done", label: "Done", count: statusCounts.done },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                statusFilter === opt.value
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-card text-muted-foreground border border-border hover:border-muted-foreground/40 hover:text-foreground/70"
              }`}
            >
              {opt.label}
              <span className="ml-1 font-mono text-[10px] opacity-60">{opt.count}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Priority filter chips */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mr-1">
            Priority
          </span>
          {(
            [
              { value: "all", label: "All" },
              { value: "high", label: "High" },
              { value: "medium", label: "Med" },
              { value: "low", label: "Low" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPriorityFilter(opt.value)}
              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                priorityFilter === opt.value
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-card text-muted-foreground border border-border hover:border-muted-foreground/40 hover:text-foreground/70"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="status">Sort: Status</option>
            <option value="created">Sort: Date</option>
            <option value="priority">Sort: Priority</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            className="text-xs text-muted-foreground hover:text-foreground/70 border border-border rounded-md px-2 py-1 transition-colors"
            title={sortDir === "desc" ? "Descending" : "Ascending"}
          >
            {sortDir === "desc" ? "↓" : "↑"}
          </button>
        </div>
      </div>

      {/* Patch list */}
      {filteredPatches.length === 0 ? (
        <p className="text-center text-muted-foreground/50 text-sm py-8">
          No patches match your filters.
        </p>
      ) : statusFilter === "done" ? (
        <PatchList patches={filteredPatches} />
      ) : (
        <>
          <PatchList patches={filteredPatches.filter((p) => p.status !== "done")} />
          <CompletedAccordion patches={filteredPatches.filter((p) => p.status === "done")} />
        </>
      )}
    </div>
  );
}
