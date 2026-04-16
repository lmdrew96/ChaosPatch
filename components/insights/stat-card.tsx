"use client";

export function StatCard({
  label,
  value,
  sub,
  accent,
  glow,
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  glow?: string;
  delay?: number;
}) {
  return (
    <div
      className="relative rounded-lg border border-border bg-card p-4 overflow-hidden animate-fade-in"
      style={{
        animationDelay: `${delay}ms`,
        borderLeftWidth: 3,
        borderLeftColor: accent,
      }}
    >
      {/* Subtle accent wash */}
      {accent && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: accent, opacity: 0.04 }}
        />
      )}
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 mb-2 relative">
        {label}
      </p>
      <p
        className="text-3xl font-bold font-mono tabular-nums tracking-tight relative"
        style={{
          color: accent,
          textShadow: glow ? `0 0 20px ${glow}` : undefined,
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-muted-foreground/40 mt-1.5 font-mono relative">
          {sub}
        </p>
      )}
    </div>
  );
}
