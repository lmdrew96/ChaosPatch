"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PRESET_COLORS } from "@/lib/colors";

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  function handleOpen() {
    setName("");
    setSlug("");
    setColor(PRESET_COLORS[0]);
    setSlugTouched(false);
    setError("");
    setOpen(true);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function handleNameChange(val: string) {
    setName(val);
    if (!slugTouched) setSlug(toSlug(val));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), color }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-md bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors"
      >
        + New project
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-foreground mb-4">
              New project
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Name
                </label>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="My Project"
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Slug
                </label>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  placeholder="my-project"
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-2">
                  Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
                      style={{
                        backgroundColor: c,
                        boxShadow:
                          color === c ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
              {error && <p className="text-xs text-rose-400">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground/90 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim() || !slug.trim()}
                  className="rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors"
                >
                  {loading ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
