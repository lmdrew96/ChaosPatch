"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SpecListRow } from "@/lib/specs";
import { SpecRow } from "@/components/specs/spec-list";
import { NewSpecButton } from "@/components/specs/new-spec-button";

const SMALL_BTN =
  "rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors disabled:opacity-50";

/** A project's specs (primary first), plus new / attach-a-draft. */
export function ProjectSpecs({
  slug,
  specs,
  drafts,
}: {
  slug: string;
  specs: SpecListRow[];
  drafts: SpecListRow[];
}) {
  const router = useRouter();
  const [draftId, setDraftId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const attach = async () => {
    if (!draftId) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/specs/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // The first spec a project gets is its primary one.
        body: JSON.stringify({ attach: slug, is_primary: specs.length === 0 }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setDraftId("");
      router.refresh();
    } catch (err) {
      console.error("Attach spec failed", err);
      setError(err instanceof Error ? err.message : "Couldn't attach that spec.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="project-specs-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="project-specs-heading"
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Specs {specs.length > 0 && <span className="font-mono">({specs.length})</span>}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {drafts.length > 0 && (
            <span className="flex items-center gap-1.5">
              <label htmlFor="attach-draft" className="sr-only">
                Attach a draft spec
              </label>
              <select
                id="attach-draft"
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs [@media(pointer:coarse)]:text-base text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-w-[12rem]"
              >
                <option value="">Attach spec…</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
              <button type="button" disabled={busy || !draftId} onClick={attach} className={SMALL_BTN}>
                Attach
              </button>
            </span>
          )}
          <NewSpecButton projectSlug={slug} className={SMALL_BTN} />
        </div>
      </div>
      {specs.length === 0 ? (
        <p className="text-xs text-muted-foreground/60">
          No specs. Optional: projects work fine without one.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {specs.map((s) => (
            <SpecRow key={s.id} spec={s} />
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
