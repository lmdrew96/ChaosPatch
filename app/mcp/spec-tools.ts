import type { z } from "zod";
import { MCP_SCHEMAS } from "@/lib/mcp-schemas";
import { getProjectBySlug } from "@/lib/queries";
import {
  addSpecSection,
  attachSpec,
  createSpec,
  deleteSpec,
  deleteSpecSection,
  detachSpec,
  getSectionRefs,
  getSpec,
  getSpecHistory,
  listSpecs,
  reorderSpecSections,
  runSpecProposal,
  setSectionReferenceOnly,
  setSpecPrimary,
  updateSpecSection,
  updateSpecTitle,
  type SpecAuthor,
  type SpecDetail,
} from "@/lib/specs";

// Specs (3/5): MCP read/write for Coru and Cody. Every write is attributed.

export const SPEC_TOOL_NAMES = [
  "cp_list_specs",
  "cp_get_spec",
  "cp_create_spec",
  "cp_update_spec",
  "cp_delete_spec",
  "cp_add_spec_section",
  "cp_update_spec_section",
  "cp_delete_spec_section",
  "cp_reorder_spec_sections",
  "cp_get_spec_history",
  "cp_propose_patches_from_spec",
] as const;
export type SpecToolName = (typeof SPEC_TOOL_NAMES)[number];

export function isSpecToolName(name: string): name is SpecToolName {
  return (SPEC_TOOL_NAMES as readonly string[]).includes(name);
}

type Args<T extends SpecToolName> = z.infer<(typeof MCP_SCHEMAS)[T]>;

const AUTHOR_PROP = {
  type: "string",
  enum: ["coru", "cody"],
  description:
    "Who is writing. Only needed if your client doesn't send an X-Claude-Identity header (which wins when present). Writes with neither are refused — MCP writes are never attributed to Nae.",
};

export const SPEC_TOOLS = [
  {
    name: "cp_list_specs",
    description:
      "List specs (living build docs made of ordered markdown sections). A spec can be a draft (no project yet) or linked to a project; a project can have many specs, at most one marked is_primary (its big-picture spec). Primary first, then most recently edited. Each row has project_slug (null for drafts) and section_count — call cp_get_spec for the sections.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_slug: {
          type: "string",
          description: "Only specs linked to this project (optional; omit for all, drafts included)",
        },
      },
    },
  },
  {
    name: "cp_get_spec",
    description:
      "Fetch one spec with its ordered sections (id, heading, markdown body, last_author, last_edited_at) and the patches linked to each section. Pass spec_id, or project_slug to get that project's primary spec (or its only spec). If a project has several specs and none is primary, this lists them so you can pick a spec_id.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spec_id: { type: "string", description: "Spec UUID" },
        project_slug: { type: "string", description: "Project slug (alternative to spec_id)" },
      },
    },
  },
  {
    name: "cp_create_spec",
    description:
      "Create a spec. No project needed: omit project_slug for a draft. Sections default to the template (Overview / why, Users & goals, Core features, Out of scope, Data model, Design notes, Open questions); pass sections to start with your own. is_primary (linked specs only) makes it the project's big-picture spec and demotes the current one.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        project_slug: { type: "string", description: "Link to this project (optional)" },
        is_primary: { type: "boolean", description: "Make it the project's primary spec (default false)" },
        sections: {
          type: "array",
          description: "Initial sections, in order (optional; default = template)",
          items: {
            type: "object",
            properties: {
              heading: { type: "string" },
              body: { type: "string", description: "Markdown (optional)" },
              reference_only: { type: "boolean", description: "Context only; default generate runs skip it" },
            },
            required: ["heading"],
          },
        },
        author: AUTHOR_PROP,
      },
      required: ["title"],
    },
  },
  {
    name: "cp_update_spec",
    description:
      "Update a spec's title and/or project link. project_slug: a slug attaches it to that project, null detaches it (the spec and its history are kept), omit to leave it. is_primary: make or unmake it the project's primary spec (making it primary demotes the current one).",
    inputSchema: {
      type: "object" as const,
      properties: {
        spec_id: { type: "string" },
        title: { type: "string" },
        project_slug: { type: ["string", "null"], description: "Attach (slug) / detach (null) / unchanged (omit)" },
        is_primary: { type: "boolean" },
      },
      required: ["spec_id"],
    },
  },
  {
    name: "cp_delete_spec",
    description:
      "Permanently delete a spec with its sections and history. Patches that were linked to its sections stay, unlinked. Confirm with Nae first.",
    inputSchema: {
      type: "object" as const,
      properties: { spec_id: { type: "string" } },
      required: ["spec_id"],
    },
  },
  {
    name: "cp_add_spec_section",
    description:
      "Append a section (heading + markdown body) to the end of a spec. Use cp_reorder_spec_sections to move it. Recorded in the spec's history under your name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spec_id: { type: "string" },
        heading: { type: "string" },
        body: { type: "string", description: "Markdown (optional)" },
        reference_only: { type: "boolean", description: "Context only; default generate runs skip it (default false)" },
        author: AUTHOR_PROP,
      },
      required: ["spec_id", "heading"],
    },
  },
  {
    name: "cp_update_spec_section",
    description:
      "Change a section's heading and/or body. body REPLACES the whole section body — read it with cp_get_spec first and send the full new text. Recorded with before/after in the history under your name; a write that changes nothing isn't recorded. Typical Cody writes: implementation notes, deviations (\"spec says A, code does B\"), section status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        section_id: { type: "string" },
        heading: { type: "string" },
        body: { type: "string", description: "Full replacement markdown body" },
        reference_only: {
          type: "boolean",
          description:
            "Mark the section context only (summary, build order, principles): default cp_propose_patches_from_spec runs skip it. A flag change alone needs no author and isn't a revision.",
        },
        author: AUTHOR_PROP,
      },
      required: ["section_id"],
    },
  },
  {
    name: "cp_delete_spec_section",
    description:
      "Remove a section from a spec. The removal (with the old heading/body) stays in the spec's history. Patches linked to it stay, unlinked.",
    inputSchema: {
      type: "object" as const,
      properties: {
        section_id: { type: "string" },
        author: AUTHOR_PROP,
      },
      required: ["section_id"],
    },
  },
  {
    name: "cp_reorder_spec_sections",
    description:
      "Set the order of a spec's sections. section_ids must list every section of the spec exactly once, in the new order.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spec_id: { type: "string" },
        section_ids: { type: "array", items: { type: "string" } },
      },
      required: ["spec_id", "section_ids"],
    },
  },
  {
    name: "cp_get_spec_history",
    description:
      "A spec's section revisions, newest first: kind (create | edit | delete), author (nae | coru | cody | app), before/after heading and body, created_at. Pass section_id to narrow to one section.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spec_id: { type: "string" },
        section_id: { type: "string" },
        limit: { type: "integer", description: "Max revisions (default 100, max 500)" },
      },
      required: ["spec_id"],
    },
  },
  {
    name: "cp_propose_patches_from_spec",
    description:
      "Propose patches from a spec linked to a project, using the same prompt as the in-app \"Generate patches\" button. Nothing is filed: review the proposals with Nae, then file the ones she approves with cp_add_patch (project_slug, title, notes, tags, priority, and the proposal's spec_section_id). The model sees every patch already on the project's board (any section, any status) and skips work they cover. By default it breaks down only non-empty sections that aren't reference_only and have no linked patches; `skipped` says which were left out and why. Pass section_ids to run specific sections (reference-only and covered ones included).",
    inputSchema: {
      type: "object" as const,
      properties: {
        spec_id: { type: "string" },
        section_ids: {
          type: "array",
          items: { type: "string" },
          description: "Only these sections, covered ones included (optional)",
        },
        pending_titles: {
          type: "array",
          items: { type: "string" },
          description:
            "Titles of proposals from your earlier calls that aren't filed yet, so this call doesn't repeat them. For a big spec, run a few sections per call (section_ids) and pass the titles you've already been given.",
        },
      },
      required: ["spec_id"],
    },
  },
];

/**
 * Who a write is attributed to. The X-Claude-Identity header (as Tangle
 * uses) wins; else the explicit author param; else refuse. Never "nae".
 */
function resolveAuthor(identity: string | null, explicit?: "coru" | "cody"): SpecAuthor {
  const fromHeader = identity?.trim().toLowerCase();
  if (fromHeader === "coru" || fromHeader === "cody") return fromHeader;
  if (explicit) return explicit;
  throw new Error(
    "Can't attribute this spec write: no X-Claude-Identity header was sent. Pass author: 'coru' or 'cody'."
  );
}

async function requireProjectId(userId: string, slug: string): Promise<string> {
  const project = await getProjectBySlug(userId, slug);
  if (!project) throw new Error(`Project '${slug}' not found`);
  return project.id;
}

async function requireSpec(userId: string, specId: string): Promise<SpecDetail> {
  const spec = await getSpec(userId, specId);
  if (!spec) throw new Error(`Spec '${specId}' not found`);
  return spec;
}

const json = (value: unknown): string => JSON.stringify(value, null, 2);

/** The section (as cp_get_spec shows it) after a flag-only update. */
async function listSectionOwner(userId: string, sectionId: string): Promise<unknown> {
  const refs = await getSectionRefs(userId, [sectionId]);
  const ref = refs.get(sectionId);
  if (!ref) throw new Error(`Spec section '${sectionId}' not found`);
  const spec = await requireSpec(userId, ref.spec_id);
  return spec.sections.find((x) => x.id === sectionId);
}

export async function handleSpecTool(
  name: SpecToolName,
  args: unknown,
  userId: string,
  identity: string | null
): Promise<string> {
  switch (name) {
    case "cp_list_specs": {
      const a = args as Args<"cp_list_specs">;
      return json(await listSpecs(userId, a.project_slug));
    }

    case "cp_get_spec": {
      const a = args as Args<"cp_get_spec">;
      if (a.spec_id) return json(await requireSpec(userId, a.spec_id));
      const slug = a.project_slug as string;
      await requireProjectId(userId, slug);
      const specs = await listSpecs(userId, slug);
      if (specs.length === 0) throw new Error(`Project '${slug}' has no specs yet`);
      const pick = specs.find((s) => s.is_primary) ?? (specs.length === 1 ? specs[0] : null);
      if (!pick) {
        const options = specs.map((s) => `- ${s.title} (spec_id ${s.id})`).join("\n");
        throw new Error(
          `Project '${slug}' has ${specs.length} specs and none is primary. Call again with a spec_id:\n${options}`
        );
      }
      return json(await requireSpec(userId, pick.id));
    }

    case "cp_create_spec": {
      const a = args as Args<"cp_create_spec">;
      const author = resolveAuthor(identity, a.author);
      const projectId = a.project_slug ? await requireProjectId(userId, a.project_slug) : null;
      const spec = await createSpec(userId, {
        title: a.title,
        author,
        projectId,
        isPrimary: a.is_primary,
        sections: a.sections,
      });
      return json(spec);
    }

    case "cp_update_spec": {
      const a = args as Args<"cp_update_spec">;
      await requireSpec(userId, a.spec_id);
      if (a.title !== undefined) await updateSpecTitle(userId, a.spec_id, a.title);
      if (a.project_slug === null) {
        await detachSpec(userId, a.spec_id);
      } else if (a.project_slug !== undefined) {
        const projectId = await requireProjectId(userId, a.project_slug);
        await attachSpec(userId, a.spec_id, projectId, a.is_primary ?? false);
      } else if (a.is_primary !== undefined) {
        await setSpecPrimary(userId, a.spec_id, a.is_primary);
      }
      return json(await requireSpec(userId, a.spec_id));
    }

    case "cp_delete_spec": {
      const a = args as Args<"cp_delete_spec">;
      if (!(await deleteSpec(userId, a.spec_id))) throw new Error(`Spec '${a.spec_id}' not found`);
      return json({ deleted: true, spec_id: a.spec_id });
    }

    case "cp_add_spec_section": {
      const a = args as Args<"cp_add_spec_section">;
      const author = resolveAuthor(identity, a.author);
      const section = await addSpecSection(
        userId,
        a.spec_id,
        a.heading,
        a.body ?? "",
        author,
        a.reference_only ?? false
      );
      if (!section) throw new Error(`Spec '${a.spec_id}' not found`);
      return json(section);
    }

    case "cp_update_spec_section": {
      const a = args as Args<"cp_update_spec_section">;
      if (a.reference_only !== undefined) {
        if (!(await setSectionReferenceOnly(userId, a.section_id, a.reference_only))) {
          throw new Error(`Spec section '${a.section_id}' not found`);
        }
      }
      if (a.heading === undefined && a.body === undefined) {
        // Flag-only change: no content write, so no author needed.
        const spec = await listSectionOwner(userId, a.section_id);
        return json(spec);
      }
      const author = resolveAuthor(identity, a.author);
      const section = await updateSpecSection(
        userId,
        a.section_id,
        { heading: a.heading, body: a.body },
        author
      );
      if (!section) throw new Error(`Spec section '${a.section_id}' not found`);
      return json(section);
    }

    case "cp_delete_spec_section": {
      const a = args as Args<"cp_delete_spec_section">;
      const author = resolveAuthor(identity, a.author);
      if (!(await deleteSpecSection(userId, a.section_id, author))) {
        throw new Error(`Spec section '${a.section_id}' not found`);
      }
      return json({ deleted: true, section_id: a.section_id });
    }

    case "cp_reorder_spec_sections": {
      const a = args as Args<"cp_reorder_spec_sections">;
      if (!(await reorderSpecSections(userId, a.spec_id, a.section_ids))) {
        throw new Error(`Spec '${a.spec_id}' not found`);
      }
      return json(await requireSpec(userId, a.spec_id));
    }

    case "cp_propose_patches_from_spec": {
      const a = args as Args<"cp_propose_patches_from_spec">;
      const spec = await requireSpec(userId, a.spec_id);
      if (!spec.project_slug) {
        throw new Error(
          "This spec isn't attached to a project, so there's nowhere to file patches. Attach it first with cp_update_spec (project_slug)."
        );
      }
      const { proposals, skipped } = await runSpecProposal(
        userId,
        spec,
        a.section_ids,
        a.pending_titles ?? []
      );
      return json({
        project_slug: spec.project_slug,
        proposals: proposals.map((p) => ({ ...p, spec_section_id: p.section_id })),
        skipped,
        next_step:
          "Nothing was filed. Review these with Nae; file approved ones with cp_add_patch, passing spec_section_id.",
      });
    }

    case "cp_get_spec_history": {
      const a = args as Args<"cp_get_spec_history">;
      await requireSpec(userId, a.spec_id);
      return json(await getSpecHistory(userId, a.spec_id, a.section_id, a.limit));
    }
  }
}
