"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";

export function ArchiveProjectButton({
  slug,
  archived,
}: {
  slug: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the server refuses because patches are still in progress.
  const [blockedBy, setBlockedBy] = useState<number | null>(null);

  async function send(method: "POST" | "DELETE", force = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${slug}/archive`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify({ force }) : undefined,
      });
      if (res.status === 409) {
        const data = await res.json();
        setBlockedBy(data.in_progress_count ?? 1);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBlockedBy(null);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Failed to change project archive state", err);
      setError("Couldn't save that — try again.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || isPending;

  if (blockedBy !== null) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">
          {blockedBy} {blockedBy === 1 ? "patch is" : "patches are"} still in progress.
        </span>
        <button
          onClick={() => send("POST", true)}
          disabled={disabled}
          className="rounded-md border border-border px-2 py-1 text-foreground/80 hover:border-muted-foreground/40 disabled:opacity-40 transition-colors"
        >
          Archive anyway
        </button>
        <button
          onClick={() => setBlockedBy(null)}
          className="text-muted-foreground hover:text-foreground/70 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => send(archived ? "DELETE" : "POST")}
        disabled={disabled}
        title={archived ? "Unarchive project" : "Archive project — hide it without deleting"}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 disabled:opacity-40 transition-colors"
      >
        {archived ? (
          <ArchiveRestore aria-hidden className="h-3.5 w-3.5" />
        ) : (
          <Archive aria-hidden className="h-3.5 w-3.5" />
        )}
        {archived ? "Unarchive" : "Archive"}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
