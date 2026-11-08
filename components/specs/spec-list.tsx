import Link from "next/link";
import { FileText, Star } from "lucide-react";
import type { SpecAuthor, SpecListRow } from "@/lib/specs";
import { timeAgo } from "@/components/dashboard/patch-list-item";

export const AUTHOR_LABELS: Record<SpecAuthor, string> = {
  nae: "Nae",
  coru: "Coru",
  cody: "Cody",
  app: "App",
};

type SpecGroup = { key: string; name: string; slug: string | null; specs: SpecListRow[] };

/**
 * Specs grouped by project (groups A→Z, primary spec first inside each),
 * with unlinked drafts in their own group at the end.
 */
export function groupSpecs(specs: SpecListRow[]): SpecGroup[] {
  const groups = new Map<string, SpecGroup>();
  for (const s of specs) {
    const key = s.project_slug ?? "__drafts";
    const group = groups.get(key) ?? {
      key,
      name: s.project_name ?? "Drafts",
      slug: s.project_slug,
      specs: [],
    };
    group.specs.push(s);
    groups.set(key, group);
  }
  for (const g of groups.values()) {
    g.specs.sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        b.updated_at.localeCompare(a.updated_at)
    );
  }
  return [...groups.values()].sort((a, b) => {
    if (a.slug === null) return 1;
    if (b.slug === null) return -1;
    return a.name.localeCompare(b.name);
  });
}

export function SpecRow({ spec }: { spec: SpecListRow }) {
  return (
    <li className="list-none">
      <Link
        href={`/specs/${spec.id}`}
        className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 hover:border-muted-foreground/40 hover:bg-card transition-colors"
      >
        <FileText aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className="text-sm text-foreground/90 truncate flex-1 min-w-0" title={spec.title}>
          {spec.title}
        </span>
        {spec.is_primary && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/30 rounded px-1.5 py-0.5 shrink-0">
            <Star aria-hidden className="h-2.5 w-2.5" />
            Primary
          </span>
        )}
        <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0 tabular-nums">
          {spec.section_count} §
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 shrink-0 tabular-nums hidden sm:inline">
          {timeAgo(spec.updated_at)}
        </span>
      </Link>
    </li>
  );
}

export function SpecGroups({ specs }: { specs: SpecListRow[] }) {
  if (specs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground/70 text-sm">No specs yet.</p>
        <p className="text-muted-foreground/50 text-xs mt-1">
          Start one with <strong className="text-muted-foreground">+ New spec</strong> above. It
          doesn&apos;t need a project.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {groupSpecs(specs).map((g) => (
        <section key={g.key} aria-label={g.name}>
          <h3 className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/70">
            {g.slug ? (
              <Link href={`/projects/${g.slug}`} className="hover:text-foreground transition-colors">
                {g.name}
              </Link>
            ) : (
              "Drafts (no project yet)"
            )}
            <span className="ml-1.5 font-mono">({g.specs.length})</span>
          </h3>
          <ul className="space-y-1.5">
            {g.specs.map((s) => (
              <SpecRow key={s.id} spec={s} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
