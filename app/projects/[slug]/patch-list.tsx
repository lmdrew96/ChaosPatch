"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import type { Patch } from "@/lib/queries";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Paperclip, X, type LucideIcon } from "lucide-react";
import { TagAutocompleteInput } from "@/components/tag-autocomplete-input";
import { PatchImageAttachments } from "@/components/patch-image-attachments";
import { Markdown } from "@/components/markdown";
import { PRIORITY_STYLES } from "@/lib/priority-styles";

const STATUS_NEXT: Record<Patch["status"], Patch["status"] | null> = {
  open: "in_progress",
  in_progress: "done",
  done: null,
};

const STATUS_LABEL: Record<Patch["status"], string> = {
  open: "Start",
  in_progress: "Complete",
  done: "Done",
};

const STATUS_TEXT: Record<Patch["status"], string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export function PatchList({
  patches,
  existingTags = [],
  selectable = false,
  selectedIds,
  onToggleSelect,
  focusId,
}: {
  patches: Patch[];
  existingTags?: string[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  // Patch targeted by a ?patch=<id> deep link — expanded, scrolled to, highlighted.
  focusId?: string;
}) {
  return (
    <ul className="space-y-2">
      {patches.map((patch) => (
        <PatchRow
          key={patch.id}
          patch={patch}
          existingTags={existingTags}
          focused={patch.id === focusId}
          selectable={selectable}
          selected={selectedIds?.has(patch.id) ?? false}
          onSelectToggle={
            onToggleSelect ? () => onToggleSelect(patch.id) : undefined
          }
        />
      ))}
    </ul>
  );
}

export function DueDateChip({ dueDate }: { dueDate: string }) {
  // Compare in local time at day granularity so "today" matches the user's day.
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // dueDate from Postgres DATE comes through as "YYYY-MM-DD" or ISO.
  // Parse as local-day to avoid off-by-one on timezones west of UTC.
  const [y, m, d] = dueDate.slice(0, 10).split("-").map(Number);
  const due = new Date(y, (m ?? 1) - 1, d ?? 1);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  let label: string;
  if (diffDays === 0) label = "Due today";
  else if (diffDays === 1) label = "Due tomorrow";
  else if (diffDays === -1) label = "1d overdue";
  else if (diffDays < 0) label = `${-diffDays}d overdue`;
  else label = `Due in ${diffDays}d`;

  const tone =
    diffDays < 0
      ? "bg-red-500/10 text-red-400 border-red-500/30"
      : diffDays <= 3
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : "bg-muted/40 text-muted-foreground border-border";

  return (
    <span
      className={`text-[9px] font-medium uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${tone}`}
      title={`Due ${dueDate.slice(0, 10)}`}
    >
      {label}
    </span>
  );
}

// Click-to-copy chip. `getValue` runs at click time so it can read
// window.location without touching it during render.
function CopyChip({
  label,
  title,
  getValue,
  Icon,
}: {
  label: string;
  title: string;
  getValue: () => string;
  Icon: LucideIcon;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(getValue());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(`Failed to copy ${label}`, err);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={title}
      aria-label={copied ? `${label} copied` : title}
      className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 hover:text-foreground/80 hover:border-muted-foreground/40 transition-colors"
    >
      <span>{label}</span>
      {copied ? (
        <Check aria-hidden className="h-2.5 w-2.5 text-primary" />
      ) : (
        <Icon aria-hidden className="h-2.5 w-2.5" />
      )}
    </button>
  );
}

function PatchRow({
  patch,
  existingTags,
  focused = false,
  selectable = false,
  selected = false,
  onSelectToggle,
}: {
  patch: Patch;
  existingTags: string[];
  focused?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectToggle?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(focused);
  const [highlight, setHighlight] = useState(focused);
  const rowRef = useRef<HTMLLIElement>(null);

  // Deep-linked row: bring it into view, then fade the highlight.
  useEffect(() => {
    if (!focused) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlight(false), 2500);
    return () => clearTimeout(t);
  }, [focused]);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(patch.title);
  const [editPriority, setEditPriority] = useState(patch.priority);
  const [editTagsInput, setEditTagsInput] = useState(patch.tags.join(", "));
  const [editDueDate, setEditDueDate] = useState(patch.due_date ?? "");
  const [editNotes, setEditNotes] = useState(patch.notes ?? "");
  const [editSpec, setEditSpec] = useState(patch.spec ?? "");
  const [error, setError] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);

  const nextStatus = STATUS_NEXT[patch.status];

  function startEditing() {
    setEditTitle(patch.title);
    setEditPriority(patch.priority);
    setEditTagsInput(patch.tags.join(", "));
    setEditDueDate(patch.due_date ?? "");
    setEditNotes(patch.notes ?? "");
    setEditSpec(patch.spec ?? "");
    setEditing(true);
    setTimeout(() => editTitleRef.current?.focus(), 50);
  }

  // Runs a mutation against this patch. On failure, sets an inline error and
  // returns false so callers keep any open editor (and the user's typed text).
  async function mutate(init: RequestInit): Promise<boolean> {
    setError("");
    try {
      const res = await fetch(`/api/patches/${patch.id}`, init);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Request failed (${res.status})`);
        return false;
      }
    } catch (err) {
      console.error("Patch mutation failed", err);
      setError("Couldn't reach the server — check your connection and try again.");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  const patchBody = (body: object): RequestInit => ({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  async function saveEdit() {
    if (!editTitle.trim()) return;
    const parsedTags = editTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const ok = await mutate(
      patchBody({
        title: editTitle.trim(),
        priority: editPriority,
        tags: parsedTags,
        // Empty string clears due_date; a YYYY-MM-DD string sets it.
        due_date: editDueDate === "" ? null : editDueDate,
        // Empty string clears notes (replace, not append); any text sets it.
        notes: editNotes.trim() === "" ? null : editNotes,
        // Empty string clears the spec; any text sets it.
        spec: editSpec.trim() === "" ? null : editSpec,
      })
    );
    if (ok) setEditing(false);
  }

  async function advance() {
    if (!nextStatus) return;
    await mutate(patchBody({ status: nextStatus }));
  }

  async function reopen() {
    await mutate(patchBody({ reopen: "open" }));
  }

  async function addNote() {
    if (!noteText.trim()) return;
    const ok = await mutate(patchBody({ note: noteText.trim() }));
    if (ok) {
      setNoteText("");
      setShowNoteInput(false);
    }
  }

  async function remove() {
    const ok = await mutate({ method: "DELETE" });
    if (!ok) setConfirmDelete(false);
  }

  async function toggleArchive() {
    await mutate(patchBody({ archive: !patch.archived }));
  }

  function handleNoteToggle() {
    setShowNoteInput((v) => !v);
    if (!showNoteInput) {
      setTimeout(() => noteRef.current?.focus(), 50);
    }
  }

  return (
    <li
      ref={rowRef}
      className={`rounded-lg border bg-card px-4 py-3 transition-colors scroll-mt-24 ${
        selectable && selected
          ? "border-primary/60 ring-1 ring-primary/30"
          : highlight
          ? "border-primary/60 ring-2 ring-primary/40"
          : "border-border"
      }`}
    >
      {editing ? (
        /* ── Edit mode ── */
        <div className="space-y-2">
          <input
            ref={editTitleRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <TagAutocompleteInput
            value={editTagsInput}
            onChange={setEditTagsInput}
            existingTags={existingTags}
            placeholder="tags (comma-separated)"
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Notes (terse — triage summary + acceptance criteria)"
            rows={3}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-foreground/90 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
          />
          <textarea
            value={editSpec}
            onChange={(e) => setEditSpec(e.target.value)}
            placeholder="Long-form spec (optional) — kept out of the list view"
            rows={4}
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-foreground/90 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
          />
          <div className="flex items-center gap-2">
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as Patch["priority"])}
              className="rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              onClick={saveEdit}
              disabled={isPending || !editTitle.trim()}
              className="text-xs bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground rounded px-2.5 py-1 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground/70 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* ── View mode ── */
        <>
        {/* Header row. On phones the actions wrap to their own line so the title
            isn't squeezed; from sm up they sit on the right. */}
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1 sm:flex-nowrap">
          {/* Selection checkbox (bulk mode) */}
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelectToggle}
              className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer accent-primary"
              aria-label={selected ? "Deselect patch" : "Select patch"}
            />
          )}

          {/* Priority badge */}
          <span
            className={`mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider border rounded px-1.5 py-0.5 ${PRIORITY_STYLES[patch.priority]}`}
          >
            {patch.priority}
          </span>

          {/* Title + notes */}
          <div className="flex-1 min-w-0">
            <button
              className="text-left text-sm text-foreground/90 hover:text-foreground w-full truncate"
              onClick={() => setExpanded((v) => !v)}
              title={patch.title}
            >
              {patch.title}
            </button>
            {(patch.tags.length > 0 ||
              patch.due_date ||
              (patch.attachments?.length ?? 0) > 0) && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {patch.due_date && <DueDateChip dueDate={patch.due_date} />}
                {(patch.attachments?.length ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider bg-muted/60 text-muted-foreground border border-border rounded-full px-1.5 py-0.5">
                    <Paperclip aria-hidden className="h-2.5 w-2.5" />
                    {patch.attachments!.length}
                  </span>
                )}
                {patch.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[9px] font-medium uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-full px-1.5 py-0.5"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

          </div>

          {/* Actions (hidden while bulk-selecting) */}
          {!selectable && (
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
            <button
              onClick={startEditing}
              className="text-xs text-muted-foreground/50 hover:text-foreground/70 transition-colors"
            >
              Edit
            </button>
            {patch.archived ? (
              <button
                onClick={toggleArchive}
                disabled={isPending}
                className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-400 dark:hover:text-blue-300 disabled:opacity-40 transition-colors"
              >
                Unarchive
              </button>
            ) : nextStatus ? (
              <button
                onClick={advance}
                disabled={isPending}
                className="text-xs text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
              >
                {STATUS_LABEL[patch.status]}
              </button>
            ) : (
              <>
                <button
                  onClick={reopen}
                  disabled={isPending}
                  className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-400 dark:hover:text-blue-300 disabled:opacity-40 transition-colors"
                >
                  Reopen
                </button>
                <button
                  onClick={toggleArchive}
                  disabled={isPending}
                  className="text-xs text-muted-foreground/50 hover:text-foreground/70 disabled:opacity-40 transition-colors"
                >
                  Archive
                </button>
              </>
            )}
            {confirmDelete ? (
              <span className="flex items-center gap-1.5">
                <button
                  onClick={remove}
                  disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors font-medium"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex items-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  aria-label="Cancel delete"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
                className="text-xs text-muted-foreground/50 hover:text-red-400 disabled:opacity-40 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
          )}
        </div>

        {/* Expanded details span the full row width — previously they lived in
            the title column and got squeezed beside the action buttons. */}
        {expanded && (
          <div className="mt-2 space-y-2">
            {patch.notes && (
              <Markdown className="text-xs text-muted-foreground bg-input rounded p-2">
                {patch.notes}
              </Markdown>
            )}
            {patch.spec && (
              <div className="rounded bg-input p-2">
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Spec
                </div>
                <Markdown className="text-xs text-muted-foreground">
                  {patch.spec}
                </Markdown>
              </div>
            )}
            <PatchImageAttachments
              mode="saved"
              patchId={patch.id}
              attachments={patch.attachments ?? []}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground/60 font-mono">
              {/* Short ID prefix agents cite (e.g. "dcc26973"); copies the full UUID. */}
              <CopyChip
                label={`ID ${patch.id.slice(0, 8)}`}
                title={`Patch ID: ${patch.id} — click to copy`}
                getValue={() => patch.id}
                Icon={Copy}
              />
              <CopyChip
                label="Link"
                title="Copy link to this patch"
                getValue={() =>
                  `${window.location.origin}${window.location.pathname}?patch=${patch.id}`
                }
                Icon={Link2}
              />
              <span>
                Status: {STATUS_TEXT[patch.status]}
                {patch.archived && " · Archived"}
              </span>
              <span>Filed: {new Date(patch.created_at).toLocaleString()}</span>
              {patch.started_at && (
                <span>Started: {new Date(patch.started_at).toLocaleString()}</span>
              )}
              {patch.completed_at && (
                <span>Completed: {new Date(patch.completed_at).toLocaleString()}</span>
              )}
              {/* DATE column — no time component, so show as-is (no tz shift). */}
              {patch.due_date && <span>Due: {patch.due_date.slice(0, 10)}</span>}
            </div>
            {showNoteInput ? (
              <div className="space-y-2">
                <textarea
                  ref={noteRef}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-foreground/90 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) addNote();
                    if (e.key === "Escape") {
                      setShowNoteInput(false);
                      setNoteText("");
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={addNote}
                    disabled={isPending || !noteText.trim()}
                    className="text-xs bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground rounded px-2.5 py-1 transition-colors"
                  >
                    Save note
                  </button>
                  <button
                    onClick={() => { setShowNoteInput(false); setNoteText(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground/70 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleNoteToggle}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                + Add note
              </button>
            )}
          </div>
        )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}
