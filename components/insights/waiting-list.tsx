import Link from "next/link";
import type { PatchWithProject } from "@/lib/queries";

const DAY_MS = 86_400_000;

type Waiting = {
  patch: PatchWithProject;
  // When it entered review; falls back to updated_at for rows reviewed before
  // reviewed_at existed.
  since: number;
  approximate: boolean;
};

type ProjectGroup = {
  slug: string;
  name: string;
  color: string;
  rows: Waiting[];
};

export const reviewSince = (p: PatchWithProject): Waiting => ({
  patch: p,
  since: new Date(p.reviewed_at ?? p.updated_at).getTime(),
  approximate: p.reviewed_at === null || p.reviewed_at === undefined,
});

export const daysSince = (since: number, now: number): number =>
  Math.max(0, Math.floor((now - since) / DAY_MS));

/**
 * "Waiting on you": every patch in review, grouped by project, oldest wait
 * first. Expects non-archived review patches only. Renders nothing when empty.
 */
export function WaitingList({ patches, now }: { patches: PatchWithProject[]; now: number }) {
  if (patches.length === 0) return null;

  const groups = new Map<string, ProjectGroup>();
  for (const p of patches) {
    const group = groups.get(p.project_slug) ?? {
      slug: p.project_slug,
      name: p.project_name,
      color: p.project_color,
      rows: [],
    };
    group.rows.push(reviewSince(p));
    groups.set(p.project_slug, group);
  }
  for (const g of groups.values()) g.rows.sort((a, b) => a.since - b.since);
  // Project with the longest wait first.
  const sorted = [...groups.values()].sort((a, b) => a.rows[0].since - b.rows[0].since);
  const anyApproximate = patches.some((p) => !p.reviewed_at);

  return (
    <div className="space-y-4">
      {sorted.map((g) => (
        <section key={g.slug}>
          <Link
            href={`/projects/${g.slug}`}
            className="mb-1.5 inline-flex items-center gap-2 text-sm font-medium text-foreground/90 hover:text-foreground"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: g.color }}
              aria-hidden
            />
            <span className="truncate">{g.name}</span>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
              {g.rows.length}
            </span>
          </Link>
          <ul className="space-y-1.5">
            {g.rows.map(({ patch, since, approximate }) => {
              const days = daysSince(since, now);
              const stepsDone = patch.review_steps.filter((s) => s.done).length;
              const stepsTotal = patch.review_steps.length;
              return (
                <li key={patch.id} className="list-none">
                  <Link
                    href={`/projects/${patch.project_slug}?patch=${patch.id}`}
                    className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 hover:border-muted-foreground/40 hover:bg-card transition-colors"
                  >
                    <span
                      className="text-sm text-foreground/90 truncate flex-1 min-w-0"
                      title={patch.title}
                    >
                      {patch.title}
                    </span>
                    {stepsTotal > 0 && (
                      <span
                        className="text-[10px] font-mono tabular-nums text-muted-foreground/60 shrink-0"
                        title={`${stepsDone} of ${stepsTotal} review steps checked`}
                      >
                        {stepsDone}/{stepsTotal}
                      </span>
                    )}
                    <span
                      className="text-[10px] uppercase tracking-wider text-muted-foreground/50 shrink-0 tabular-nums"
                      title={
                        approximate
                          ? "Approximate: this patch entered review before review times were tracked"
                          : undefined
                      }
                    >
                      {approximate ? "~" : ""}
                      {days}d
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {anyApproximate && (
        <p className="text-[10px] text-muted-foreground/40 font-mono">
          ~ approximate: entered review before review times were tracked
        </p>
      )}
    </div>
  );
}
