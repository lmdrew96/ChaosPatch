"use client";

import { useEffect, useState } from "react";
import type { SpecAuthor, SpecRevision } from "@/lib/specs";
import { AUTHOR_LABELS } from "./spec-list";
import { LineDiff } from "./line-diff";
import { timeAgo } from "@/components/dashboard/patch-list-item";

const AUTHOR_STYLES: Record<SpecAuthor, string> = {
  nae: "text-primary bg-primary/10 border-primary/30",
  coru: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  cody: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
  app: "text-muted-foreground bg-muted border-border",
};

export function AuthorBadge({ author }: { author: SpecAuthor }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center text-[9px] font-semibold uppercase tracking-wider border rounded px-1.5 py-0.5 ${AUTHOR_STYLES[author]}`}
    >
      {AUTHOR_LABELS[author]}
    </span>
  );
}

const KIND_TEXT: Record<SpecRevision["kind"], string> = {
  create: "added",
  edit: "edited",
  delete: "removed",
};

/**
 * Revisions newest first with author badge and a diff. sectionId narrows to
 * one section; without it, the whole spec (removed sections included).
 * refreshKey refetches (e.g. after an autosave).
 */
export function SpecHistory({
  specId,
  sectionId,
  refreshKey,
}: {
  specId: string;
  sectionId?: string;
  refreshKey?: string | null;
}) {
  const [revisions, setRevisions] = useState<SpecRevision[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const query = sectionId ? `?section_id=${sectionId}` : "";
    fetch(`/api/specs/${specId}/history${query}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        if (!cancelled) setRevisions(data as SpecRevision[]);
      })
      .catch((err) => {
        console.error("Loading spec history failed", err);
        if (!cancelled) setError("Couldn't load the history.");
      });
    return () => {
      cancelled = true;
    };
  }, [specId, sectionId, refreshKey]);

  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!revisions) return <p className="text-xs text-muted-foreground/60">Loading history…</p>;
  if (revisions.length === 0) return <p className="text-xs text-muted-foreground/60">No changes yet.</p>;

  return (
    <ol className="space-y-3">
      {revisions.map((r) => {
        const headingChanged = r.kind === "edit" && r.before_heading !== r.after_heading;
        const bodyChanged = r.kind === "edit" && r.before_body !== r.after_body;
        // NULL on revisions from before the flag was tracked.
        const flagChanged =
          r.kind === "edit" &&
          r.before_reference_only !== null &&
          r.after_reference_only !== null &&
          r.before_reference_only !== r.after_reference_only;
        const heading = r.after_heading ?? r.before_heading ?? "";
        return (
          <li key={r.id} className="list-none space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <AuthorBadge author={r.author} />
              <span>{KIND_TEXT[r.kind]}</span>
              {!sectionId && <span className="font-medium text-foreground/80">{heading}</span>}
              <span className="text-muted-foreground/50" title={new Date(r.created_at).toLocaleString()}>
                · {timeAgo(r.created_at)}
              </span>
            </div>
            {headingChanged && (
              <p className="text-[11px] text-muted-foreground">
                Heading: <span className="line-through text-destructive/80">{r.before_heading}</span> →{" "}
                <span className="text-success">{r.after_heading}</span>
              </p>
            )}
            {flagChanged && (
              <p className="text-[11px] text-muted-foreground">
                Reference only:{" "}
                <span className="line-through text-destructive/80">{r.before_reference_only ? "on" : "off"}</span> →{" "}
                <span className="text-success">{r.after_reference_only ? "on" : "off"}</span>
              </p>
            )}
            {r.kind === "edit" && (bodyChanged || (!headingChanged && !flagChanged)) && (
              <LineDiff before={r.before_body ?? ""} after={r.after_body ?? ""} />
            )}
            {r.kind === "create" && r.after_body?.trim() && (
              <LineDiff before="" after={r.after_body} />
            )}
            {r.kind === "delete" && r.before_body?.trim() && (
              <LineDiff before={r.before_body} after="" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
