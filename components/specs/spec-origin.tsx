"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import type { Patch } from "@/lib/queries";
import type { SectionSnapshot } from "@/lib/specs";
import { Markdown } from "@/components/markdown";
import { LineDiff } from "./line-diff";
import { timeAgo } from "@/components/dashboard/patch-list-item";

const LINK_BTN = "underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50";

/**
 * On an expanded patch: where it came from in its spec, the "spec changed
 * since this was written" marker (loud while the work is live, quiet once
 * done), and the section as it read when the patch was filed.
 */
export function SpecOrigin({
  patch,
  busy,
  onDismiss,
}: {
  patch: Patch;
  busy: boolean;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<{ then: SectionSnapshot | null; now: SectionSnapshot } | null>(null);
  const [error, setError] = useState("");
  const ref = patch.spec_ref;
  if (!ref) return null;

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setError("");
    try {
      const res = await fetch(
        `/api/spec-sections/${ref.section_id}?at=${encodeURIComponent(patch.created_at)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSnap(data);
    } catch (err) {
      console.error("Loading section snapshot failed", err);
      setError("Couldn't load the section.");
    }
  };

  const changed = patch.spec_changed_at;
  const live = patch.status !== "done";

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <FileText aria-hidden className="h-3 w-3 shrink-0" />
        <span>From spec:</span>
        <Link
          href={`/specs/${ref.spec_id}#section-${ref.section_id}`}
          className="truncate text-foreground/80 underline underline-offset-2 hover:text-foreground"
        >
          {ref.spec_title} › {ref.heading}
        </Link>
      </p>

      {changed && live ? (
        <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-medium">Spec changed since this was written</p>
          <p className="mt-0.5 text-[11px] opacity-80">
            &ldquo;{ref.heading}&rdquo; was edited {timeAgo(changed)}. Check it still matches before building.
          </p>
          <div className="mt-1.5 flex gap-3 text-[11px]">
            <button type="button" onClick={toggle} className={LINK_BTN}>
              {open ? "Hide comparison" : "Compare with filed version"}
            </button>
            <button type="button" onClick={onDismiss} disabled={busy} className={LINK_BTN}>
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground/70">
          {changed && <span>Spec section changed after this was done ({timeAgo(changed)}).</span>}
          <button type="button" onClick={toggle} className={LINK_BTN}>
            {open ? "Hide section" : "View section as it was when this patch was filed"}
          </button>
          {changed && (
            <button type="button" onClick={onDismiss} disabled={busy} className={LINK_BTN}>
              Dismiss
            </button>
          )}
        </p>
      )}

      {open && (
        <div className="rounded bg-input p-2 space-y-2">
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : !snap ? (
            <p className="text-xs text-muted-foreground/60">Loading…</p>
          ) : !snap.then ? (
            <p className="text-xs text-muted-foreground/70">
              No saved version of this section predates the patch. Here it is now:
            </p>
          ) : (
            <>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                As filed · {new Date(patch.created_at).toLocaleDateString()}
              </p>
              <Markdown className="text-xs text-muted-foreground">{snap.then.body || "_Empty._"}</Markdown>
            </>
          )}
          {snap && !snap.then && (
            <Markdown className="text-xs text-muted-foreground">{snap.now.body || "_Empty._"}</Markdown>
          )}
          {snap?.then && snap.then.body !== snap.now.body && (
            <>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Changes since
              </p>
              <LineDiff before={snap.then.body} after={snap.now.body} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
