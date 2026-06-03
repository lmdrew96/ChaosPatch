"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/queries";
import { TagAutocompleteInput } from "@/components/tag-autocomplete-input";

const PRIORITIES = ["low", "medium", "high"] as const;

export function AddPatchForm({
  projects,
  defaultSlug,
  existingTags = [],
}: {
  projects: Project[];
  defaultSlug?: string;
  existingTags?: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slug, setSlug] = useState(defaultSlug ?? projects[0]?.slug ?? "");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");

  const parsedTags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const cancelHref = slug ? `/projects/${slug}` : "/dashboard";

  function handleCancel() {
    startTransition(() => router.push(cancelHref));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setError("");

    const res = await fetch("/api/patches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_slug: slug,
        title: title.trim(),
        priority,
        notes: notes.trim() || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        due_date: dueDate || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    startTransition(() => router.push(`/projects/${slug}`));
  }

  if (projects.length === 0) {
    return (
      <p className="text-muted-foreground/70 text-sm text-center py-12">
        No projects yet. Create a project first from Claude Code using{" "}
        <code className="font-mono bg-card px-1.5 py-0.5 rounded text-muted-foreground">
          cp_add_project
        </code>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Project
        </label>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs fixing?"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Notes <span className="text-muted-foreground/50 normal-case tracking-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Context, repro steps, scope…"
          rows={3}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[72px]"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Tags <span className="text-muted-foreground/50 normal-case tracking-normal">(optional, comma-separated)</span>
        </label>
        <TagAutocompleteInput
          value={tagsInput}
          onChange={setTagsInput}
          existingTags={existingTags}
          placeholder="bug, ui, db"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {existingTags.length > 0 && (
          <p className="text-[10px] text-muted-foreground/50">
            Type a new tag, or focus the field to pick from existing ones.
          </p>
        )}
        {parsedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {parsedTags.map((t) => (
              <span
                key={t}
                className="text-[10px] font-medium uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Due date <span className="text-muted-foreground/50 normal-case tracking-normal">(optional)</span>
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Priority
        </label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize transition-colors ${
                priority === p
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="flex-1 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:border-muted-foreground/40 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add patch"}
        </button>
      </div>
    </form>
  );
}
