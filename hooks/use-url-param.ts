"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * One piece of UI state (a filter, sort, or search) mirrored into the URL
 * query string, so it survives back-navigation and refresh and can be shared.
 *
 * Local state drives rendering (no cursor jumps in text inputs); each change
 * writes the URL with history.replaceState, which Next's app router syncs
 * without a server round-trip. The default value is dropped from the URL so
 * untouched pages keep a clean address. Values not in `allowed` fall back to
 * the default.
 */
export const useUrlParam = <T extends string>(
  key: string,
  fallback: T,
  allowed?: readonly T[]
): [T, (next: T) => void] => {
  const searchParams = useSearchParams();
  const [value, setValue] = useState<T>(() => {
    const raw = searchParams.get(key);
    if (raw === null) return fallback;
    if (allowed && !allowed.includes(raw as T)) return fallback;
    return raw as T;
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      // Read the live URL (not the render-time searchParams) so back-to-back
      // updates to different keys don't clobber each other.
      const params = new URLSearchParams(window.location.search);
      if (next === fallback) params.delete(key);
      else params.set(key, next);
      const qs = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}`
      );
    },
    [key, fallback]
  );

  return [value, update];
};
