import Link from "next/link";
import { PartyPopper } from "lucide-react";
import type { PatchWithProject } from "@/lib/queries";

const TITLES_SHOWN = 5;

type ProjectGroup = {
  slug: string;
  name: string;
  color: string;
  patches: PatchWithProject[];
};

/**
 * "Shipped this week": the last 7 days of completed patches, grouped by
 * project. Deliberately calm — just what got done, no streaks or comparisons.
 * Renders nothing when the week is empty so the backlog leads instead.
 */
export function ShippedWall({ patches }: { patches: PatchWithProject[] }) {
  if (patches.length === 0) return null;

  const groups = new Map<string, ProjectGroup>();
  for (const p of patches) {
    const group = groups.get(p.project_slug) ?? {
      slug: p.project_slug,
      name: p.project_name,
      color: p.project_color,
      patches: [],
    };
    group.patches.push(p);
    groups.set(p.project_slug, group);
  }
  const sorted = [...groups.values()].sort(
    (a, b) => b.patches.length - a.patches.length || a.name.localeCompare(b.name)
  );

  return (
    <section className="hud-panel rounded-lg border border-border bg-card/60 backdrop-blur p-4 animate-fade-in">
      <div className="mb-4 flex items-baseline gap-2">
        <PartyPopper aria-hidden className="h-4 w-4 shrink-0 self-center text-success" />
        <h2 className="text-sm font-medium text-foreground/90">Shipped this week</h2>
        <span className="text-xs text-muted-foreground/70">
          {patches.length} {patches.length === 1 ? "patch" : "patches"} across{" "}
          {sorted.length} {sorted.length === 1 ? "project" : "projects"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((g) => (
          <div key={g.slug} className="min-w-0">
            <Link
              href={`/projects/${g.slug}`}
              className="mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground/90 hover:text-foreground"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: g.color }}
                aria-hidden
              />
              <span className="truncate">{g.name}</span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                {g.patches.length}
              </span>
            </Link>
            <TitleList slug={g.slug} patches={g.patches.slice(0, TITLES_SHOWN)} />
            {g.patches.length > TITLES_SHOWN && (
              <details className="group">
                <summary className="cursor-pointer list-none pl-4 text-[11px] text-muted-foreground/60 hover:text-muted-foreground group-open:hidden">
                  +{g.patches.length - TITLES_SHOWN} more
                </summary>
                <TitleList slug={g.slug} patches={g.patches.slice(TITLES_SHOWN)} />
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function TitleList({ slug, patches }: { slug: string; patches: PatchWithProject[] }) {
  return (
    <ul className="space-y-0.5">
      {patches.map((p) => (
        <li key={p.id} className="list-none pl-4">
          <Link
            href={`/projects/${slug}?patch=${p.id}`}
            className="block truncate text-xs text-muted-foreground hover:text-foreground"
            title={p.title}
          >
            {p.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
