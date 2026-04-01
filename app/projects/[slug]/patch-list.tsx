"use client";

import { useState, useTransition, useRef } from "react";
import type { Patch } from "@/lib/queries";
import { useRouter } from "next/navigation";

const PRIORITY_STYLES: Record<Patch["priority"], string> = {
  high: "text-red-400 bg-red-950/40 border-red-900",
  medium: "text-yellow-400 bg-yellow-950/40 border-yellow-900",
  low: "text-zinc-400 bg-zinc-800/40 border-zinc-700",
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
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const nextStatus = STATUS_NEXT[patch.status];

  async function advance() {
    if (!nextStatus) return;
    await fetch(`/api/patches/${patch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
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
    <li className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
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
            className="text-left text-sm text-zinc-200 hover:text-white w-full truncate"
            onClick={() => setExpanded((v) => !v)}
          >
            {patch.title}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2">
              {/* Existing notes */}
              {patch.notes && (
                <p className="text-xs text-zinc-400 whitespace-pre-wrap font-mono bg-zinc-950 rounded p-2">
                  {patch.notes}
                </p>
              )}

              {/* Add note toggle */}
              {showNoteInput ? (
                <div className="space-y-2">
                  <textarea
                    ref={noteRef}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note…"
                    rows={2}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono"
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
                      onClick={() => {
                        setShowNoteInput(false);
                        setNoteText("");
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleNoteToggle}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  + Add note
                </button>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {nextStatus && (
            <button
              onClick={advance}
              disabled={isPending}
              className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors"
            >
              {STATUS_LABEL[patch.status]}
            </button>
          )}

          {/* Delete — available for all statuses */}
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
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                ✕
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
