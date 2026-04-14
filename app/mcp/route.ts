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
} from "@/lib/queries";
import { getBaseUrl } from "@/lib/oauth";

type Args = Record<string, string | undefined>;

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
      "Get patches for a project, optionally filtered by status (open | in_progress | done).",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_slug: { type: "string" },
        status: {
          type: "string",
          enum: ["open", "in_progress", "done"],
          description: "Filter by status (optional)",
        },
      },
      required: ["project_slug"],
    },
  },
  {
    name: "cp_add_patch",
    description: "Add a new patch to a project.",
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
      },
      required: ["project_slug", "title"],
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
    description: "Set a patch status to done and log completed_at.",
    inputSchema: {
      type: "object" as const,
      properties: { patch_id: { type: "string", description: "Patch UUID" } },
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
    description: "Update a patch's title and/or priority.",
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
];

async function handleTool(
  name: string,
  args: Args,
  userId: string
): Promise<string> {
  switch (name) {
    case "cp_list_projects": {
      const projects = await getProjects(userId);
      return JSON.stringify(projects, null, 2);
    }

    case "cp_add_project": {
      const project = await createProject(userId, args.name!, args.slug!, args.color);
      return JSON.stringify(project, null, 2);
    }

    case "cp_list_patches": {
      const status = args.status as "open" | "in_progress" | "done" | undefined;
      const patches = await getPatches(userId, args.project_slug!, status);
      return JSON.stringify(patches, null, 2);
    }

    case "cp_add_patch": {
      const project = await getProjectBySlug(userId, args.project_slug!);
      if (!project) throw new Error(`Project '${args.project_slug}' not found`);
      const priority = (args.priority as "low" | "medium" | "high") ?? "medium";
      const patch = await createPatch(project.id, args.title!, priority);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_start_patch": {
      const patch = await updatePatchStatus(args.patch_id!, "in_progress");
      return JSON.stringify(patch, null, 2);
    }

    case "cp_complete_patch": {
      const patch = await updatePatchStatus(args.patch_id!, "done");
      return JSON.stringify(patch, null, 2);
    }

    case "cp_add_note": {
      const patch = await addNote(args.patch_id!, args.note!);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_delete_patch": {
      await deletePatch(args.patch_id!);
      return `Patch ${args.patch_id} deleted.`;
    }

    case "cp_delete_project": {
      await deleteProject(userId, args.project_slug!);
      return `Project '${args.project_slug}' and all its patches deleted.`;
    }

    case "cp_update_patch": {
      const existing = await getPatchById(args.patch_id!);
      if (!existing) throw new Error(`Patch '${args.patch_id}' not found`);
      const title = args.title ?? existing.title;
      const priority = (args.priority as "low" | "medium" | "high") ?? existing.priority;
      const patch = await updatePatch(args.patch_id!, title, priority);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_update_project": {
      const existing = await getProjectBySlug(userId, args.project_slug!);
      if (!existing) throw new Error(`Project '${args.project_slug}' not found`);
      const projectName = args.name ?? existing.name;
      const color = args.color ?? existing.color;
      const project = await updateProject(userId, args.project_slug!, projectName, color);
      return JSON.stringify(project, null, 2);
    }

    case "cp_reopen_patch": {
      const status = (args.status as "open" | "in_progress") ?? "open";
      const patch = await reopenPatch(args.patch_id!, status);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_get_project_summary": {
      const summary = await getProjectSummary(userId);
      return JSON.stringify(summary, null, 2);
    }

    case "cp_search_patches": {
      const results = await searchPatches(userId, args.query!);
      return JSON.stringify(results, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
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
      const result = await handleTool(name, args as Args, userId);
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
