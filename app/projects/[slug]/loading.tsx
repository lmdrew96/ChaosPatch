const block = "animate-pulse rounded-md bg-muted/60";

// Skeleton mirroring the project page: breadcrumb header, filter chips, patch rows.
export default function ProjectLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-background text-foreground pt-16"
    >
      <span className="sr-only">Loading project…</span>
      <header aria-hidden className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className={`${block} h-5 w-48`} />
          <div className={`${block} h-8 w-24`} />
        </div>
      </header>
      <main aria-hidden className="px-6 py-8 max-w-3xl mx-auto space-y-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${block} h-6 w-16 rounded-full`} />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${block} h-14 w-full rounded-lg`} />
          ))}
        </div>
      </main>
    </div>
  );
}
