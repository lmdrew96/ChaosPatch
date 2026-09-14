import type { Patch } from "@/lib/queries";

// Shared text search for patch lists. Matches title, notes, and tags
// (case-insensitive), plus a pasted patch ID or its prefix — agents cite
// patches by UUID. ID matching needs 4+ chars so short text queries don't
// hit random ID prefixes.
export const matchesPatchSearch = (
  patch: Pick<Patch, "id" | "title" | "notes" | "tags">,
  query: string
): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (q.length >= 4 && patch.id.toLowerCase().startsWith(q)) ||
    patch.title.toLowerCase().includes(q) ||
    (patch.notes?.toLowerCase().includes(q) ?? false) ||
    patch.tags.some((t) => t.toLowerCase().includes(q))
  );
};
