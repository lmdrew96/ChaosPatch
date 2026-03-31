#!/usr/bin/env node
/**
 * ChaosPatch MCP Server
 * Exposes 8 cp_ tools for managing patches from Claude Code.
 *
 * Usage: npx tsx mcp/index.ts
 * Then add to Claude Code: claude mcp add chaospatch -- npx tsx /path/to/mcp/index.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { neon } from "@neondatabase/serverless";

// ── DB ─────────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = neon(DATABASE_URL);

// ── Tool definitions ───────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "cp_list_projects",
    description: "Get all ChaosPatch projects for a user.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Clerk user ID" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "cp_list_patches",
    description:
      "Get patches for a project, optionally filtered by status (open | in_progress | done).",
    inputSchema: {
      type: "object",
      properties: {
        project_slug: { type: "string" },
        user_id: { type: "string" },
        status: {
          type: "string",
          enum: ["open", "in_progress", "done"],
          description: "Filter by status (optional)",
        },
      },
      required: ["project_slug", "user_id"],
    },
  },
  {
    name: "cp_add_patch",
    description: "Add a new patch to a project.",
    inputSchema: {
      type: "object",
      properties: {
        project_slug: { type: "string" },
        user_id: { type: "string" },
        title: { type: "string", description: "Patch description" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Priority level (default: medium)",
        },
      },
      required: ["project_slug", "user_id", "title"],
    },
  },
  {
    name: "cp_start_patch",
    description: "Set a patch status to in_progress and log started_at.",
    inputSchema: {
      type: "object",
      properties: {
        patch_id: { type: "string", description: "Patch UUID" },
      },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_complete_patch",
    description: "Set a patch status to done and log completed_at.",
    inputSchema: {
      type: "object",
      properties: {
        patch_id: { type: "string", description: "Patch UUID" },
      },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_add_note",
    description: "Append a note to an existing patch.",
    inputSchema: {
      type: "object",
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
      type: "object",
      properties: {
        patch_id: { type: "string", description: "Patch UUID" },
      },
      required: ["patch_id"],
    },
  },
  {
    name: "cp_delete_project",
    description: "Permanently delete a project and all its patches.",
    inputSchema: {
      type: "object",
      properties: {
        project_slug: { type: "string" },
        user_id: { type: "string" },
      },
      required: ["project_slug", "user_id"],
    },
  },
  {
    name: "cp_add_project",
    description: "Create a new ChaosPatch project for a user.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "Clerk user ID" },
        name: { type: "string", description: "Display name of the project" },
        slug: { type: "string", description: "URL-safe unique identifier" },
        color: {
          type: "string",
          description: "Hex accent color (default: #6366f1)",
        },
      },
      required: ["user_id", "name", "slug"],
    },
  },
] as const;

// ── Tool handlers ──────────────────────────────────────────────────────────

type Args = Record<string, string | undefined>;

async function handleTool(name: string, args: Args): Promise<string> {
  switch (name) {
    case "cp_list_projects": {
      const rows = await sql`
        SELECT p.*, COUNT(pa.id) FILTER (WHERE pa.status = 'open') AS open_count
        FROM projects p
        LEFT JOIN patches pa ON pa.project_id = p.id
        WHERE p.user_id = ${args.user_id!}
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `;
      return JSON.stringify(rows, null, 2);
    }

    case "cp_list_patches": {
      if (args.status) {
        const rows = await sql`
          SELECT pa.* FROM patches pa
          JOIN projects p ON p.id = pa.project_id
          WHERE p.user_id = ${args.user_id!} AND p.slug = ${args.project_slug!}
            AND pa.status = ${args.status}
          ORDER BY pa.created_at DESC
        `;
        return JSON.stringify(rows, null, 2);
      }
      const rows = await sql`
        SELECT pa.* FROM patches pa
        JOIN projects p ON p.id = pa.project_id
        WHERE p.user_id = ${args.user_id!} AND p.slug = ${args.project_slug!}
        ORDER BY pa.created_at DESC
      `;
      return JSON.stringify(rows, null, 2);
    }

    case "cp_add_patch": {
      const [project] = await sql`
        SELECT id FROM projects
        WHERE user_id = ${args.user_id!} AND slug = ${args.project_slug!}
        LIMIT 1
      `;
      if (!project) throw new Error(`Project '${args.project_slug}' not found`);

      const priority = args.priority ?? "medium";
      const [patch] = await sql`
        INSERT INTO patches (project_id, title, priority)
        VALUES (${project.id}, ${args.title!}, ${priority})
        RETURNING *
      `;
      return JSON.stringify(patch, null, 2);
    }

    case "cp_start_patch": {
      const now = new Date().toISOString();
      const [patch] = await sql`
        UPDATE patches SET status = 'in_progress', started_at = ${now}
        WHERE id = ${args.patch_id!}
        RETURNING *
      `;
      if (!patch) throw new Error(`Patch '${args.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_complete_patch": {
      const now = new Date().toISOString();
      const [patch] = await sql`
        UPDATE patches SET status = 'done', completed_at = ${now}
        WHERE id = ${args.patch_id!}
        RETURNING *
      `;
      if (!patch) throw new Error(`Patch '${args.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_add_note": {
      const [patch] = await sql`
        UPDATE patches
        SET notes = CASE
          WHEN notes IS NULL THEN ${args.note!}
          ELSE notes || E'\n\n' || ${args.note!}
        END
        WHERE id = ${args.patch_id!}
        RETURNING *
      `;
      if (!patch) throw new Error(`Patch '${args.patch_id}' not found`);
      return JSON.stringify(patch, null, 2);
    }

    case "cp_delete_patch": {
      await sql`DELETE FROM patches WHERE id = ${args.patch_id!}`;
      return `Patch ${args.patch_id} deleted.`;
    }

    case "cp_delete_project": {
      const result = await sql`
        DELETE FROM projects
        WHERE user_id = ${args.user_id!} AND slug = ${args.project_slug!}
        RETURNING id
      `;
      if (result.length === 0) {
        throw new Error(`Project '${args.project_slug}' not found`);
      }
      return `Project '${args.project_slug}' and all its patches deleted.`;
    }

    case "cp_add_project": {
      const color = args.color ?? "#6366f1";
      const [project] = await sql`
        INSERT INTO projects (user_id, name, slug, color)
        VALUES (${args.user_id!}, ${args.name!}, ${args.slug!}, ${color})
        RETURNING *
      `;
      return JSON.stringify(project, null, 2);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Server setup ───────────────────────────────────────────────────────────

const server = new Server(
  { name: "chaospatch", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const result = await handleTool(name, args as Args);
    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
void (async () => { await server.connect(transport); })();
