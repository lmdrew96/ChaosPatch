"use client";

import { useState, useTransition } from "react";
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

  async function remove() {
    await fetch(`/api/patches/${patch.id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
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

        {/* Title + notes toggle */}
        <div className="flex-1 min-w-0">
          <button
            className="text-left text-sm text-zinc-200 hover:text-white w-full truncate"
            onClick={() => setExpanded((v) => !v)}
          >
            {patch.title}
          </button>
          {expanded && patch.notes && (
            <p className="mt-2 text-xs text-zinc-400 whitespace-pre-wrap font-mono bg-zinc-950 rounded p-2">
              {patch.notes}
            </p>
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
          {patch.status === "done" && (
            <button
              onClick={remove}
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
