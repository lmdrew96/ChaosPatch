"use client";

export function StatCard({
  label,
  value,
  sub,
  accent,
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  delay?: number;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-card p-4 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2">
        {label}
      </p>
      <p
        className="text-2xl font-semibold font-mono tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">
          {sub}
        </p>
      )}
    </div>
  );
}
