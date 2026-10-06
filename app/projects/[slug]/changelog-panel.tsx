"use client";

import { useState } from "react";
import { Check, Copy, ScrollText } from "lucide-react";
import { Markdown } from "@/components/markdown";

/** YYYY-MM-DD for a Date in the viewer's local timezone. */
const localDateKey = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Local midnight at the start of a YYYY-MM-DD day, plus `addDays`. */
const localMidnight = (key: string, addDays = 0): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d + addDays);
};

const formatLabel = (key: string): string =>
  localMidnight(key).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const inputClass =
  "rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * Turn the project's completed patches into release notes. Defaults to
 * everything since the last generated changelog (or since the project began).
 */
export function ChangelogPanel({
  slug,
  createdAt,
  lastChangelogAt,
}: {
  slug: string;
  createdAt: string;
  lastChangelogAt: string | null;
}) {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  // Untouched "from" with a saved changelog means "exactly where it left off".
  const [fromTouched, setFromTouched] = useState(false);
  const [last, setLast] = useState(lastChangelogAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ markdown: string | null; count: number } | null>(null);
  const [copied, setCopied] = useState(false);

  function open() {
    setRange({
      from: localDateKey(new Date(last ?? createdAt)),
      to: localDateKey(new Date()),
    });
    setFromTouched(false);
  }

  async function generate() {
    if (!range) return;
    setBusy(true);
    setError("");
    setResult(null);
    setCopied(false);
    try {
      const since =
        !fromTouched && last ? last : localMidnight(range.from).toISOString();
      const res = await fetch(`/api/projects/${slug}/changelog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          since,
          until: localMidnight(range.to, 1).toISOString(),
          from_label: formatLabel(range.from),
          to_label: formatLabel(range.to),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setResult({ markdown: data.markdown, count: data.count });
      if (data.last_changelog_at) setLast(data.last_changelog_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result?.markdown) return;
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
    } catch (err) {
      console.error("Clipboard write failed", err);
      setError("Couldn't copy — select the text instead.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Changelog
        </h3>
        {last && (
          <span className="text-[10px] text-muted-foreground/60">
            Last generated through {new Date(last).toLocaleDateString()}
          </span>
        )}
      </div>

      {!range ? (
        <button
          onClick={open}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors"
        >
          <ScrollText aria-hidden className="h-3.5 w-3.5" />
          Generate changelog
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            From
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => {
                setRange({ ...range, from: e.target.value });
                setFromTouched(true);
              }}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-1.5">
            to
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              className={inputClass}
            />
          </label>
          <button
            onClick={generate}
            disabled={busy || !range.from || !range.to}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {busy ? "Writing…" : "Generate"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && result.markdown === null && (
        <p className="text-xs text-muted-foreground/70">
          No patches were completed in that range.
        </p>
      )}

      {result?.markdown && (
        <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground/60">
              From {result.count} completed {result.count === 1 ? "patch" : "patches"}
            </span>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors"
            >
              {copied ? (
                <Check aria-hidden className="h-3 w-3 text-success" />
              ) : (
                <Copy aria-hidden className="h-3 w-3" />
              )}
              {copied ? "Copied" : "Copy Markdown"}
            </button>
          </div>
          <Markdown className="text-sm text-foreground/90">{result.markdown}</Markdown>
        </div>
      )}
    </div>
  );
}
