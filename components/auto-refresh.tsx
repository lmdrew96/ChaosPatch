"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { STALE_CHANGED_EVENT } from "@/components/dashboard/stale-card";

// Pages are server-rendered, so changes made elsewhere (MCP tools, another
// device or tab) only appeared after a manual reload. This re-fetches the
// current route's server data when the tab comes back into view and on a
// steady interval while it's visible. router.refresh() keeps client state
// (filters, expanded rows, open editors), so it's safe to run in the background.
const POLL_MS = 30_000;
// Focus and visibilitychange often fire together; collapse them into one refresh.
const MIN_GAP_MS = 5_000;

export const AutoRefresh = (): null => {
  const router = useRouter();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) return;

    let last = Date.now();
    const refresh = (): void => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      router.refresh();
      window.dispatchEvent(new Event(STALE_CHANGED_EVENT));
    };

    const interval = window.setInterval(refresh, POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [isSignedIn, router]);

  return null;
};
