import type { DashboardSummaryData } from "@/lib/queries";
import { PatchListItem } from "./patch-list-item";

export function DashboardSummary({
  data,
}: {
  data: DashboardSummaryData;
}) {
  const { inProgress, recentlyCompleted, recentlyAdded, counts } = data;

  if (
    counts.open === 0 &&
    counts.inProgress === 0 &&
    recentlyCompleted.length === 0 &&
    recentlyAdded.length === 0
  ) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
      <Card className="md:col-span-2">
        <CardHeader
          icon="⚡"
          title="In Progress"
          count={counts.inProgress}
          right={
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
              <span aria-hidden>🎯 </span>Open:{" "}
              <span className="font-mono text-muted-foreground tabular-nums">
                {counts.open}
              </span>
            </span>
          }
        />
        {inProgress.length === 0 ? (
          <EmptyMessage>
            Nothing in progress. Pick one from the list below ↓
          </EmptyMessage>
        ) : (
          <ul className="space-y-1.5">
            {inProgress.map((p) => (
              <PatchListItem key={p.id} patch={p} timestamp={p.started_at} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          icon="✅"
          title="Recently Done"
          count={recentlyCompleted.length}
        />
        {recentlyCompleted.length === 0 ? (
          <EmptyMessage>No patches shipped in the last 14 days.</EmptyMessage>
        ) : (
          <ul className="space-y-1.5">
            {recentlyCompleted.map((p) => (
              <PatchListItem key={p.id} patch={p} timestamp={p.completed_at} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          icon="✨"
          title="Recently Added"
          count={recentlyAdded.length}
        />
        {recentlyAdded.length === 0 ? (
          <EmptyMessage>No new patches in the last 7 days.</EmptyMessage>
        ) : (
          <ul className="space-y-1.5">
            {recentlyAdded.map((p) => (
              <PatchListItem key={p.id} patch={p} timestamp={p.created_at} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-card/60 backdrop-blur p-4 ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  title,
  count,
  right,
}: {
  icon: string;
  title: string;
  count: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2">
      <div className="flex items-baseline gap-2 min-w-0">
        <span aria-hidden className="shrink-0">
          {icon}
        </span>
        <span className="text-sm font-medium text-foreground/90 truncate">
          {title}
        </span>
        {count > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums shrink-0">
            ({count})
          </span>
        )}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground/50 py-2">{children}</p>;
}
