"use client";

import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  function retry() {
    // reset() alone only re-renders client components; refresh re-runs the
    // server queries that most likely failed.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-8 text-center">
      <div className="hud-panel w-full max-w-md rounded-lg border border-border bg-card/60 p-6 space-y-3">
        <h1 className="text-sm font-semibold text-foreground">
          Something went wrong loading this page.
        </h1>
        <p className="text-xs text-muted-foreground">
          The data couldn&apos;t load. Try again, or head back to the dashboard.
        </p>
        {error.digest && (
          <p className="text-[10px] font-mono text-muted-foreground/60">
            ref {error.digest}
          </p>
        )}
        <div className="flex justify-center gap-3 pt-1">
          <button
            onClick={retry}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/80 hover:border-muted-foreground/40 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
