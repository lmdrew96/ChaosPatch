"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hourglass, Check } from "lucide-react";
import type { PatchWithProject } from "@/lib/queries";

// Fired after a patch is marked touched so the header badge refetches.
export const STALE_CHANGED_EVENT = "chaospatch:stale-changed";

const daysSince = (iso: string): number =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

export function StaleCard({
  patches,
  staleDays,
}: {
  patches: PatchWithProject[];
  staleDays: number;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = patches.filter((p) => !hidden.has(p.id));
  if (visible.length === 0) return null;

  const keep = async (id: string) => {
    setPending(id);
    setError(null);
    try {
      const res = await fetch(`/api/patches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ touch: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setHidden((prev) => new Set(prev).add(id));
      window.dispatchEvent(new CustomEvent(STALE_CHANGED_EVENT));
      router.refresh();
    } catch (err) {
      console.error("Failed to mark patch as still relevant", err);
      setError("Couldn't save that — try again.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      id="stale"
      className="hud-panel rounded-lg border border-border bg-card/60 backdrop-blur p-4 animate-fade-in scroll-mt-24"
    >
      <div className="flex items-baseline gap-2 mb-1">
        <Hourglass aria-hidden className="h-4 w-4 text-primary self-center shrink-0" />
        <span className="text-sm font-medium text-foreground/90">Going stale</span>
        <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
          ({visible.length})
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground/50 mb-3">
        Untouched for {staleDays}+ days. Open one to pick it back up, or mark it still relevant.
      </p>
      <ul className="space-y-1.5">
        {visible.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5">
            <Link
              href={`/projects/${p.project_slug}?patch=${p.id}`}
              className="flex flex-1 min-w-0 items-center gap-2.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 hover:border-muted-foreground/40 hover:bg-card transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: p.project_color }}
                aria-hidden
              />
              <span className="text-sm text-foreground/90 truncate flex-1 min-w-0" title={p.title}>
                {p.title}
              </span>
              <span
                className="text-[10px] font-mono text-muted-foreground/60 shrink-0 hidden sm:inline max-w-[120px] truncate"
                title={p.project_name}
              >
                {p.project_slug}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 shrink-0 tabular-nums">
                {daysSince(p.updated_at)}d
              </span>
            </Link>
            <button
              type="button"
              onClick={() => keep(p.id)}
              disabled={pending === p.id}
              className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors disabled:opacity-50"
              title="Still relevant — reset the clock"
              aria-label={`Mark "${p.title}" as still relevant`}
            >
              <Check aria-hidden className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-[11px] text-destructive mt-2">{error}</p>}
    </div>
  );
}
