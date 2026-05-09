import type { Patch } from "@/lib/queries";

export const PRIORITY_STYLES: Record<Patch["priority"], string> = {
  high: "text-red-700 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-900",
  medium: "text-yellow-700 bg-yellow-100 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/40 dark:border-yellow-900",
  low: "text-muted-foreground bg-muted/60 border-border",
};
