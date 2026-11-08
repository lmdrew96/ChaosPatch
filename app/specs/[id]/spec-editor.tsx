"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, Pencil, Star, Trash2 } from "lucide-react";
import type { SpecDetail, SpecSection, SpecSectionWithPatches } from "@/lib/specs";
import { Markdown } from "@/components/markdown";
import { AUTHOR_LABELS } from "@/components/specs/spec-list";
import { timeAgo } from "@/components/dashboard/patch-list-item";
import { PRESET_COLORS } from "@/lib/colors";

const FIELD =
  "rounded-md border border-border bg-input px-3 py-2 text-sm [@media(pointer:coarse)]:text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring";
const SMALL_BTN =
  "inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors disabled:opacity-50";

const AUTOSAVE_MS = 1000;

const toSlug = (name: string): string =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function send(url: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

// ── Editor ─────────────────────────────────────────────────────────────────

export function SpecEditor({
  initialSpec,
  projects,
}: {
  initialSpec: SpecDetail;
  projects: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [spec, setSpec] = useState(initialSpec);
  const [title, setTitle] = useState(initialSpec.title);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Spec-level actions all answer with the full spec.
  const specAction = async (body: unknown): Promise<boolean> => {
    setBusy(true);
    setError("");
    try {
      const next = (await send(`/api/specs/${spec.id}`, "PATCH", body)) as SpecDetail;
      setSpec(next);
      router.refresh();
      return true;
    } catch (err) {
      console.error("Spec update failed", err);
      setError(err instanceof Error ? err.message : "Couldn't save that.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveTitle = async () => {
    const next = title.trim();
    if (!next) {
      setTitle(spec.title);
      return;
    }
    if (next !== spec.title) await specAction({ title: next });
  };

  const onSectionSaved = useCallback((saved: SpecSection) => {
    setSpec((s) => ({
      ...s,
      sections: s.sections.map((x) => (x.id === saved.id ? { ...x, ...saved } : x)),
    }));
  }, []);

  const move = async (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= spec.sections.length) return;
    const previous = spec.sections;
    const reordered = [...previous];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSpec((s) => ({ ...s, sections: reordered })); // optimistic
    const ok = await specAction({ reorder: reordered.map((x) => x.id) });
    if (!ok) setSpec((s) => ({ ...s, sections: previous }));
  };

  const removeSection = async (sectionId: string) => {
    setError("");
    try {
      await send(`/api/spec-sections/${sectionId}`, "DELETE");
      setSpec((s) => ({ ...s, sections: s.sections.filter((x) => x.id !== sectionId) }));
    } catch (err) {
      console.error("Section delete failed", err);
      setError(err instanceof Error ? err.message : "Couldn't remove that section.");
    }
  };

  const addSection = async (heading: string): Promise<boolean> => {
    setError("");
    try {
      const section = (await send(`/api/specs/${spec.id}/sections`, "POST", {
        heading,
        body: "",
      })) as SpecSection;
      setSpec((s) => ({ ...s, sections: [...s.sections, { ...section, patches: [] }] }));
      return true;
    } catch (err) {
      console.error("Section add failed", err);
      setError(err instanceof Error ? err.message : "Couldn't add that section.");
      return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title + link status */}
      <div className="space-y-3">
        <label htmlFor="spec-title" className="sr-only">
          Spec title
        </label>
        <input
          id="spec-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="w-full bg-transparent text-xl font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 -mx-1"
        />
        <LinkPanel spec={spec} projects={projects} busy={busy} onAction={specAction} />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* Sections */}
      <ol className="space-y-3">
        {spec.sections.map((section, i) => (
          <SectionCard
            key={section.id}
            section={section}
            projectSlug={spec.project_slug}
            isFirst={i === 0}
            isLast={i === spec.sections.length - 1}
            busy={busy}
            onMove={(delta) => move(i, delta)}
            onDelete={() => removeSection(section.id)}
            onSaved={onSectionSaved}
          />
        ))}
      </ol>

      <AddSectionForm onAdd={addSection} />

      <DeleteSpec specId={spec.id} hasProject={spec.project_slug} />
    </div>
  );
}

// ── Project link panel ─────────────────────────────────────────────────────

function LinkPanel({
  spec,
  projects,
  busy,
  onAction,
}: {
  spec: SpecDetail;
  projects: { slug: string; name: string }[];
  busy: boolean;
  onAction: (body: unknown) => Promise<boolean>;
}) {
  const [attachSlug, setAttachSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(spec.title);
  const [slug, setSlug] = useState(toSlug(spec.title));
  const [slugTouched, setSlugTouched] = useState(false);

  if (spec.project_slug) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Linked to{" "}
          <Link href={`/projects/${spec.project_slug}`} className="text-foreground underline underline-offset-2">
            {spec.project_name}
          </Link>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction({ is_primary: !spec.is_primary })}
          aria-pressed={spec.is_primary}
          title={
            spec.is_primary
              ? "This is the project's big-picture spec. Click to unmark it."
              : "Make this the project's big-picture spec (replaces the current primary)."
          }
          className={`${SMALL_BTN} ${spec.is_primary ? "text-primary border-primary/40 bg-primary/10" : ""}`}
        >
          <Star aria-hidden className={`h-3 w-3 ${spec.is_primary ? "fill-current" : ""}`} />
          {spec.is_primary ? "Primary spec" : "Make primary"}
        </button>
        <button type="button" disabled={busy} onClick={() => onAction({ detach: true })} className={SMALL_BTN}>
          Detach
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="uppercase tracking-wider text-[10px] border border-border rounded px-1.5 py-0.5">
          Draft
        </span>
        <span>No project yet.</span>
        <button type="button" disabled={busy} onClick={() => setCreating((c) => !c)} className={SMALL_BTN}>
          Create project from spec
        </button>
        {projects.length > 0 && (
          <span className="flex items-center gap-1.5">
            <label htmlFor="attach-project" className="sr-only">
              Attach to project
            </label>
            <select
              id="attach-project"
              value={attachSlug}
              onChange={(e) => setAttachSlug(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs [@media(pointer:coarse)]:text-base text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Attach to project…</option>
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !attachSlug}
              onClick={() => onAction({ attach: attachSlug })}
              className={SMALL_BTN}
            >
              Attach
            </button>
          </span>
        )}
      </div>
      {creating && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await onAction({
              create_project: { name: name.trim(), slug: slug.trim(), color: PRESET_COLORS[0] },
            });
            if (ok) setCreating(false);
          }}
          className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card/60 p-3"
        >
          <div className="flex-1 min-w-[10rem]">
            <label htmlFor="new-project-name" className="block text-[10px] text-muted-foreground mb-1">
              Project name
            </label>
            <input
              id="new-project-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(toSlug(e.target.value));
              }}
              className={`${FIELD} w-full`}
            />
          </div>
          <div className="flex-1 min-w-[8rem]">
            <label htmlFor="new-project-slug" className="block text-[10px] text-muted-foreground mb-1">
              Slug
            </label>
            <input
              id="new-project-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className={`${FIELD} w-full font-mono`}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !name.trim() || !slug.trim()}
            className="rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 px-3 py-2 text-sm font-medium text-primary-foreground transition-colors"
          >
            Create &amp; link
          </button>
          <p className="basis-full text-[10px] text-muted-foreground/60">
            Creates the project and links this as its primary spec. No patches are generated.
          </p>
        </form>
      )}
    </div>
  );
}

// ── Section card (autosaving) ──────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

function SectionCard({
  section,
  projectSlug,
  isFirst,
  isLast,
  busy,
  onMove,
  onDelete,
  onSaved,
}: {
  section: SpecSectionWithPatches;
  projectSlug: string | null;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
  onSaved: (s: SpecSection) => void;
}) {
  const [heading, setHeading] = useState(section.heading);
  const [body, setBody] = useState(section.body);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Refs so the debounced save and the unmount flush see current values.
  const draft = useRef({ heading: section.heading, body: section.body });
  const saved = useRef({ heading: section.heading, body: section.body });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (keepalive = false) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const { heading: h, body: b } = draft.current;
      if (h === saved.current.heading && b === saved.current.body) return;
      if (!h.trim()) {
        setSaveState("error");
        setSaveError("Heading can't be empty.");
        return;
      }
      setSaveState("saving");
      setSaveError("");
      try {
        const res = await fetch(`/api/spec-sections/${section.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ heading: h, body: b }),
          keepalive,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        saved.current = { heading: h, body: b };
        setSaveState("saved");
        onSaved(data as SpecSection);
      } catch (err) {
        console.error("Section autosave failed", err);
        setSaveState("error");
        setSaveError(err instanceof Error ? err.message : "Couldn't save.");
      }
    },
    [section.id, onSaved]
  );

  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  };

  // Leaving the page mid-edit still saves.
  useEffect(() => () => void save(true), [save]);

  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const lineCount = body.split("\n").length;

  return (
    <li className="list-none rounded-lg border border-border bg-card/60 p-4">
      <div className="flex items-start gap-2">
        <label htmlFor={`heading-${section.id}`} className="sr-only">
          Section heading
        </label>
        <input
          id={`heading-${section.id}`}
          value={heading}
          onChange={(e) => {
            setHeading(e.target.value);
            draft.current.heading = e.target.value;
            schedule();
          }}
          onBlur={() => void save()}
          className="flex-1 min-w-0 bg-transparent text-sm [@media(pointer:coarse)]:text-base font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 -mx-1"
        />
        <div className="flex shrink-0 items-center gap-1">
          <IconBtn label="Move up" disabled={isFirst || busy} onClick={() => onMove(-1)}>
            <ArrowUp className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Move down" disabled={isLast || busy} onClick={() => onMove(1)}>
            <ArrowDown className="h-3.5 w-3.5" />
          </IconBtn>
          {confirmDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1 text-[11px] text-destructive"
            >
              Remove?
            </button>
          ) : (
            <IconBtn label={`Remove section "${heading}"`} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          )}
        </div>
      </div>

      <div className="mt-2">
        {editing ? (
          <>
            <label htmlFor={`body-${section.id}`} className="sr-only">
              {heading} (markdown)
            </label>
            <textarea
              id={`body-${section.id}`}
              autoFocus
              value={body}
              rows={Math.max(4, lineCount + 1)}
              onChange={(e) => {
                setBody(e.target.value);
                draft.current.body = e.target.value;
                schedule();
              }}
              onBlur={() => {
                void save();
                setEditing(false);
              }}
              onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
              placeholder="Markdown welcome."
              className={`${FIELD} w-full font-mono leading-relaxed`}
            />
          </>
        ) : body.trim() ? (
          <div className="group relative">
            <Markdown className="text-sm text-foreground/85">{body}</Markdown>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={`${SMALL_BTN} mt-2`}
            >
              <Pencil aria-hidden className="h-3 w-3" />
              Edit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-md border border-dashed border-border px-3 py-3 text-left text-xs text-muted-foreground/60 hover:text-foreground/80 hover:border-muted-foreground/40 transition-colors"
          >
            Empty. Click to write.
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground/60">
        {section.last_author && (
          <span>
            {AUTHOR_LABELS[section.last_author]} · {timeAgo(section.last_edited_at)}
          </span>
        )}
        <span aria-live="polite" className={saveState === "error" ? "text-destructive" : ""}>
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && saveError}
        </span>
      </div>

      {section.patches.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">
            Patches from this section ({section.patches.length})
          </p>
          <ul className="space-y-0.5">
            {section.patches.map((p) => (
              <li key={p.id} className="list-none text-xs">
                {projectSlug ? (
                  <Link
                    href={`/projects/${projectSlug}?patch=${p.id}`}
                    className="text-foreground/80 hover:text-foreground underline-offset-2 hover:underline"
                  >
                    {p.title}
                  </Link>
                ) : (
                  <span className="text-foreground/80">{p.title}</span>
                )}
                <span className="ml-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  {p.status.replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// ── Add section ────────────────────────────────────────────────────────────

function AddSectionForm({ onAdd }: { onAdd: (heading: string) => Promise<boolean> }) {
  const [heading, setHeading] = useState("");
  const [adding, setAdding] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!heading.trim()) return;
        setAdding(true);
        if (await onAdd(heading.trim())) setHeading("");
        setAdding(false);
      }}
      className="flex gap-2"
    >
      <label htmlFor="new-section" className="sr-only">
        New section heading
      </label>
      <input
        id="new-section"
        value={heading}
        onChange={(e) => setHeading(e.target.value)}
        placeholder="New section heading"
        className={`${FIELD} flex-1 min-w-0`}
      />
      <button
        type="submit"
        disabled={adding || !heading.trim()}
        className="rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 px-3 py-2 text-sm font-medium text-primary-foreground transition-colors shrink-0"
      >
        + Add section
      </button>
    </form>
  );
}

// ── Delete spec ────────────────────────────────────────────────────────────

function DeleteSpec({ specId, hasProject }: { specId: string; hasProject: string | null }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    try {
      await send(`/api/specs/${specId}`, "DELETE");
      router.push(hasProject ? `/projects/${hasProject}` : "/dashboard?view=specs");
      router.refresh();
    } catch (err) {
      console.error("Spec delete failed", err);
      setError(err instanceof Error ? err.message : "Couldn't delete the spec.");
    }
  };

  return (
    <div className="border-t border-border pt-6 mt-10">
      <div className="rounded-lg border border-red-950 bg-red-950/10 p-4">
        <p className="text-xs text-muted-foreground/70 mb-3">
          Delete this spec, its sections, and their history. Patches made from it stay, unlinked.
        </p>
        {confirm ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={remove}
              className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white"
            >
              Yes, delete spec
            </button>
            <button type="button" onClick={() => setConfirm(false)} className={SMALL_BTN}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className={SMALL_BTN}>
            <Trash2 aria-hidden className="h-3 w-3" />
            Delete spec
          </button>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
