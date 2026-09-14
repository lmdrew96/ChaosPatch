import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-8 text-center">
      <div className="hud-panel w-full max-w-md rounded-lg border border-border bg-card/60 p-6 space-y-3">
        <p className="font-mono text-xs tracking-[0.35em] uppercase text-muted-foreground">
          // 404
        </p>
        <h1 className="text-sm font-semibold text-foreground">Page not found</h1>
        <p className="text-xs text-muted-foreground">
          This page or project doesn&apos;t exist. If a project was renamed, its
          old link stops working — find it from the dashboard.
        </p>
        <div className="pt-1">
          <Link
            href="/dashboard"
            className="inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
