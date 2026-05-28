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
  updatePatch,
  updateProject,
  reopenPatch,
  getProjectSummary,
  searchPatches,
  batchUpdatePatches,
  getVelocity,
} from "@/lib/queries";
import { getBaseUrl } from "@/lib/oauth";
import { MCP_SCHEMAS, isMcpToolName, type McpToolName } from "@/lib/mcp-schemas";
import type { z } from "zod";

type ParsedArgs<T extends McpToolName> = z.infer<(typeof MCP_SCHEMAS)[T]>;

const TOOLS = [
  {
    name: "cp_list_projects",
    description: "Get all ChaosPatch projects for the authenticated user.",
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
      "Get patches for a project, optionally filtered by status (open | in_progress | done), priority (low | medium | high), and/or tags (returns patches with at least one matching tag). Supports sort_by (priority | created_at — default created_at) and pagination via limit (max 500) and offset.",
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
      },
      required: ["project_slug"],
    },
  },
  {
    name: "cp_list_all_patches",
    description:
      "Get patches across ALL projects for the authenticated user, optionally filtered by status, priority, and/or tags (any-overlap match). Each patch includes project_name, project_slug, and project_color. Supports sort_by (priority | created_at — default created_at) and pagination via limit (max 500) and offset.",
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
      },
    },
  },
  {
    name: "cp_add_patch",
    description:
      "Add a new patch to a project, optionally with initial notes and tags.",
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
          description: "Initial notes to set on the patch (optional)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Free-form tags (e.g. 'bug', 'ui', 'db'). Default: [] (optional)",
        },
      },
      required: ["project_slug", "title"],
    },
  },
  {
    name: "cp_get_patch",
    description:
      "Fetch a single patch by ID. Returns the patch object or an error if not found / not owned by the authenticated user.",
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
      "Update a patch's title, priority, and/or tags. If tags is provided (even as []), it REPLACES the existing tags array; if omitted, tags are left unchanged.",
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
      },
      required: ["patch_id"],
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
    description: "Get open/in_progress/done counts for each project.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "cp_search_patches",
    description:
      "Search patches across all projects by title or notes (case-insensitive).",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search text" },
      },
      required: ["query"],
    },
  },
  {
    name: "cp_get_velocity",
    description:
      "Get patches completed since a given date/time across all projects (most recent first). Returns { completed_since, count, patches }. Each patch includes project_name, project_slug, project_color.",
    inputSchema: {
      type: "object" as const,
      properties: {
        completed_since: {
          type: "string",
          description:
            "ISO 8601 date or datetime — inclusive lower bound for completed_at (e.g. '2026-05-01' or '2026-05-01T00:00:00Z')",
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
        a.offset
      );
      return JSON.stringify(patches, null, 2);
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
        a.offset
      );
      return JSON.stringify(patches, null, 2);
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
        a.tags
      );
      return JSON.stringify(patch, null, 2);
    }

    case "cp_get_patch": {
      const a = args as ParsedArgs<"cp_get_patch">;
      const patch = await getPatchById(userId, a.patch_id);
      if (!patch) throw new Error(`Patch '${a.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

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
      const patch = await updatePatch(userId, a.patch_id, title, priority, a.tags);
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
      const results = await searchPatches(userId, a.query);
      return JSON.stringify(results, null, 2);
    }

    case "cp_get_velocity": {
      const a = args as ParsedArgs<"cp_get_velocity">;
      const result = await getVelocity(userId, a.completed_since);
      return JSON.stringify(result, null, 2);
    }

    case "cp_batch_update": {
      const a = args as ParsedArgs<"cp_batch_update">;
      const result = await batchUpdatePatches(userId, a.patch_ids, a.action);
      return JSON.stringify(result, null, 2);
    }
  }
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
