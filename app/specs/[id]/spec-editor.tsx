"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, History, Pencil, Sparkles, Star, Trash2, X } from "lucide-react";
import type {
  SkippedSection,
  SpecDetail,
  SpecLinkedPatch,
  SpecSection,
  SpecSectionWithPatches,
} from "@/lib/specs";
import type { ProposedPatch } from "@/lib/ai";
import type { Patch } from "@/lib/queries";
import { Markdown } from "@/components/markdown";
import { AUTHOR_LABELS } from "@/components/specs/spec-list";
import { SpecHistory } from "@/components/specs/spec-history";
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
  const generator = useRef<GeneratorHandle>(null);

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
            specId={spec.id}
            section={section}
            projectSlug={spec.project_slug}
            isFirst={i === 0}
            isLast={i === spec.sections.length - 1}
            busy={busy}
            onMove={(delta) => move(i, delta)}
            onDelete={() => removeSection(section.id)}
            onSaved={onSectionSaved}
            onGenerate={
              spec.project_slug
                ? () => generator.current?.run(section.id, section.heading)
                : undefined
            }
          />
        ))}
      </ol>

      <AddSectionForm onAdd={addSection} />

      {spec.project_slug && (
        <GeneratePatches
          ref={generator}
          specId={spec.id}
          projectSlug={spec.project_slug}
          onFiled={(filed) =>
            setSpec((s) => ({
              ...s,
              sections: s.sections.map((sec) => ({
                ...sec,
                patches: [
                  ...sec.patches,
                  ...filed
                    .filter((p) => p.spec_section_id === sec.id)
                    .map(
                      (p): SpecLinkedPatch => ({
                        id: p.id,
                        title: p.title,
                        status: p.status,
                        priority: p.priority,
                        created_at: p.created_at,
                        spec_section_id: sec.id,
                      })
                    ),
                ],
              })),
            }))
          }
        />
      )}

      <details className="rounded-lg border border-border bg-card/40 p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          All changes
        </summary>
        <div className="mt-3">
          {/* Refetch after any section save, add, or remove. */}
          <SpecHistory
            specId={spec.id}
            refreshKey={`${spec.sections.length}:${
              spec.sections.map((x) => x.last_edited_at ?? "").sort().at(-1) ?? ""
            }`}
          />
        </div>
      </details>

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
  specId,
  section,
  projectSlug,
  isFirst,
  isLast,
  busy,
  onMove,
  onDelete,
  onSaved,
  onGenerate,
}: {
  specId: string;
  section: SpecSectionWithPatches;
  projectSlug: string | null;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
  onSaved: (s: SpecSection) => void;
  // Only for specs linked to a project (patches need somewhere to go).
  onGenerate?: () => void;
}) {
  const [heading, setHeading] = useState(section.heading);
  const [body, setBody] = useState(section.body);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [referenceOnly, setReferenceOnly] = useState(section.reference_only);

  const toggleReference = async () => {
    const next = !referenceOnly;
    setReferenceOnly(next); // optimistic
    try {
      await send(`/api/spec-sections/${section.id}`, "PATCH", { reference_only: next });
    } catch (err) {
      console.error("Reference-only toggle failed", err);
      setReferenceOnly(!next);
      setSaveState("error");
      setSaveError("Couldn't change that setting.");
    }
  };

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
    <li id={`section-${section.id}`} className="list-none rounded-lg border border-border bg-card/60 p-4 scroll-mt-24 target:ring-2 target:ring-primary/40">
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
        <label
          className="ml-auto inline-flex cursor-pointer items-center gap-1 hover:text-foreground transition-colors"
          title="Context only (summary, build order, principles). Generate patches skips it unless you run it on this section directly."
        >
          <input
            type="checkbox"
            checked={referenceOnly}
            onChange={toggleReference}
            className="h-3 w-3 accent-primary"
          />
          Reference only
        </label>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <History aria-hidden className="h-3 w-3" />
          {showHistory ? "Hide history" : "History"}
        </button>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={!body.trim()}
            title={
              body.trim()
                ? "Propose patches for just this section. Patches already on the board are taken into account."
                : "Write something in this section first"
            }
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors disabled:opacity-40"
          >
            <Sparkles aria-hidden className="h-3 w-3" />
            Generate patches
          </button>
        )}
      </div>

      {showHistory && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <SpecHistory specId={specId} sectionId={section.id} refreshKey={section.last_edited_at} />
        </div>
      )}

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

// ── Generate patches (Specs 4/5) ───────────────────────────────────────────

type Draft = ProposedPatch & { key: string; tagText: string };

type GeneratorHandle = { run: (sectionId: string, heading: string) => void };

function GeneratePatches({
  ref,
  specId,
  projectSlug,
  onFiled,
}: {
  ref?: Ref<GeneratorHandle>;
  specId: string;
  projectSlug: string;
  onFiled: (filed: Patch[]) => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [skipped, setSkipped] = useState<SkippedSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [filing, setFiling] = useState(false);
  const [error, setError] = useState("");
  const [filedCount, setFiledCount] = useState(0);
  // Which section the last run targeted (null = whole spec).
  const [scope, setScope] = useState<{ id: string; heading: string } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const loadingRef = useRef(false);
  const runCount = useRef(0);
  // Whole-spec runs go in batches; this is "batch 2 of 4" while running.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const toDrafts = (proposals: ProposedPatch[]): Draft[] => {
    const run = ++runCount.current;
    return proposals.map((p, i) => ({
      ...p,
      key: `${run}-${i}-${p.section_id}`,
      tagText: p.tags.join(", "),
    }));
  };

  // One request per batch of sections, in spec order. Each batch sees the
  // earlier batches' proposals so nothing repeats; drafts appear as they land.
  const generateWholeSpec = async () => {
    const plan = (await send(`/api/specs/${specId}/propose`, "POST", { plan: true })) as {
      batches: { section_ids: string[]; headings: string[] }[];
      skipped: SkippedSection[];
    };
    setSkipped(plan.skipped);
    setDrafts([]);
    const titles: string[] = [];
    setProgress({ done: 0, total: plan.batches.length });
    for (const [i, batch] of plan.batches.entries()) {
      const data = (await send(`/api/specs/${specId}/propose`, "POST", {
        section_ids: batch.section_ids,
        pending_titles: titles,
      })) as { proposals: ProposedPatch[] };
      titles.push(...data.proposals.map((p) => p.title));
      const fresh = toDrafts(data.proposals);
      setDrafts((prev) => [...(prev ?? []), ...fresh]);
      setProgress({ done: i + 1, total: plan.batches.length });
    }
  };

  const generate = async (section: { id: string; heading: string } | null) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError("");
    setFiledCount(0);
    setScope(section);
    try {
      if (!section) {
        await generateWholeSpec();
        return;
      }
      const data = (await send(`/api/specs/${specId}/propose`, "POST", {
        section_ids: [section.id],
      })) as { proposals: ProposedPatch[]; skipped: SkippedSection[] };
      const fresh = toDrafts(data.proposals);
      // A section run adds to unfiled proposals (replacing only that
      // section's), so pending edits elsewhere aren't lost. Spec-wide replaces.
      setDrafts((prev) =>
        prev ? [...prev.filter((d) => d.section_id !== section.id), ...fresh] : fresh
      );
      setSkipped(data.skipped);
    } catch (err) {
      console.error("Generate patches failed", err);
      setError(err instanceof Error ? err.message : "Couldn't generate patches.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setProgress(null);
    }
  };

  useImperativeHandle(ref, () => ({
    run: (id, heading) => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      void generate({ id, heading });
    },
  }));

  const update = (key: string, changes: Partial<Draft>) =>
    setDrafts((d) => d?.map((x) => (x.key === key ? { ...x, ...changes } : x)) ?? null);

  const file = async () => {
    if (!drafts?.length) return;
    setFiling(true);
    setError("");
    try {
      const data = (await send(`/api/specs/${specId}/file`, "POST", {
        patches: drafts.map((d) => ({
          section_id: d.section_id,
          title: d.title,
          notes: d.notes,
          priority: d.priority,
          tags: d.tagText.split(",").map((t) => t.trim()).filter(Boolean),
        })),
      })) as { filed: Patch[] };
      onFiled(data.filed);
      setFiledCount(data.filed.length);
      setDrafts(null);
      setSkipped([]);
      router.refresh();
    } catch (err) {
      console.error("Filing patches failed", err);
      setError(err instanceof Error ? err.message : "Couldn't file those patches.");
    } finally {
      setFiling(false);
    }
  };

  return (
    <section
      ref={panelRef}
      aria-labelledby="generate-heading"
      className="rounded-lg border border-border bg-card/40 p-4 space-y-3 scroll-mt-24"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="generate-heading" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {scope && (loading || drafts) ? `Patches from: ${scope.heading}` : "Patches from this spec"}
        </h2>
        <button type="button" onClick={() => void generate(null)} disabled={loading || filing} className={SMALL_BTN}>
          <Sparkles aria-hidden className="h-3 w-3" />
          {loading
            ? progress && progress.total > 1
              ? `Batch ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
              : "Generating…"
            : drafts && !scope
              ? "Regenerate"
              : "Generate for whole spec"}
        </button>
      </div>
      {!drafts && !loading && filedCount === 0 && (
        <p className="text-xs text-muted-foreground/60">
          Proposes patches for sections that don&apos;t have any yet, or use a section&apos;s own Generate patches button. Nothing is filed until you approve.
        </p>
      )}
      {filedCount > 0 && (
        <p className="text-xs text-success">
          Filed {filedCount} {filedCount === 1 ? "patch" : "patches"} to{" "}
          <Link href={`/projects/${projectSlug}`} className="underline underline-offset-2">
            the project
          </Link>
          , each linked to its section.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {drafts && (
        <>
          {drafts.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">
              {loading ? "Working through the spec…" : "No new patches proposed."}
            </p>
          ) : (
            <ul className="space-y-3">
              {drafts.map((d) => (
                <ProposalCard
                  key={d.key}
                  draft={d}
                  onChange={(changes) => update(d.key, changes)}
                  onDiscard={() => setDrafts((all) => all?.filter((x) => x.key !== d.key) ?? null)}
                />
              ))}
            </ul>
          )}
          {skipped.length > 0 && (
            <details className="text-[11px] text-muted-foreground/70">
              <summary className="cursor-pointer">Skipped {skipped.length} sections</summary>
              <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                {skipped.map((s) => (
                  <li key={s.section_id}>
                    {s.heading}: {s.reason.replace(/; pass its section id to re-run it$/, "")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            {drafts.length > 0 && (
              <button
                type="button"
                onClick={file}
                disabled={filing || drafts.some((d) => !d.title.trim())}
                className="rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors"
              >
                {filing ? "Filing…" : `File ${drafts.length} ${drafts.length === 1 ? "patch" : "patches"}`}
              </button>
            )}
            <button type="button" onClick={() => setDrafts(null)} disabled={filing} className={SMALL_BTN}>
              Discard all
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function ProposalCard({
  draft,
  onChange,
  onDiscard,
}: {
  draft: Draft;
  onChange: (changes: Partial<Draft>) => void;
  onDiscard: () => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  return (
    <li className="list-none rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        <label htmlFor={`proposal-${draft.key}`} className="sr-only">
          Patch title
        </label>
        <input
          id={`proposal-${draft.key}`}
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className={`${FIELD} flex-1 min-w-0 font-medium`}
        />
        <IconBtn label={`Discard "${draft.title}"`} onClick={onDiscard}>
          <X className="h-3.5 w-3.5" />
        </IconBtn>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
        From: {draft.section_heading}
      </p>
      {editingNotes ? (
        <textarea
          aria-label="Patch notes (markdown)"
          autoFocus
          value={draft.notes}
          rows={Math.max(4, draft.notes.split("\n").length + 1)}
          onChange={(e) => onChange({ notes: e.target.value })}
          onBlur={() => setEditingNotes(false)}
          className={`${FIELD} w-full font-mono leading-relaxed`}
        />
      ) : (
        <div>
          <Markdown className="text-xs text-foreground/80">{draft.notes || "_No notes._"}</Markdown>
          <button type="button" onClick={() => setEditingNotes(true)} className={`${SMALL_BTN} mt-1.5`}>
            <Pencil aria-hidden className="h-3 w-3" />
            Edit notes
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          Priority
          <select
            value={draft.priority}
            onChange={(e) => onChange({ priority: e.target.value as Draft["priority"] })}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs [@media(pointer:coarse)]:text-base text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="flex flex-1 min-w-[12rem] items-center gap-1.5 text-[10px] text-muted-foreground">
          Tags
          <input
            value={draft.tagText}
            onChange={(e) => onChange({ tagText: e.target.value })}
            placeholder="ui, db, energy:med"
            className="flex-1 min-w-0 rounded-md border border-border bg-input px-2 py-1 text-xs [@media(pointer:coarse)]:text-base text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>
    </li>
  );
}
