import Link from "next/link";
import type { PatchWithProject } from "@/lib/queries";

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  const days = Math.floor(diff / day);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function PatchListItem({
  patch,
  timestamp,
}: {
  patch: PatchWithProject;
  timestamp: string | null;
}) {
  return (
    <li className="list-none">
      <Link
        href={`/projects/${patch.project_slug}`}
        className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 hover:border-muted-foreground/40 hover:bg-card transition-colors"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: patch.project_color }}
          aria-hidden
        />
        <span
          className="text-sm text-foreground/90 truncate flex-1 min-w-0"
          title={patch.title}
        >
          {patch.title}
        </span>
        {patch.priority === "high" && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-red-400 bg-red-950/40 border border-red-900 rounded px-1.5 py-0.5 shrink-0">
            High
          </span>
        )}
        <span
          className="text-[10px] font-mono text-muted-foreground/60 shrink-0 hidden sm:inline max-w-[120px] truncate"
          title={patch.project_name}
        >
          {patch.project_slug}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 shrink-0 tabular-nums">
          {timeAgo(timestamp)}
        </span>
      </Link>
    </li>
  );
}
