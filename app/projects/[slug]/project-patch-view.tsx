"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { BatchUpdateAction, Patch } from "@/lib/queries";
import { TagFilterBar } from "@/components/tag-filter-bar";
import { useUrlParam } from "@/hooks/use-url-param";
import { matchesPatchSearch } from "@/lib/patch-search";
import { PatchList } from "./patch-list";

type SelectionProps = {
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  focusId?: string;
};

function CollapsibleSection({
  label,
  patches,
  existingTags,
  selectable,
  selectedIds,
  onToggleSelect,
  focusId,
}: {
  label: string;
  patches: Patch[];
  existingTags: string[];
} & SelectionProps) {
  // Start open when a deep link targets a patch inside this section.
  const [open, setOpen] = useState(
    () => !!focusId && patches.some((p) => p.id === focusId)
  );
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
            focusId={focusId}
            selectable={selectable}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        </div>
      )}
    </div>
  );
}

const STATUS_FILTERS = ["all", "open", "in_progress", "done"] as const;
const PRIORITY_FILTERS = ["all", "low", "medium", "high"] as const;
const SORT_FIELDS = ["created", "priority", "status"] as const;
const SORT_DIRS = ["asc", "desc"] as const;

type SortField = (typeof SORT_FIELDS)[number];

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER: Record<string, number> = { in_progress: 0, open: 1, done: 2 };

export function ProjectPatchView({
  slug,
  patches,
  archivedPatches,
  existingTags,
  focusPatchId,
}: {
  slug: string;
  patches: Patch[];
  archivedPatches: Patch[];
  existingTags: string[];
  focusPatchId?: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  // Filter, sort, and search state lives in the URL so it survives back-nav and refresh.
  const [statusFilter, setStatusFilter] = useUrlParam("status", "all", STATUS_FILTERS);
  const [priorityFilter, setPriorityFilter] = useUrlParam("priority", "all", PRIORITY_FILTERS);
  const [tagParam, setTagParam] = useUrlParam<string>("tags", "");
  const [sortField, setSortField] = useUrlParam("sort", "status", SORT_FIELDS);
  const [sortDir, setSortDir] = useUrlParam("dir", "asc", SORT_DIRS);
  const [searchQuery, setSearchQuery] = useUrlParam<string>("q", "");

  // Tags can't contain commas (the tag input splits on them), so a joined param is safe.
  const tagFilters = useMemo(() => (tagParam ? tagParam.split(",") : []), [tagParam]);

  // Bulk-select mode (GUI parity with cp_batch_update).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkTag, setBulkTag] = useState("");

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
    setBulkDeleteConfirm(false);
    setBulkTag("");
  }

  // POSTs a bulk mutation. On failure, sets an inline error and returns false
  // so the caller keeps the current selection / confirm state.
  async function post(url: string, body: object): Promise<boolean> {
    setActionError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setActionError(data?.error ?? `Request failed (${res.status})`);
        return false;
      }
    } catch (err) {
      console.error("Bulk mutation failed", err);
      setActionError("Couldn't reach the server — check your connection and try again.");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function bulkAction(
    action: BatchUpdateAction,
    options: { priority?: Patch["priority"]; tags?: string[] } = {}
  ): Promise<boolean> {
    if (selectedIds.size === 0) return false;
    const ok = await post("/api/patches/batch", {
      patch_ids: Array.from(selectedIds),
      action,
      ...options,
    });
    if (!ok) return false;
    // Status/archive/delete move or remove rows, so leave select mode.
    // Priority and tag edits keep the selection so they can be chained.
    if (action !== "set_priority" && action !== "add_tags") exitSelect();
    return true;
  }

  async function archiveCompleted() {
    const ok = await post("/api/patches/archive-completed", { project: slug });
    if (ok) setArchiveConfirm(false);
  }

  const selectionProps: SelectionProps = {
    selectable: selectMode,
    selectedIds,
    onToggleSelect: toggleSelect,
    focusId: focusPatchId,
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    patches.forEach((p) => p.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [patches]);

  function toggleTag(tag: string) {
    const next = tagFilters.includes(tag)
      ? tagFilters.filter((t) => t !== tag)
      : [...tagFilters, tag];
    setTagParam(next.join(","));
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
    if (searchQuery.trim()) {
      result = result.filter((p) => matchesPatchSearch(p, searchQuery));
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
  }, [patches, statusFilter, priorityFilter, tagFilters, searchQuery, sortField, sortDir]);

  // Archived section ignores status/priority/tag chips (as before) but honors search.
  const filteredArchived = useMemo(
    () => archivedPatches.filter((p) => matchesPatchSearch(p, searchQuery)),
    [archivedPatches, searchQuery]
  );

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

        {/* Search + sort controls */}
        <div className="flex items-center gap-2">
          <input
            data-search-input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patches… ( / )"
            aria-label="Search patches"
            className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring w-44"
          />
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
            onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
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

      {actionError && (
        <p role="alert" className="text-xs text-red-400">
          {actionError}
        </p>
      )}

      {/* Tag filter row */}
      <TagFilterBar
        tags={allTags}
        active={tagFilters}
        onToggle={toggleTag}
        onClear={() => setTagParam("")}
      />

      {/* Patch list */}
      {filteredPatches.length === 0 && filteredArchived.length === 0 ? (
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
            patches={filteredArchived}
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
            patches={filteredArchived}
            existingTags={existingTags}
            {...selectionProps}
          />
        </>
      )}
    </div>

    {selectMode && (
      <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 w-max max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card/95 px-4 py-2 shadow-xl backdrop-blur">
        <span className="text-xs tabular-nums text-muted-foreground">
          {selectedIds.size} selected
        </span>
        {actionError && (
          <span role="alert" className="text-xs text-red-400 max-w-[16rem] truncate" title={actionError}>
            {actionError}
          </span>
        )}
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
        <button
          onClick={() => bulkAction("archive")}
          disabled={busy || selectedIds.size === 0}
          className="text-xs text-muted-foreground hover:text-foreground/80 disabled:opacity-40 transition-colors"
        >
          Archive
        </button>
        <div className="h-4 w-px bg-border" />
        <select
          value=""
          onChange={(e) => {
            const priority = e.target.value as Patch["priority"];
            if (priority) bulkAction("set_priority", { priority });
          }}
          disabled={busy || selectedIds.size === 0}
          aria-label="Set priority for selected patches"
          className="rounded-md border border-border bg-card px-1.5 py-0.5 text-xs text-muted-foreground disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="" disabled>
            Priority…
          </option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const tags = bulkTag
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0);
            if (tags.length === 0) return;
            if (await bulkAction("add_tags", { tags })) setBulkTag("");
          }}
          className="flex items-center"
        >
          <input
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
            placeholder="+ tag ↵"
            aria-label="Add tag to selected patches"
            disabled={busy || selectedIds.size === 0}
            className="w-20 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs text-foreground placeholder:text-muted-foreground/50 disabled:opacity-40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </form>
        <div className="h-4 w-px bg-border" />
        {bulkDeleteConfirm ? (
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              Delete {selectedIds.size}?
            </span>
            <button
              onClick={() => bulkAction("delete")}
              disabled={busy || selectedIds.size === 0}
              className="text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setBulkDeleteConfirm(false)}
              className="text-xs text-muted-foreground/60 hover:text-foreground/70 transition-colors"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            disabled={busy || selectedIds.size === 0}
            className="text-xs text-muted-foreground/60 hover:text-red-400 disabled:opacity-40 transition-colors"
          >
            Delete
          </button>
        )}
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
