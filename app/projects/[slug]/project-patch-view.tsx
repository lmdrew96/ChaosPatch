"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Patch } from "@/lib/queries";
import { TagFilterBar } from "@/components/tag-filter-bar";
import { PatchList } from "./patch-list";

type SelectionProps = {
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
};

function CollapsibleSection({
  label,
  patches,
  existingTags,
  selectable,
  selectedIds,
  onToggleSelect,
}: {
  label: string;
  patches: Patch[];
  existingTags: string[];
} & SelectionProps) {
  const [open, setOpen] = useState(false);
  if (patches.length === 0) return null;
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground/70 hover:bg-muted/40 transition-colors"
      >
        <span>
          {label}
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
          <PatchList
            patches={patches}
            existingTags={existingTags}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
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

export function ProjectPatchView({
  slug,
  patches,
  archivedPatches,
  existingTags,
}: {
  slug: string;
  patches: Patch[];
  archivedPatches: Patch[];
  existingTags: string[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Bulk-select mode (GUI parity with cp_batch_update).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  const statusCounts = useMemo(() => {
    const counts = { open: 0, in_progress: 0, done: 0 };
    patches.forEach((p) => counts[p.status]++);
    return counts;
  }, [patches]);

  const completedCount = statusCounts.done;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function bulkAction(action: "start" | "complete" | "reopen") {
    if (selectedIds.size === 0) return;
    await fetch("/api/patches/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch_ids: Array.from(selectedIds), action }),
    });
    exitSelect();
    startTransition(() => router.refresh());
  }

  async function archiveCompleted() {
    await fetch("/api/patches/archive-completed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: slug }),
    });
    setArchiveConfirm(false);
    startTransition(() => router.refresh());
  }

  const selectionProps: SelectionProps = {
    selectable: selectMode,
    selectedIds,
    onToggleSelect: toggleSelect,
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    patches.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [patches]);

  function toggleTag(tag: string) {
    setTagFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const filteredPatches = useMemo(() => {
    let result = [...patches];

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((p) => p.priority === priorityFilter);
    }
    if (tagFilters.length > 0) {
      result = result.filter((p) =>
        p.tags.some((t) => tagFilters.includes(t))
      );
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
  }, [patches, statusFilter, priorityFilter, tagFilters, sortField, sortDir]);

  if (patches.length === 0 && archivedPatches.length === 0) {
    return (
      <p className="text-center text-muted-foreground/50 text-sm py-16">
        No patches yet. Add one with the button above.
      </p>
    );
  }

  return (
    <>
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

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          {completedCount > 0 &&
            (archiveConfirm ? (
              <span className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">
                  Archive {completedCount} completed?
                </span>
                <button
                  onClick={archiveCompleted}
                  disabled={busy}
                  className="font-medium text-amber-500 hover:text-amber-400 disabled:opacity-40 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setArchiveConfirm(false)}
                  className="text-muted-foreground/50 hover:text-foreground/70 transition-colors"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setArchiveConfirm(true)}
                className="text-xs text-muted-foreground border border-border rounded-md px-2 py-1 hover:text-foreground/70 hover:border-muted-foreground/40 transition-colors"
              >
                Archive completed
              </button>
            ))}
          <button
            onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={`text-xs border rounded-md px-2 py-1 transition-colors ${
              selectMode
                ? "border-primary/40 text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground/70 hover:border-muted-foreground/40"
            }`}
          >
            {selectMode ? "Cancel" : "Select"}
          </button>
        </div>

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
            className="inline-flex items-center text-muted-foreground hover:text-foreground/70 border border-border rounded-md px-2 py-1 transition-colors"
            title={sortDir === "desc" ? "Descending" : "Ascending"}
            aria-label={sortDir === "desc" ? "Sort descending" : "Sort ascending"}
          >
            {sortDir === "desc" ? (
              <ArrowDown aria-hidden className="h-3.5 w-3.5" />
            ) : (
              <ArrowUp aria-hidden className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Tag filter row */}
      <TagFilterBar
        tags={allTags}
        active={tagFilters}
        onToggle={toggleTag}
        onClear={() => setTagFilters([])}
      />

      {/* Patch list */}
      {filteredPatches.length === 0 && archivedPatches.length === 0 ? (
        <p className="text-center text-muted-foreground/50 text-sm py-8">
          No patches match your filters.
        </p>
      ) : statusFilter === "done" ? (
        <>
          <PatchList
            patches={filteredPatches}
            existingTags={existingTags}
            {...selectionProps}
          />
          <CollapsibleSection
            label="Archived"
            patches={archivedPatches}
            existingTags={existingTags}
            {...selectionProps}
          />
        </>
      ) : (
        <>
          <PatchList
            patches={filteredPatches.filter((p) => p.status !== "done")}
            existingTags={existingTags}
            {...selectionProps}
          />
          <CollapsibleSection
            label="Completed"
            patches={filteredPatches.filter((p) => p.status === "done")}
            existingTags={existingTags}
            {...selectionProps}
          />
          <CollapsibleSection
            label="Archived"
            patches={archivedPatches}
            existingTags={existingTags}
            {...selectionProps}
          />
        </>
      )}
    </div>

    {selectMode && (
      <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 flex items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2 shadow-xl backdrop-blur">
        <span className="text-xs tabular-nums text-muted-foreground">
          {selectedIds.size} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <button
          onClick={() => bulkAction("start")}
          disabled={busy || selectedIds.size === 0}
          className="text-xs text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
        >
          Start
        </button>
        <button
          onClick={() => bulkAction("complete")}
          disabled={busy || selectedIds.size === 0}
          className="text-xs text-emerald-500 dark:text-emerald-400 hover:opacity-80 disabled:opacity-40 transition-colors"
        >
          Complete
        </button>
        <button
          onClick={() => bulkAction("reopen")}
          disabled={busy || selectedIds.size === 0}
          className="text-xs text-blue-500 dark:text-blue-400 hover:opacity-80 disabled:opacity-40 transition-colors"
        >
          Reopen
        </button>
        <div className="h-4 w-px bg-border" />
        <button
          onClick={exitSelect}
          className="text-xs text-muted-foreground/60 hover:text-foreground/70 transition-colors"
        >
          Done
        </button>
      </div>
    )}
    </>
  );
}
