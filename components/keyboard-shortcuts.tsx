"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const NEW_PROJECT_EVENT = "chaospatch:new-project";
export const SHORTCUTS_HELP_EVENT = "chaospatch:shortcuts-help";
// Fired by "/" when the current view has no search input mounted yet
// (e.g. the dashboard's Projects view) so the page can reveal one.
export const FOCUS_SEARCH_EVENT = "chaospatch:focus-search";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["⌘/Ctrl", "N"], label: "Add a patch" },
  { keys: ["⌘/Ctrl", "P"], label: "New project (dashboard)" },
  { keys: ["/"], label: "Focus search" },
  { keys: ["?"], label: "Show shortcuts" },
  { keys: ["Esc"], label: "Close this panel" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      if (e.metaKey || e.ctrlKey) {
        if (e.altKey || e.shiftKey) return;
        const key = e.key.toLowerCase();
        if (key === "n") {
          e.preventDefault();
          router.push("/add");
        } else if (key === "p") {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent(NEW_PROJECT_EVENT));
        }
        return;
      }
      if (e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((open) => !open);
      } else if (e.key === "/") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("[data-search-input]");
        if (input) input.focus();
        else window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    }

    function onOpenHelp() {
      setHelpOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(SHORTCUTS_HELP_EVENT, onOpenHelp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(SHORTCUTS_HELP_EVENT, onOpenHelp);
    };
  }, [router]);

  if (!helpOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm px-4"
      onClick={() => setHelpOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        className="hud-panel w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-sm font-semibold text-foreground">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            autoFocus
            onClick={() => setHelpOpen(false)}
            aria-label="Close keyboard shortcuts"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Esc
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-input px-1.5 py-0.5 font-mono text-[10px] text-foreground/80"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
