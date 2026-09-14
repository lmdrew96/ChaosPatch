const block = "animate-pulse rounded-md bg-muted/60";

// Skeleton mirroring the dashboard layout: summary cards, view toggle, project grid.
export default function DashboardLoading() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center px-4 pt-20 pb-8 gap-6 sm:px-8 sm:pt-24"
    >
      <span className="sr-only">Loading dashboard…</span>
      <div aria-hidden className="flex w-full max-w-5xl justify-end">
        <div className={`${block} h-8 w-28`} />
      </div>
      <div aria-hidden className="w-full max-w-5xl space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="hud-panel rounded-lg border border-border bg-card/60 p-4 space-y-2 md:col-span-2">
            <div className={`${block} h-4 w-32`} />
            <div className={`${block} h-9 w-full`} />
            <div className={`${block} h-9 w-full`} />
          </div>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="hud-panel rounded-lg border border-border bg-card/60 p-4 space-y-2"
            >
              <div className={`${block} h-4 w-28`} />
              <div className={`${block} h-9 w-full`} />
              <div className={`${block} h-9 w-full`} />
            </div>
          ))}
        </div>
        <div className={`${block} h-8 w-44`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className={`${block} h-16`} />
          ))}
        </div>
      </div>
    </main>
  );
}
