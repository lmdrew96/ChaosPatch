"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteProjectButton({
  slug,
  projectName,
}: {
  slug: string;
  projectName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmStep, setConfirmStep] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function handleDelete() {
    if (confirmText !== projectName) return;
    const res = await fetch(`/api/projects/${slug}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => router.push("/"));
    }
  }

  if (!confirmStep) {
    return (
      <button
        onClick={() => setConfirmStep(true)}
        className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 rounded-md px-3 py-1.5 transition-colors"
      >
        Delete this project
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Type <strong className="text-foreground/70 font-mono">{projectName}</strong> to confirm:
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={projectName}
        autoFocus
        className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
      />
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={isPending || confirmText !== projectName}
          className="text-xs bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md px-3 py-1.5 font-medium transition-colors"
        >
          {isPending ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          onClick={() => {
            setConfirmStep(false);
            setConfirmText("");
          }}
          className="text-xs text-muted-foreground hover:text-foreground/70 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
