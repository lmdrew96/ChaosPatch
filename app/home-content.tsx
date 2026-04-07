"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Project, PatchWithProject } from "@/lib/queries";

// ── Types ──────────────────────────────────────────────────────────────────

type ViewMode = "projects" | "patches";
type StatusFilter = "all" | "open" | "in_progress" | "done";
type PriorityFilter = "all" | "low" | "medium" | "high";
type SortField = "created" | "priority" | "status" | "project";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const STATUS_ORDER = { in_progress: 0, open: 1, done: 2 };

// ── Main Component ─────────────────────────────────────────────────────────

export function HomeContent({
  projects,
  patches,
}: {
  projects: Project[];
  patches: PatchWithProject[];
}) {
  const [view, setView] = useState<ViewMode>("projects");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortField, setSortField] = useState<SortField>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  // ── Filtered + sorted patches ──────────────────────────────────────────

  const filteredPatches = useMemo(() => {
    let result = [...patches];

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((p) => p.priority === priorityFilter);
    }
    if (projectFilter !== "all") {
      result = result.filter((p) => p.project_slug === projectFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "created":
          cmp =
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime();
          break;
        case "priority":
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case "status":
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case "project":
          cmp = a.project_name.localeCompare(b.project_name);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [patches, statusFilter, priorityFilter, projectFilter, sortField, sortDir]);

  // ── Filtered + sorted projects ─────────────────────────────────────────

  const filteredProjects = useMemo(() => {
    const result = [...projects];
    // Projects are always sorted by open count desc for now
    return result;
  }, [projects]);

  // ── Counts for filter badges ───────────────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts = { open: 0, in_progress: 0, done: 0 };
    patches.forEach((p) => counts[p.status]++);
    return counts;
  }, [patches]);

  return (
    <>
      {/* View toggle + filters bar */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Top row: toggle + sort */}
        <div className="flex items-center justify-between">
          <div className="flex bg-card rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setView("projects")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "projects"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              }`}
            >
              Projects
            </button>
            <button
              onClick={() => setView("patches")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === "patches"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground/70"
              }`}
            >
              Patches
              <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                {patches.length}
              </span>
            </button>
          </div>

          {view === "patches" && (
            <div className="flex items-center gap-2">
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="created">Sort: Date</option>
                <option value="priority">Sort: Priority</option>
                <option value="status">Sort: Status</option>
                <option value="project">Sort: Project</option>
              </select>
              <button
                onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                className="text-xs text-muted-foreground hover:text-foreground/70 border border-border rounded-md px-2 py-1 transition-colors"
                title={sortDir === "desc" ? "Newest first" : "Oldest first"}
              >
                {sortDir === "desc" ? "↓" : "↑"}
              </button>
            </div>
          )}
        </div>

        {/* Filter chips — only show in patches view */}
        {view === "patches" && (
          <div className="flex flex-wrap gap-2">
            {/* Status filters */}
            <FilterChipGroup
              label="Status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              options={[
                { value: "all", label: "All" },
                { value: "open", label: "Open", count: statusCounts.open },
                { value: "in_progress", label: "In Progress", count: statusCounts.in_progress },
                { value: "done", label: "Done", count: statusCounts.done },
              ]}
            />

            <div className="w-px bg-border mx-1 self-stretch" />

            {/* Priority filters */}
            <FilterChipGroup
              label="Priority"
              value={priorityFilter}
              onChange={(v) => setPriorityFilter(v as PriorityFilter)}
              options={[
                { value: "all", label: "All" },
                { value: "high", label: "High" },
                { value: "medium", label: "Med" },
                { value: "low", label: "Low" },
              ]}
            />

            {/* Project filter */}
            {projects.length > 1 && (
              <>
                <div className="w-px bg-border mx-1 self-stretch" />
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {view === "projects" ? (
        filteredProjects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )
      ) : filteredPatches.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground/50 text-sm">
            {patches.length === 0
              ? "No patches yet across any project."
              : "No patches match your filters."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredPatches.map((patch) => (
            <PatchRow key={patch.id} patch={patch} />
          ))}
        </ul>
      )}
    </>
  );
}

// ── Filter Chip Group ──────────────────────────────────────────────────────

function FilterChipGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; count?: number }[];
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mr-1">
        {label}
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
            value === opt.value
              ? "bg-indigo-600/20 text-indigo-500 dark:text-indigo-300 border border-indigo-500/30"
              : "bg-card text-muted-foreground border border-border hover:border-muted-foreground/40 hover:text-foreground/70"
          }`}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span className="ml-1 font-mono text-[10px] opacity-60">
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Project Card ───────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  const openCount = Number(project.open_count ?? 0);
  return (
    <Link href={`/projects/${project.slug}`}>
      <div className="group rounded-lg border border-border bg-card p-5 hover:border-muted-foreground/40 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-3 h-3 rounded-full mt-1 shrink-0"
            style={{ backgroundColor: project.color }}
          />
          {openCount > 0 && (
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {openCount} open
            </span>
          )}
        </div>
        <p className="font-medium text-foreground group-hover:text-foreground truncate">
          {project.name}
        </p>
        <p className="mt-1 text-xs font-mono text-muted-foreground/70">{project.slug}</p>
      </div>
    </Link>
  );
}

// ── Patch Row (flat view) ──────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  high: "text-red-400 bg-red-950/40 border-red-900",
  medium: "text-yellow-500 dark:text-yellow-400 bg-yellow-950/40 border-yellow-900",
  low: "text-muted-foreground bg-muted/60 border-border",
};

const STATUS_STYLES: Record<string, string> = {
  open: "text-blue-500 dark:text-blue-400",
  in_progress: "text-amber-500 dark:text-amber-400",
  done: "text-emerald-500 dark:text-emerald-400",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

function PatchRow({ patch }: { patch: PatchWithProject }) {
  return (
    <Link href={`/projects/${patch.project_slug}`}>
      <li className="rounded-lg border border-border bg-card px-4 py-3 hover:border-muted-foreground/40 transition-colors cursor-pointer list-none">
        {/* Title */}
        <span className="block text-sm text-foreground/90 truncate mb-1.5">
          {patch.title}
        </span>
        {/* Metadata row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider border rounded px-1.5 py-0.5 ${PRIORITY_STYLES[patch.priority]}`}
          >
            {patch.priority}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: patch.project_color }}
            />
            <span className="text-xs text-muted-foreground/70 font-mono max-w-[120px] truncate">
              {patch.project_slug}
            </span>
          </span>
          <span
            className={`text-[10px] font-medium uppercase tracking-wider shrink-0 ml-auto ${STATUS_STYLES[patch.status]}`}
          >
            {STATUS_LABELS[patch.status]}
          </span>
        </div>
      </li>
    </Link>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-24">
      <p className="text-muted-foreground/70 text-sm">No projects yet.</p>
      <p className="text-muted-foreground/50 text-xs mt-1">
        Use <strong className="text-muted-foreground">+ New project</strong> above, or
        from Claude Code with{" "}
        <code className="font-mono bg-card px-1.5 py-0.5 rounded text-muted-foreground">
          cp_add_project
        </code>
        .
      </p>
    </div>
  );
}
