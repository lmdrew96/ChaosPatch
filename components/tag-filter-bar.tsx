"use client";

import { useState } from "react";

const CHIP_BASE = "rounded-full px-2.5 py-0.5 text-xs transition-colors";
const CHIP_ACTIVE = "bg-primary/15 text-primary border border-primary/30";
const CHIP_INACTIVE =
  "bg-card text-muted-foreground border border-border hover:border-muted-foreground/40 hover:text-foreground/70";

/**
 * Collapsible tag filter row. The full tag list can get long, so it stays
 * collapsed by default behind a "Tags" toggle. Any active filters remain
 * visible even while collapsed, so the filter state is never hidden.
 */
export function TagFilterBar({
  tags,
  active,
  onToggle,
  onClear,
}: {
  tags: string[];
  active: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (tags.length === 0) return null;

  // Collapsed: surface only the active filters so the current filter is clear.
  const visibleTags = open ? tags : active;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors mr-1"
        aria-expanded={open}
      >
        Tags
        <span className="font-mono text-[10px] opacity-60">{tags.length}</span>
        <span
          className="text-[8px] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        >
          ▾
        </span>
      </button>

      {visibleTags.map((tag) => {
        const isActive = active.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`${CHIP_BASE} ${isActive ? CHIP_ACTIVE : CHIP_INACTIVE}`}
          >
            {tag}
          </button>
        );
      })}

      {active.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-muted-foreground/60 hover:text-foreground/70 ml-1 transition-colors"
        >
          clear
        </button>
      )}
    </div>
  );
}
