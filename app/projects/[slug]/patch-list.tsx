"use client";

import { useState, useTransition, useRef } from "react";
import type { Patch } from "@/lib/queries";
import { useRouter } from "next/navigation";

const PRIORITY_STYLES: Record<Patch["priority"], string> = {
  high: "text-red-400 bg-red-950/40 border-red-900",
  medium: "text-yellow-500 dark:text-yellow-400 bg-yellow-950/40 border-yellow-900",
  low: "text-muted-foreground bg-muted/60 border-border",
};

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
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const editTitleRef = useRef<HTMLInputElement>(null);

  const nextStatus = STATUS_NEXT[patch.status];

  function startEditing() {
    setEditTitle(patch.title);
    setEditPriority(patch.priority);
    setEditing(true);
    setTimeout(() => editTitleRef.current?.focus(), 50);
  }

  async function saveEdit() {
    if (!editTitle.trim()) return;
    await fetch(`/api/patches/${patch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim(), priority: editPriority }),
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
            className="w-full rounded-md border border-border bg-input px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="flex items-center gap-2">
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as Patch["priority"])}
              className="rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground/70 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              onClick={saveEdit}
              disabled={isPending || !editTitle.trim()}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded px-2.5 py-1 transition-colors"
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
                      className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-foreground/90 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
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
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded px-2.5 py-1 transition-colors"
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
                className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-40 transition-colors"
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
