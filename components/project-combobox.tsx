"use client";

import { useId, useRef, useState } from "react";
import type { Project } from "@/lib/queries";

/**
 * Keyboard-first project picker: focus it and type to filter by name or slug,
 * ↑/↓ to move, Enter to pick, Esc to back out. Projects render in the order
 * given (the Add Patch page passes them most-recently-used first).
 */
export function ProjectCombobox({
  projects,
  value,
  onChange,
}: {
  projects: Project[];
  value: string;
  onChange: (slug: string) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // null = not searching; the input shows the selected project's name.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const selected = projects.find((p) => p.slug === value);
  const q = query?.trim().toLowerCase() ?? "";
  const matches = q
    ? projects.filter(
        (p) => p.name.toLowerCase().includes(q) || p.slug.includes(q)
      )
    : projects;
  const open = query !== null;

  function pick(project: Project) {
    onChange(project.slug);
    setQuery(null);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setQuery("");
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Never submit the form from the picker.
      e.preventDefault();
      if (open && matches[active]) pick(matches[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setQuery(null);
    }
  }

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: open ? "transparent" : selected?.color ?? "transparent" }}
        aria-hidden
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        value={query ?? selected?.name ?? ""}
        placeholder="Search projects…"
        onFocus={(e) => {
          setQuery("");
          setActive(0);
          e.currentTarget.select();
        }}
        onBlur={() => setQuery(null)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        className="w-full rounded-md border border-border bg-card py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3 py-1.5 text-sm text-muted-foreground/60">
              No matching projects
            </li>
          )}
          {matches.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={p.slug === value}
              // Prevent input blur so the pick lands before the list closes.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                i === active ? "bg-muted/60 text-foreground" : "text-muted-foreground"
              }`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
                aria-hidden
              />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground/50">
                {p.slug}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
