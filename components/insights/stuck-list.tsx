"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { PatchWithProject } from "@/lib/queries";
import { PatchListItem } from "@/components/dashboard/patch-list-item";

const DAY_MS = 86_400_000;
const STALLED_AFTER_MS = 7 * DAY_MS;
const NEVER_STARTED_AFTER_MS = 30 * DAY_MS;
const NEVER_STARTED_SHOWN = 5;

const age = (iso: string | null) => (iso ? new Date(iso).getTime() : Infinity);

/**
 * Stuck panel, two groups:
 * - Stalled: in progress, started 7+ days ago (expanded).
 * - Never started: open high/medium patches older than 30 days (collapsed).
 * Review patches live in "Waiting on you", never here. Expects active
 * (non-archived, open + in_progress) patches. Renders nothing when both
 * groups are empty.
 */
export function StuckList({ patches, now }: { patches: PatchWithProject[]; now: number }) {
  const [neverOpen, setNeverOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const stalled = patches
    .filter((p) => p.status === "in_progress" && age(p.started_at) < now - STALLED_AFTER_MS)
    .sort((a, b) => age(a.started_at) - age(b.started_at));

  const neverStarted = patches
    .filter(
      (p) =>
        p.status === "open" &&
        p.priority !== "low" &&
        age(p.created_at) < now - NEVER_STARTED_AFTER_MS
    )
    .sort((a, b) => age(a.created_at) - age(b.created_at));

  if (stalled.length === 0 && neverStarted.length === 0) return null;

  const hidden = neverStarted.length - NEVER_STARTED_SHOWN;
  const neverShown = showAll ? neverStarted : neverStarted.slice(0, NEVER_STARTED_SHOWN);

  return (
    <div className="hud-panel rounded-lg border border-border bg-card p-6">
      <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-4">
        Stuck
      </h2>
      <div className="space-y-4">
        {stalled.length > 0 && (
          <section>
            <h3 className="text-[10px] font-mono text-muted-foreground/50 mb-2">
              Stalled · in progress 7+ days · {stalled.length}
            </h3>
            <ul className="space-y-1.5">
              {stalled.map((p) => (
                <PatchListItem key={p.id} patch={p} timestamp={p.started_at} daysOnly />
              ))}
            </ul>
          </section>
        )}
        {neverStarted.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setNeverOpen((v) => !v)}
              aria-expanded={neverOpen}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ChevronRight
                aria-hidden
                className={`h-3 w-3 transition-transform ${neverOpen ? "rotate-90" : ""}`}
              />
              Never started · open high/medium, 30+ days · {neverStarted.length}
            </button>
            {neverOpen && (
              <>
                <ul className="mt-2 space-y-1.5">
                  {neverShown.map((p) => (
                    <PatchListItem key={p.id} patch={p} timestamp={p.created_at} daysOnly />
                  ))}
                </ul>
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    aria-expanded={showAll}
                    className="mt-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    {showAll ? "− less" : `+${hidden} more`}
                  </button>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
