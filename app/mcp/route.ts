import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getUserIdFromToken,
  getProjects,
  createProject,
  getPatches,
  getAllPatches,
  getProjectBySlug,
  createPatch,
  updatePatchStatus,
  addNote,
  deletePatch,
  deleteProject,
  getPatchById,
  getPatchAttachments,
  addPatchTags,
  removePatchTags,
  updatePatch,
  updateProject,
  reopenPatch,
  getProjectSummary,
  searchPatches,
  batchUpdatePatches,
  getVelocity,
  archiveCompletedPatches,
  unarchivePatch,
} from "@/lib/queries";
import { getBaseUrl } from "@/lib/oauth";
import { presignBlobGetUrl } from "@/lib/blob";
import sharp from "sharp";
import { MCP_SCHEMAS, isMcpToolName, type McpToolName } from "@/lib/mcp-schemas";
import type { z } from "zod";

type ParsedArgs<T extends McpToolName> = z.infer<(typeof MCP_SCHEMAS)[T]>;

const TOOLS = [
  {
    name: "cp_list_projects",
    description:
      "Get all ChaosPatch projects for the authenticated user. Each project includes open_count, in_progress_count, and done_count (all exclude archived patches), so a dashboard view can be built from one call.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "cp_add_project",
    description: "Create a new ChaosPatch project for the authenticated user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Display name for the project" },
        slug: {
          type: "string",
          description: "URL-safe identifier (lowercase, hyphens)",
        },
        color: {
          type: "string",
          description: "Hex color for the project dot (default: #6366f1)",
        },
      },
      required: ["name", "slug"],
    },
  },
  {
    name: "cp_list_patches",
    description:
      "Get patches for a project, optionally filtered by status (open | in_progress | done), priority (low | medium | high), and/or tags (returns patches with at least one matching tag). Supports sort_by (priority | created_at — default created_at), pagination via limit (max 500) and offset, and due_before (YYYY-MM-DD, inclusive — patches due on or before this date). Each patch carries notes_preview (first ~200 chars) + notes_length, not full notes — call cp_get_patch for a patch's complete notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_slug: { type: "string" },
        status: {
          type: "string",
          enum: ["open", "in_progress", "done"],
          description: "Filter by status (optional)",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Filter by priority (optional)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Filter by tags — returns patches having at least one matching tag (optional)",
        },
        sort_by: {
          type: "string",
          enum: ["priority", "created_at"],
          description:
            "Sort order: 'priority' (high → low, then created_at DESC) or 'created_at' (newest first — default)",
        },
        limit: {
          type: "integer",
          description: "Max results to return (1–500, optional)",
        },
        offset: {
          type: "integer",
          description: "Rows to skip for pagination (default 0)",
        },
        due_before: {
          type: "string",
          description:
            "Inclusive upper bound on due_date (YYYY-MM-DD). Returns patches with due_date <= this date.",
        },
        include_archived: {
          type: "boolean",
          description:
            "If true, include archived patches in results. Default false.",
        },
      },
      required: ["project_slug"],
    },
  },
  {
    name: "cp_list_all_patches",
    description:
      "Get patches across ALL projects for the authenticated user, optionally filtered by status, priority, and/or tags (any-overlap match). Each patch includes project_name, project_slug, and project_color. Supports sort_by (priority | created_at — default created_at), pagination via limit (max 500) and offset, and due_before (YYYY-MM-DD, inclusive). Each patch carries notes_preview (first ~200 chars) + notes_length, not full notes — call cp_get_patch for a patch's complete notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["open", "in_progress", "done"],
          description: "Filter by status (optional)",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Filter by priority (optional)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Filter by tags — returns patches having at least one matching tag (optional)",
        },
        sort_by: {
          type: "string",
          enum: ["priority", "created_at"],
          description:
            "Sort order: 'priority' (high → low, then created_at DESC) or 'created_at' (newest first — default)",
        },
        limit: {
          type: "integer",
          description: "Max results to return (1–500, optional)",
        },
        offset: {
          type: "integer",
          description: "Rows to skip for pagination (default 0)",
        },
        due_before: {
          type: "string",
          description:
            "Inclusive upper bound on due_date (YYYY-MM-DD). Returns patches with due_date <= this date.",
        },
        include_archived: {
          type: "boolean",
          description:
            "If true, include archived patches in results. Default false.",
        },
      },
    },
  },
  {
    name: "cp_add_patch",
    description:
      "Add a new patch to a project, optionally with initial notes, a long-form spec, tags, and a due date. Keep `notes` terse (a triage summary + acceptance criteria); put long-form specs/brainstorms in `spec`, which is excluded from list/search payloads so the board stays scannable.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_slug: { type: "string" },
        title: { type: "string", description: "Patch description" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Priority level (default: medium)",
        },
        notes: {
          type: "string",
          description:
            "Initial terse notes to set on the patch — triage summary + acceptance criteria (optional)",
        },
        spec: {
          type: "string",
          description:
            "Long-form spec / brainstorm (optional). Never returned by list/search tools — only by cp_get_patch and the web detail view.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Free-form tags (e.g. 'bug', 'ui', 'db'). Default: [] (optional)",
        },
        due_date: {
          type: "string",
          description: "Due date in YYYY-MM-DD format (optional)",
        },
      },
      required: ["project_slug", "title"],
    },
  },
  {
    name: "cp_get_patch",
    description:
      "Fetch a single patch by ID. Returns the full patch object — including complete `notes`, the long-form `spec`, and an `attachments` array of any images — or an error if not found / not owned by the authenticated user. This is the deep-read tool: use it to read a patch's full notes/spec after a list/search tool showed only a preview.",
    inputSchema: {
      type: "object" as const,
      properties: { patch_id: { type: "string", description: "Patch UUID" } },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_get_patch_images",
    description:
      "Fetch a patch's image attachments as viewable images for visual context (e.g. screenshots the user attached to a bug). Returns the images inline plus a text list of their URLs. Use this when a patch has attachments and you need to see them.",
    inputSchema: {
      type: "object" as const,
      properties: { patch_id: { type: "string", description: "Patch UUID" } },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_start_patch",
    description: "Set a patch status to in_progress and log started_at.",
    inputSchema: {
      type: "object" as const,
      properties: { patch_id: { type: "string", description: "Patch UUID" } },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_complete_patch",
    description:
      "Set a patch status to done and log completed_at. Optionally append a completion note in the same call (appended to existing notes with a blank-line separator).",
    inputSchema: {
      type: "object" as const,
      properties: {
        patch_id: { type: "string", description: "Patch UUID" },
        note: {
          type: "string",
          description:
            "Optional completion note appended to the patch's notes field",
        },
      },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_add_note",
    description: "Append a note to an existing patch.",
    inputSchema: {
      type: "object" as const,
      properties: {
        patch_id: { type: "string" },
        note: { type: "string", description: "Note text to append" },
      },
      required: ["patch_id", "note"],
    },
  },
  {
    name: "cp_delete_patch",
    description: "Permanently delete a patch.",
    inputSchema: {
      type: "object" as const,
      properties: { patch_id: { type: "string", description: "Patch UUID" } },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_delete_project",
    description: "Permanently delete a project and all its patches.",
    inputSchema: {
      type: "object" as const,
      properties: { project_slug: { type: "string" } },
      required: ["project_slug"],
    },
  },
  {
    name: "cp_update_patch",
    description:
      "Update a patch's title, priority, tags, due_date, notes, and/or spec. If tags is provided (even as []), it REPLACES the existing tags array; if omitted, tags are left unchanged. due_date: omit to leave unchanged, pass YYYY-MM-DD to set, pass null to clear. notes: omit to leave unchanged, pass a string to REPLACE the entire notes body, pass null to clear — use cp_add_note to append instead. spec: omit to leave unchanged, pass a string to set the long-form spec, pass null to clear it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        patch_id: { type: "string", description: "Patch UUID" },
        title: { type: "string", description: "New title (optional)" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "New priority (optional)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "New tags array — REPLACES existing tags. Pass [] to clear (optional)",
        },
        due_date: {
          type: ["string", "null"],
          description:
            "Due date (YYYY-MM-DD) — pass null to clear, omit to leave unchanged",
        },
        notes: {
          type: ["string", "null"],
          description:
            "Notes body — pass a string to REPLACE all notes, null to clear, omit to leave unchanged. For append-only, use cp_add_note instead.",
        },
        spec: {
          type: ["string", "null"],
          description:
            "Long-form spec — pass a string to set, null to clear, omit to leave unchanged. Excluded from list/search payloads.",
        },
      },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_add_tags",
    description:
      "Append tags to a patch atomically. Tags already on the patch are skipped (no duplicates); existing tag order is preserved.",
    inputSchema: {
      type: "object" as const,
      properties: {
        patch_id: { type: "string", description: "Patch UUID" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to add (at least one)",
        },
      },
      required: ["patch_id", "tags"],
    },
  },
  {
    name: "cp_remove_tags",
    description:
      "Remove specific tags from a patch atomically. Tags not present on the patch are no-ops; remaining tag order is preserved.",
    inputSchema: {
      type: "object" as const,
      properties: {
        patch_id: { type: "string", description: "Patch UUID" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to remove (at least one)",
        },
      },
      required: ["patch_id", "tags"],
    },
  },
  {
    name: "cp_update_project",
    description: "Update a project's name and/or color.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_slug: { type: "string" },
        name: { type: "string", description: "New display name (optional)" },
        color: { type: "string", description: "New hex color (optional)" },
      },
      required: ["project_slug"],
    },
  },
  {
    name: "cp_reopen_patch",
    description:
      "Reopen a done or in_progress patch. Reverts to open (clears started_at and completed_at) or in_progress (clears completed_at).",
    inputSchema: {
      type: "object" as const,
      properties: {
        patch_id: { type: "string", description: "Patch UUID" },
        status: {
          type: "string",
          enum: ["open", "in_progress"],
          description: "Target status (default: open)",
        },
      },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_get_project_summary",
    description:
      "Get open/in_progress/done/archived/total counts for each project. open, in_progress, done, and total all exclude archived patches; archived is a separate count.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "cp_search_patches",
    description:
      "Search patches by title, notes, or tags (case-insensitive). Defaults to all projects, all statuses, non-archived. Optionally scope by project_slug and/or status, and opt in to archived results. Matching is against full notes, but each result carries notes_preview (first ~200 chars) + notes_length, not full notes — call cp_get_patch for a result's complete notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search text" },
        project_slug: {
          type: "string",
          description: "If set, restrict the search to this project (optional)",
        },
        status: {
          type: "string",
          enum: ["open", "in_progress", "done"],
          description: "If set, only return patches in this status (optional)",
        },
        include_archived: {
          type: "boolean",
          description:
            "If true, include archived patches in results. Default false.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "cp_archive_completed",
    description:
      "Archive all completed (status='done') patches owned by the authenticated user, optionally scoped to a single project. Archived patches are excluded from default list views but not deleted. Returns { archived_count, archived_patch_ids }.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_slug: {
          type: "string",
          description:
            "If provided, only archive done patches in this project. If omitted, archives all done patches across all projects.",
        },
      },
    },
  },
  {
    name: "cp_unarchive_patch",
    description: "Unarchive a single patch (sets archived = false).",
    inputSchema: {
      type: "object" as const,
      properties: {
        patch_id: { type: "string", description: "Patch UUID" },
      },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_get_velocity",
    description:
      "Get patches completed since a given date/time across all projects (most recent first). Returns { completed_since, count, patches }. Each patch includes project_name, project_slug, project_color. Archived patches excluded by default. Each patch carries notes_preview (first ~200 chars) + notes_length, not full notes — call cp_get_patch for a patch's complete notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        completed_since: {
          type: "string",
          description:
            "ISO 8601 date or datetime — inclusive lower bound for completed_at (e.g. '2026-05-01' or '2026-05-01T00:00:00Z')",
        },
        include_archived: {
          type: "boolean",
          description:
            "If true, include archived patches in results. Default false.",
        },
      },
      required: ["completed_since"],
    },
  },
  {
    name: "cp_batch_update",
    description:
      "Bulk-update patch status. Action 'start' sets in_progress + started_at; 'complete' sets done + completed_at; 'reopen' reverts to open and clears timestamps. Only patches owned by the authenticated user are affected. Returns { updated: Patch[], errors: { patch_id, reason }[] }.",
    inputSchema: {
      type: "object" as const,
      properties: {
        patch_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of patch UUIDs to update",
        },
        action: {
          type: "string",
          enum: ["start", "complete", "reopen"],
          description: "Action to apply to every patch_id",
        },
      },
      required: ["patch_ids", "action"],
    },
  },
];

const NOTES_PREVIEW_LEN = 200;

/**
 * Trim a patch for list/search responses: replace the full `notes` body with a
 * short preview + length, and drop the long-form `spec` entirely (keeping only
 * its length as a signal). Full notes + spec are served only by cp_get_patch.
 * Done HERE at the MCP boundary (not in lib/queries) so the web dashboard +
 * insights page keep rendering full notes — see patches 4e9a9b62 / 7bfbcac9.
 */
function toListRow<T extends { notes: string | null; spec: string | null }>(
  patch: T
): Omit<T, "notes" | "spec"> & {
  notes_preview: string | null;
  notes_length: number;
  spec_length: number;
} {
  const { notes, spec, ...rest } = patch;
  const length = notes?.length ?? 0;
  const notes_preview =
    notes === null || notes === undefined
      ? null
      : length > NOTES_PREVIEW_LEN
        ? notes.slice(0, NOTES_PREVIEW_LEN) + "…"
        : notes;
  return {
    ...rest,
    notes_preview,
    notes_length: length,
    spec_length: spec?.length ?? 0,
  };
}

async function handleTool(
  name: McpToolName,
  args: ParsedArgs<McpToolName>,
  userId: string
): Promise<string> {
  switch (name) {
    case "cp_list_projects": {
      const projects = await getProjects(userId);
      return JSON.stringify(projects, null, 2);
    }

    case "cp_add_project": {
      const a = args as ParsedArgs<"cp_add_project">;
      const project = await createProject(userId, a.name, a.slug, a.color);
      return JSON.stringify(project, null, 2);
    }

    case "cp_list_patches": {
      const a = args as ParsedArgs<"cp_list_patches">;
      const patches = await getPatches(
        userId,
        a.project_slug,
        a.status,
        a.priority,
        a.tags,
        a.sort_by,
        a.limit,
        a.offset,
        a.due_before,
        a.include_archived
      );
      return JSON.stringify(patches.map(toListRow), null, 2);
    }

    case "cp_list_all_patches": {
      const a = args as ParsedArgs<"cp_list_all_patches">;
      const patches = await getAllPatches(
        userId,
        a.status,
        a.priority,
        a.tags,
        a.sort_by,
        a.limit,
        a.offset,
        a.due_before,
        a.include_archived
      );
      return JSON.stringify(patches.map(toListRow), null, 2);
    }

    case "cp_add_patch": {
      const a = args as ParsedArgs<"cp_add_patch">;
      const project = await getProjectBySlug(userId, a.project_slug);
      if (!project) throw new Error(`Project '${a.project_slug}' not found`);
      const patch = await createPatch(
        project.id,
        a.title,
        a.priority ?? "medium",
        a.notes,
        a.tags,
        a.due_date,
        a.spec
      );
      return JSON.stringify(patch, null, 2);
    }

    case "cp_get_patch": {
      const a = args as ParsedArgs<"cp_get_patch">;
      const patch = await getPatchById(userId, a.patch_id);
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      const attachments = await getPatchAttachments(userId, a.patch_id);
      return JSON.stringify({ ...patch, attachments }, null, 2);
    }

    case "cp_get_patch_images":
      // Returns image content blocks, not text — handled directly in the
      // CallTool request handler. This case keeps the switch exhaustive.
      throw new Error("cp_get_patch_images is handled separately");

    case "cp_start_patch": {
      const a = args as ParsedArgs<"cp_start_patch">;
      const patch = await updatePatchStatus(userId, a.patch_id, "in_progress");
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_complete_patch": {
      const a = args as ParsedArgs<"cp_complete_patch">;
      const patch = await updatePatchStatus(userId, a.patch_id, "done", a.note);
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_add_note": {
      const a = args as ParsedArgs<"cp_add_note">;
      const patch = await addNote(userId, a.patch_id, a.note);
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_delete_patch": {
      const a = args as ParsedArgs<"cp_delete_patch">;
      const ok = await deletePatch(userId, a.patch_id);
      if (!ok) throw new Error(`Patch '${a.patch_id}' not found`);
      return `Patch ${a.patch_id} deleted.`;
    }

    case "cp_delete_project": {
      const a = args as ParsedArgs<"cp_delete_project">;
      await deleteProject(userId, a.project_slug);
      return `Project '${a.project_slug}' and all its patches deleted.`;
    }

    case "cp_update_patch": {
      const a = args as ParsedArgs<"cp_update_patch">;
      const existing = await getPatchById(userId, a.patch_id);
      if (!existing) throw new Error(`Patch '${a.patch_id}' not found`);
      const title = a.title ?? existing.title;
      const priority = a.priority ?? existing.priority;
      const patch = await updatePatch(
        userId,
        a.patch_id,
        title,
        priority,
        a.tags,
        a.due_date,
        a.spec,
        a.notes
      );
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_add_tags": {
      const a = args as ParsedArgs<"cp_add_tags">;
      const patch = await addPatchTags(userId, a.patch_id, a.tags);
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_remove_tags": {
      const a = args as ParsedArgs<"cp_remove_tags">;
      const patch = await removePatchTags(userId, a.patch_id, a.tags);
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_update_project": {
      const a = args as ParsedArgs<"cp_update_project">;
      const existing = await getProjectBySlug(userId, a.project_slug);
      if (!existing) throw new Error(`Project '${a.project_slug}' not found`);
      const projectName = a.name ?? existing.name;
      const color = a.color ?? existing.color;
      const project = await updateProject(userId, a.project_slug, projectName, color);
      return JSON.stringify(project, null, 2);
    }

    case "cp_reopen_patch": {
      const a = args as ParsedArgs<"cp_reopen_patch">;
      const patch = await reopenPatch(userId, a.patch_id, a.status ?? "open");
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_get_project_summary": {
      const summary = await getProjectSummary(userId);
      return JSON.stringify(summary, null, 2);
    }

    case "cp_search_patches": {
      const a = args as ParsedArgs<"cp_search_patches">;
      const results = await searchPatches(
        userId,
        a.query,
        a.include_archived,
        a.project_slug,
        a.status
      );
      return JSON.stringify(results.map(toListRow), null, 2);
    }

    case "cp_get_velocity": {
      const a = args as ParsedArgs<"cp_get_velocity">;
      const result = await getVelocity(
        userId,
        a.completed_since,
        a.include_archived
      );
      return JSON.stringify(
        { ...result, patches: result.patches.map(toListRow) },
        null,
        2
      );
    }

    case "cp_archive_completed": {
      const a = args as ParsedArgs<"cp_archive_completed">;
      const result = await archiveCompletedPatches(userId, a.project_slug);
      return JSON.stringify(result, null, 2);
    }

    case "cp_unarchive_patch": {
      const a = args as ParsedArgs<"cp_unarchive_patch">;
      const patch = await unarchivePatch(userId, a.patch_id);
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_batch_update": {
      const a = args as ParsedArgs<"cp_batch_update">;
      const result = await batchUpdatePatches(userId, a.patch_ids, a.action);
      return JSON.stringify(result, null, 2);
    }
  }
}

type McpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

/**
 * Build MCP content for cp_get_patch_images: a text block listing the image
 * URLs (robust context even if a client can't render images), followed by the
 * images themselves as base64 image content blocks so Claude can see them.
 */
async function getPatchImagesContent(
  userId: string,
  patchId: string
): Promise<McpContentBlock[]> {
  const patch = await getPatchById(userId, patchId);
  if (!patch) throw new Error(`Patch '${patchId}' not found`);
  const attachments = await getPatchAttachments(userId, patchId);
  if (attachments.length === 0) {
    return [
      { type: "text", text: `Patch "${patch.title}" has no image attachments.` },
    ];
  }

  const MAX_IMAGES = 8;
  const MAX_BYTES = 5 * 1024 * 1024; // Anthropic per-image cap
  const DOWNSCALE_OVER = 1_500_000; // shrink anything bigger than this
  const imageBlocks: McpContentBlock[] = [];
  const summaryLines: string[] = [];

  // Blobs are private — presign a short-lived GET URL before fetching each one.
  for (const a of attachments.slice(0, MAX_IMAGES)) {
    try {
      const signedUrl = await presignBlobGetUrl(a.pathname);
      const res = await fetch(signedUrl);
      if (!res.ok) {
        summaryLines.push(`- ${a.pathname} (fetch failed: HTTP ${res.status})`);
        continue;
      }
      let outBuf: Buffer = Buffer.from(await res.arrayBuffer());
      let mimeType = a.content_type ?? "image/png";

      // Retina screenshots routinely exceed Anthropic's 5MB/image limit, so
      // downscale large images to ≤1568px (their recommended max) and re-encode
      // as JPEG. Keeps them ingestible and cheap; small images pass through.
      if (outBuf.byteLength > DOWNSCALE_OVER) {
        try {
          outBuf = await sharp(outBuf)
            .rotate()
            .resize({
              width: 1568,
              height: 1568,
              fit: "inside",
              withoutEnlargement: true,
            })
            .jpeg({ quality: 82 })
            .toBuffer();
          mimeType = "image/jpeg";
        } catch {
          // Fall back to the original; the size guard below still applies.
        }
      }

      if (outBuf.byteLength > MAX_BYTES) {
        summaryLines.push(
          `- ${a.pathname} (${(outBuf.byteLength / 1048576).toFixed(
            1
          )}MB — too large to inline even after downscale)`
        );
        continue;
      }

      imageBlocks.push({
        type: "image",
        data: outBuf.toString("base64"),
        mimeType,
      });
      summaryLines.push(`- ${a.pathname}`);
    } catch (err) {
      summaryLines.push(
        `- ${a.pathname} (error: ${
          err instanceof Error ? err.message : String(err)
        })`
      );
    }
  }

  const content: McpContentBlock[] = [
    {
      type: "text",
      text: `${attachments.length} image attachment(s) on patch "${patch.title}":\n${summaryLines.join(
        "\n"
      )}`,
    },
    ...imageBlocks,
  ];
  if (attachments.length > MAX_IMAGES) {
    content.push({
      type: "text",
      text: `(showing the first ${MAX_IMAGES} of ${attachments.length} images)`,
    });
  }
  return content;
}

async function handler(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  const resourceMetadataUrl = `${getBaseUrl()}/.well-known/oauth-protected-resource`;

  if (!token) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl}"`,
      },
    });
  }

  const userId = await getUserIdFromToken(token);
  if (!userId) {
    return new Response("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl}"`,
      },
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — new server per request
    enableJsonResponse: true,
  });

  const server = new Server(
    { name: "chaospatch", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (mcpReq) => {
    const { name, arguments: args = {} } = mcpReq.params;
    try {
      if (!isMcpToolName(name)) throw new Error(`Unknown tool: ${name}`);
      const parsed = MCP_SCHEMAS[name].safeParse(args);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
        return {
          content: [{ type: "text", text: `Invalid arguments for ${name}: ${issues}` }],
          isError: true,
        };
      }
      if (name === "cp_get_patch_images") {
        const a = parsed.data as ParsedArgs<"cp_get_patch_images">;
        const content = await getPatchImagesContent(userId, a.patch_id);
        return { content };
      }
      const result = await handleTool(name, parsed.data as ParsedArgs<McpToolName>, userId);
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handler as GET, handler as POST, handler as DELETE };
