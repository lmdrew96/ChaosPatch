import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "@/lib/r2";

export const MCP_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

const priority = z.enum(["low", "medium", "high"]);
const status = z.enum(["open", "in_progress", "review", "done"]);
const tags = z.array(z.string());
const sortBy = z.enum(["priority", "created_at"]);
const limit = z.number().int().positive().max(500);
const offset = z.number().int().nonnegative();
const isoDate = z
  .string()
  .min(1)
  .refine((v) => /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v)), {
    message: "must be an ISO date (YYYY-MM-DD)",
  });
const uuid = z.uuid({ message: "must be a UUID" });
// MCP writers only — Nae writes in the app. "nae" is never accepted here so
// an AI write can't be attributed to her (Specs 3/5).
const specAuthor = z.enum(["coru", "cody"]).optional();
const sectionInput = z.object({
  heading: z.string().trim().min(1),
  body: z.string().optional(),
  reference_only: z.boolean().optional(),
});

export const MCP_SCHEMAS = {
  cp_list_projects: z.object({
    include_archived: z.boolean().optional(),
  }),
  cp_add_project: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    color: z.string().optional(),
  }),
  cp_list_patches: z.object({
    project_slug: z.string().min(1),
    status: status.optional(),
    priority: priority.optional(),
    tags: tags.optional(),
    sort_by: sortBy.optional(),
    limit: limit.optional(),
    offset: offset.optional(),
    due_before: isoDate.optional(),
    include_archived: z.boolean().optional(),
  }),
  cp_list_all_patches: z.object({
    status: status.optional(),
    priority: priority.optional(),
    tags: tags.optional(),
    sort_by: sortBy.optional(),
    limit: limit.optional(),
    offset: offset.optional(),
    due_before: isoDate.optional(),
    include_archived: z.boolean().optional(),
  }),
  cp_add_patch: z.object({
    project_slug: z.string().min(1),
    title: z.string().min(1),
    priority: priority.optional(),
    notes: z.string().optional(),
    spec: z.string().optional(),
    tags: tags.optional(),
    due_date: isoDate.optional(),
    spec_section_id: uuid.optional(),
  }),
  cp_get_patch: z.object({
    patch_id: z.string().min(1),
  }),
  cp_get_patch_images: z.object({
    patch_id: z.string().min(1),
  }),
  cp_request_image_upload: z.object({
    patch_id: z.string().min(1),
    filename: z.string().trim().min(1).max(200),
    content_type: z.enum(MCP_IMAGE_TYPES, {
      message: `content_type must be one of: ${MCP_IMAGE_TYPES.join(", ")}`,
    }),
    size_bytes: z
      .number()
      .int()
      .positive()
      .max(MAX_UPLOAD_BYTES, {
        message: `size_bytes exceeds the ${MAX_UPLOAD_BYTES / 1048576}MB image limit`,
      }),
  }),
  cp_confirm_image_upload: z.object({
    upload_id: z.string().min(1),
  }),
  cp_start_patch: z.object({
    patch_id: z.string().min(1),
  }),
  cp_request_review: z.object({
    patch_id: z.string().min(1),
    note: z.string().min(1).optional(),
    review_steps: z.array(z.string().trim().min(1)).min(1).optional(),
  }),
  cp_set_review_steps: z.object({
    patch_id: z.string().min(1),
    steps: z.array(
      z.object({
        text: z.string().trim().min(1),
        done: z.boolean().optional(),
      })
    ),
  }),
  cp_complete_patch: z.object({
    patch_id: z.string().min(1),
    note: z.string().min(1).optional(),
  }),
  cp_add_note: z.object({
    patch_id: z.string().min(1),
    note: z.string().min(1),
  }),
  cp_delete_patch: z.object({
    patch_id: z.string().min(1),
  }),
  cp_delete_project: z.object({
    project_slug: z.string().min(1),
  }),
  cp_update_patch: z.object({
    patch_id: z.string().min(1),
    title: z.string().optional(),
    priority: priority.optional(),
    tags: tags.optional(),
    due_date: isoDate.nullable().optional(),
    spec: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    spec_section_id: uuid.nullable().optional(),
    dismiss_spec_change: z.literal(true).optional(),
  }),
  cp_add_tags: z.object({
    patch_id: z.string().min(1),
    tags: z.array(z.string().min(1)).min(1),
  }),
  cp_remove_tags: z.object({
    patch_id: z.string().min(1),
    tags: z.array(z.string().min(1)).min(1),
  }),
  cp_update_project: z.object({
    project_slug: z.string().min(1),
    slug: z.string().min(1).optional(),
    name: z.string().optional(),
    color: z.string().optional(),
  }),
  cp_reopen_patch: z.object({
    patch_id: z.string().min(1),
    status: z.enum(["open", "in_progress"]).optional(),
  }),
  cp_get_project_summary: z.object({
    include_archived: z.boolean().optional(),
  }),
  cp_archive_project: z.object({
    project_slug: z.string().min(1),
    force: z.boolean().optional(),
  }),
  cp_unarchive_project: z.object({
    project_slug: z.string().min(1),
  }),
  cp_search_patches: z.object({
    query: z.string().min(1),
    include_archived: z.boolean().optional(),
    project_slug: z.string().min(1).optional(),
    status: status.optional(),
  }),
  cp_archive_completed: z.object({
    project_slug: z.string().min(1).optional(),
  }),
  cp_unarchive_patch: z.object({
    patch_id: z.string().min(1),
  }),
  cp_get_velocity: z.object({
    completed_since: z
      .string()
      .min(1)
      .refine((v) => !Number.isNaN(Date.parse(v)), {
        message: "must be a parseable date/time (ISO 8601 recommended)",
      }),
    include_archived: z.boolean().optional(),
  }),
  cp_batch_update: z
    .object({
      patch_ids: z.array(z.string().min(1)).min(1),
      action: z.enum([
        "start",
        "review",
        "complete",
        "reopen",
        "archive",
        "delete",
        "set_priority",
        "add_tags",
        "dismiss_spec_change",
      ]),
      priority: z.enum(["low", "medium", "high"]).optional(),
      tags: z.array(z.string().trim().min(1)).optional(),
    })
    .refine((a) => a.action !== "set_priority" || a.priority !== undefined, {
      message: "priority is required when action is 'set_priority'",
      path: ["priority"],
    })
    .refine((a) => a.action !== "add_tags" || (a.tags?.length ?? 0) > 0, {
      message: "tags (non-empty) is required when action is 'add_tags'",
      path: ["tags"],
    }),
  cp_list_specs: z.object({
    project_slug: z.string().min(1).optional(),
  }),
  cp_get_spec: z
    .object({
      spec_id: uuid.optional(),
      project_slug: z.string().min(1).optional(),
    })
    .refine((a) => a.spec_id !== undefined || a.project_slug !== undefined, {
      message: "pass spec_id or project_slug",
    }),
  cp_create_spec: z.object({
    title: z.string().trim().min(1),
    project_slug: z.string().min(1).optional(),
    is_primary: z.boolean().optional(),
    sections: z.array(sectionInput).optional(),
    author: specAuthor,
  }),
  cp_update_spec: z.object({
    spec_id: uuid,
    title: z.string().trim().min(1).optional(),
    project_slug: z.string().min(1).nullable().optional(),
    is_primary: z.boolean().optional(),
  }),
  cp_delete_spec: z.object({
    spec_id: uuid,
  }),
  cp_add_spec_section: z.object({
    spec_id: uuid,
    heading: z.string().trim().min(1),
    body: z.string().optional(),
    reference_only: z.boolean().optional(),
    author: specAuthor,
  }),
  cp_update_spec_section: z
    .object({
      section_id: uuid,
      heading: z.string().trim().min(1).optional(),
      body: z.string().optional(),
      reference_only: z.boolean().optional(),
      author: specAuthor,
    })
    .refine(
      (a) => a.heading !== undefined || a.body !== undefined || a.reference_only !== undefined,
      { message: "pass heading, body, and/or reference_only" }
    ),
  cp_delete_spec_section: z.object({
    section_id: uuid,
    author: specAuthor,
  }),
  cp_reorder_spec_sections: z.object({
    spec_id: uuid,
    section_ids: z.array(uuid).min(1),
  }),
  cp_propose_patches_from_spec: z.object({
    spec_id: uuid,
    section_ids: z.array(uuid).min(1).optional(),
    pending_titles: z.array(z.string().trim().min(1)).max(500).optional(),
  }),
  cp_get_spec_history: z.object({
    spec_id: uuid,
    section_id: uuid.optional(),
    limit: z.number().int().positive().max(500).optional(),
  }),
} as const;

export type McpToolName = keyof typeof MCP_SCHEMAS;

export function isMcpToolName(name: string): name is McpToolName {
  return name in MCP_SCHEMAS;
}
