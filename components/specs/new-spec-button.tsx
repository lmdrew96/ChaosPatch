"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const FIELD =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm [@media(pointer:coarse)]:text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * "+ New spec": asks for a title, creates the spec from the default section
 * template, and opens the editor. With projectSlug it's a feature spec
 * already linked to that project; without, a draft.
 */
export function NewSpecButton({
  projectSlug,
  className,
}: {
  projectSlug?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    setTitle("");
    setError("");
    setOpen(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/specs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), project_slug: projectSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.push(`/specs/${data.id}`);
    } catch (err) {
      console.error("Failed to create spec", err);
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          className ??
          "rounded-md border border-border bg-card hover:bg-muted px-3 py-1.5 text-sm font-medium text-foreground transition-colors"
        }
      >
        + New spec
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-foreground mb-1">New spec</h2>
            <p className="text-xs text-muted-foreground/70 mb-4">
              {projectSlug
                ? "A feature spec for this project. You can make it the primary spec later."
                : "No project needed. You can create or attach one later."}{" "}
              It starts with the default sections; add, remove, or reorder them as you go.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-spec-title" className="block text-xs text-muted-foreground mb-1">
                  Title
                </label>
                <input
                  id="new-spec-title"
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What are you building?"
                  className={FIELD}
                />
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
                  disabled={loading || !title.trim()}
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
