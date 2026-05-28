import { z } from "zod";

const priority = z.enum(["low", "medium", "high"]);
const status = z.enum(["open", "in_progress", "done"]);
const tags = z.array(z.string());
const sortBy = z.enum(["priority", "created_at"]);
const limit = z.number().int().positive().max(500);
const offset = z.number().int().nonnegative();

export const MCP_SCHEMAS = {
  cp_list_projects: z.object({}),
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
  }),
  cp_list_all_patches: z.object({
    status: status.optional(),
    priority: priority.optional(),
    tags: tags.optional(),
    sort_by: sortBy.optional(),
    limit: limit.optional(),
    offset: offset.optional(),
  }),
  cp_add_patch: z.object({
    project_slug: z.string().min(1),
    title: z.string().min(1),
    priority: priority.optional(),
    notes: z.string().optional(),
    tags: tags.optional(),
  }),
  cp_get_patch: z.object({
    patch_id: z.string().min(1),
  }),
  cp_start_patch: z.object({
    patch_id: z.string().min(1),
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
  }),
  cp_update_project: z.object({
    project_slug: z.string().min(1),
    name: z.string().optional(),
    color: z.string().optional(),
  }),
  cp_reopen_patch: z.object({
    patch_id: z.string().min(1),
    status: z.enum(["open", "in_progress"]).optional(),
  }),
  cp_get_project_summary: z.object({}),
  cp_search_patches: z.object({
    query: z.string().min(1),
  }),
  cp_batch_update: z.object({
    patch_ids: z.array(z.string().min(1)).min(1),
    action: z.enum(["start", "complete", "reopen"]),
  }),
} as const;

export type McpToolName = keyof typeof MCP_SCHEMAS;

export function isMcpToolName(name: string): name is McpToolName {
  return name in MCP_SCHEMAS;
}
