# Claude Code Instructions for ChaosPatch

> Project-specific instructions. General coding conventions, git workflow, communication style, and identity are in the global CLAUDE.md — don't duplicate them here.

## Project Overview

ChaosPatch is a lightweight dev patch tracker — a PWA for managing project-scoped patches (bugs, fixes, features, refactors) with a built-in MCP server so Claude Code can read and manage patches directly.

**Live:** chaospatch.adhdesigns.dev
**Repo:** github.com/lmdrew96/ChaosPatch

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Framework** | Next.js 16 (App Router) | Vercel deployment |
| **Language** | TypeScript | Strict mode |
| **Styling** | Tailwind CSS 4 + shadcn/ui + Radix UI | `next-themes`, geist font |
| **Database** | Neon Postgres (`@neondatabase/serverless`) | Serverless driver, raw SQL (no ORM) |
| **Auth** | Clerk (`@clerk/nextjs`) | Multi-user support |
| **MCP** | `@modelcontextprotocol/sdk` | MCP server at `/app/mcp/route.ts` |
| **Validation** | Zod | Input validation for MCP tools |

---

## Architecture

### Database
- **No ORM** — this project uses raw SQL via `@neondatabase/serverless`, not Drizzle
- Schema is defined implicitly by the SQL queries and migration scripts
- `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:clean` use `esbuild-register` to run TypeScript scripts directly

### MCP Server
The MCP server is the primary integration point — Claude Code and Claude Desktop use these tools to manage patches across all ADHDesigns projects.

**Tool prefix:** `cp_`

**Current tools:**
- `cp_list_projects` — Get all projects
- `cp_list_patches` — Get patches for a project (filterable by status)
- `cp_add_patch` — Create a new patch
- `cp_add_note` — Append a note to a patch
- `cp_start_patch` — Mark as in_progress
- `cp_complete_patch` — Mark as done
- `cp_add_project` / `cp_delete_project` / `cp_delete_patch` — CRUD
- `cp_search_patches` — Cross-project text search
- `cp_update_patch` — Update title/priority
- `cp_reopen_patch` — Revert done/in_progress to open
- `cp_get_project_summary` — Open/in_progress/done counts per project
- `cp_get_patch` — Fetch a single patch (includes its `attachments`)
- `cp_get_patch_images` — Return a patch's attached images as viewable image content (for visual context) + their URLs

**MCP route:** `app/mcp/route.ts` — Streamable HTTP transport with bearer-token auth

When adding new MCP tools:
- Follow the `cp_` prefix convention
- Validate all inputs with Zod
- Return markdown-formatted responses
- Respect the authenticated user's scope (Clerk user ID)

### PWA Routes
- `/` — Projects overview (all projects with patch counts)
- `/projects/[slug]` — Patch list for a specific project
- `/add` — Quick-add patch form

---

## Build Commands

```bash
pnpm dev              # Next.js dev server
pnpm build            # Production build
pnpm lint             # ESLint (next lint)
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed database with initial data
pnpm db:clean         # Clean database
pnpm test:mcp         # Test MCP server locally
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| DB connection fails | Check `DATABASE_URL` in `.env.local` — must be Neon connection string |
| MCP tools not responding | Check `app/mcp/route.ts` — Streamable HTTP transport, verify bearer token in `Authorization` header |
| New project not appearing | Ensure `cp_add_project` was called with a unique slug |
| Patches showing for wrong user | All queries must filter by Clerk `userId` — never return cross-user data |
