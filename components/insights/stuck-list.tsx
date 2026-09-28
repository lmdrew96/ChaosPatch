import type { PatchWithProject } from "@/lib/queries";
import { PatchListItem } from "@/components/dashboard/patch-list-item";

const STUCK_AFTER_MS = 7 * 86_400_000;
const MAX_ROWS = 5;

// Patches that need a decision: started but not finished after a week, and the
// oldest open high/medium work. Expects active (non-archived) patches only.
export function StuckList({ patches }: { patches: PatchWithProject[] }) {
  const cutoff = Date.now() - STUCK_AFTER_MS;
  const age = (iso: string | null) => (iso ? new Date(iso).getTime() : Infinity);

  const stalled = patches
    .filter((p) => p.status === "in_progress" && age(p.started_at) < cutoff)
    .sort((a, b) => age(a.started_at) - age(b.started_at))
    .slice(0, MAX_ROWS);

  const oldest = patches
    .filter((p) => p.status === "open" && p.priority !== "low" && age(p.created_at) < cutoff)
    .sort((a, b) => age(a.created_at) - age(b.created_at))
    .slice(0, MAX_ROWS);

  if (stalled.length === 0 && oldest.length === 0) {
    return (
      <div className="flex items-center justify-center h-[80px] text-xs text-muted-foreground/50">
        Nothing stuck — no active patch is older than a week
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stalled.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-muted-foreground/50 mb-2">
            In progress for 7+ days · started
          </h3>
          <ul className="space-y-1.5">
            {stalled.map((p) => (
              <PatchListItem key={p.id} patch={p} timestamp={p.started_at} />
            ))}
          </ul>
        </section>
      )}
      {oldest.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-muted-foreground/50 mb-2">
            Oldest open high/medium · created
          </h3>
          <ul className="space-y-1.5">
            {oldest.map((p) => (
              <PatchListItem key={p.id} patch={p} timestamp={p.created_at} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
