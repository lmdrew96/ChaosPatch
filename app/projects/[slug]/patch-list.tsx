"use client";

import { useState, useTransition, useRef } from "react";
import type { Patch } from "@/lib/queries";
import { useRouter } from "next/navigation";
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

export function PatchList({ patches }: { patches: Patch[] }) {
  return (
    <ul className="space-y-2">
      {patches.map((patch) => (
        <PatchRow key={patch.id} patch={patch} />
      ))}
    </ul>
  );
}

function DueDateChip({ dueDate }: { dueDate: string }) {
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

function PatchRow({ patch }: { patch: Patch }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(patch.title);
  const [editPriority, setEditPriority] = useState(patch.priority);
  const [editTagsInput, setEditTagsInput] = useState(patch.tags.join(", "));
  const [editDueDate, setEditDueDate] = useState(patch.due_date ?? "");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);

  const nextStatus = STATUS_NEXT[patch.status];

  function startEditing() {
    setEditTitle(patch.title);
    setEditPriority(patch.priority);
    setEditTagsInput(patch.tags.join(", "));
    setEditDueDate(patch.due_date ?? "");
    setEditing(true);
    setTimeout(() => editTitleRef.current?.focus(), 50);
  }

  async function saveEdit() {
    if (!editTitle.trim()) return;
    const parsedTags = editTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    await fetch(`/api/patches/${patch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle.trim(),
        priority: editPriority,
        tags: parsedTags,
        // Empty string clears due_date; a YYYY-MM-DD string sets it.
        due_date: editDueDate === "" ? null : editDueDate,
      }),
    });
    setEditing(false);
    startTransition(() => router.refresh());
  }

  async function advance() {
    if (!nextStatus) return;
    await fetch(`/api/patches/${patch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    startTransition(() => router.refresh());
  }

  async function reopen() {
    await fetch(`/api/patches/${patch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reopen: "open" }),
    });
    startTransition(() => router.refresh());
  }

  async function addNote() {
    if (!noteText.trim()) return;
    await fetch(`/api/patches/${patch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: noteText.trim() }),
    });
    setNoteText("");
    setShowNoteInput(false);
    startTransition(() => router.refresh());
  }

  async function remove() {
    await fetch(`/api/patches/${patch.id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  function handleNoteToggle() {
    setShowNoteInput((v) => !v);
    if (!showNoteInput) {
      setTimeout(() => noteRef.current?.focus(), 50);
    }
  }

  return (
    <li className="rounded-lg border border-border bg-card px-4 py-3">
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
          <input
            value={editTagsInput}
            onChange={(e) => setEditTagsInput(e.target.value)}
            placeholder="tags (comma-separated)"
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
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
        <div className="flex items-start gap-3">
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
            {(patch.tags.length > 0 || patch.due_date) && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {patch.due_date && <DueDateChip dueDate={patch.due_date} />}
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

            {expanded && (
              <div className="mt-2 space-y-2">
                {patch.notes && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-input rounded p-2">
                    {patch.notes}
                  </p>
                )}
                {(patch.started_at || patch.completed_at) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground/60 font-mono">
                    {patch.started_at && (
                      <span>Started: {new Date(patch.started_at).toLocaleString()}</span>
                    )}
                    {patch.completed_at && (
                      <span>Completed: {new Date(patch.completed_at).toLocaleString()}</span>
                    )}
                  </div>
                )}
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
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={startEditing}
              className="text-xs text-muted-foreground/50 hover:text-foreground/70 transition-colors"
            >
              Edit
            </button>
            {nextStatus ? (
              <button
                onClick={advance}
                disabled={isPending}
                className="text-xs text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
              >
                {STATUS_LABEL[patch.status]}
              </button>
            ) : (
              <button
                onClick={reopen}
                disabled={isPending}
                className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-400 dark:hover:text-blue-300 disabled:opacity-40 transition-colors"
              >
                Reopen
              </button>
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
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  ✕
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
        </div>
      )}
    </li>
  );
}
