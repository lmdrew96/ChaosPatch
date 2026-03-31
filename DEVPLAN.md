# 🩹 ChaosPatch — Dev Plan

> ADHDesigns · v1.0 · 2026

---

## Overview

ChaosPatch is a lightweight, project-scoped patch tracking tool for developers. It connects a clean PWA to a Claude Code MCP server — so you can manage bug fixes, feature patches, and refactors from both a browser UI *and* directly inside a Claude Code session.

Part of the ADHDesigns **Chaos ecosystem** alongside ControlledChaos, ChaosLimbă, and Cha(t)os.

---

## Goals & Scope

### MVP Goals
- Track dev patches organized by project
- Manage patches from Claude Code via MCP tools (`cp_` prefix)
- Access from any device via PWA + Clerk auth
- Multi-user ready from day one

### Out of Scope (MVP)
- Team collaboration / shared projects
- GitHub integration
- Notifications or reminders
- Time tracking

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Database | Neon (Postgres) | Hosted Postgres. Migrate to Convex later if real-time sync needed. |
| API | Next.js API Routes | Simple REST endpoints. No separate backend needed. |
| Frontend | Next.js PWA | Installable on mobile and desktop. |
| Auth | Clerk | `user_id` ties data to identity across devices. |
| MCP Server | Node / TypeScript | Connects Claude Code to ChaosPatch via 6 tools. |
| Hosting | Vercel | Same as all other ADHDesigns projects. |

---

## Database Schema

### `projects`

```sql
CREATE TABLE projects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  color      TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, slug)
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | TEXT | Clerk user ID — all queries filter by this |
| `name` | TEXT | Display name (e.g. "ChaosLimbă") |
| `slug` | TEXT | URL + MCP identifier. Unique per user. |
| `color` | TEXT | Hex color for PWA project card |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |

### `patches`

```sql
CREATE TABLE patches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  status       TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  priority     TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `project_id` | UUID | FK → projects. Cascades on delete. |
| `title` | TEXT | The patch task description |
| `status` | TEXT | `open` \| `in_progress` \| `done` |
| `priority` | TEXT | `low` \| `medium` \| `high` |
| `notes` | TEXT | Optional context, added by user or Claude Code |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `started_at` | TIMESTAMPTZ | Set when status → `in_progress` |
| `completed_at` | TIMESTAMPTZ | Set when status → `done` |

---

## MCP Server Tools

All tools prefixed `cp_`. `user_id` maps to the authenticated Clerk user.

| Tool | Args | Description |
|---|---|---|
| `cp_list_projects` | `user_id` | Get all projects for a user |
| `cp_list_patches` | `project_slug`, `user_id`, `status?` | Get patches for a project (optionally filter by status) |
| `cp_add_patch` | `project_slug`, `user_id`, `title`, `priority?` | Add a new patch to a project |
| `cp_start_patch` | `patch_id` | Set patch status → `in_progress`, log `started_at` |
| `cp_complete_patch` | `patch_id` | Set patch status → `done`, log `completed_at` |
| `cp_add_note` | `patch_id`, `note` | Append a note to an existing patch |
| `cp_delete_patch` | `patch_id` | Permanently delete a patch |
| `cp_delete_project` | `project_slug`, `user_id` | Permanently delete a project and all its patches |

---

## PWA Routes

| Route | Purpose |
|---|---|
| `/` | Projects overview — grid of project cards with open patch count |
| `/projects/[slug]` | Patch list for a project — grouped by status |
| `/add` | Quick-add a patch — project select, title, priority |
| `/settings` | User profile, sign-out. Required landing point for Clerk auth flows. |

---

## Repo Structure

```
chaospatch/
├── app/
│   ├── page.tsx                  # / — projects overview
│   ├── projects/
│   │   └── [slug]/
│   │       └── page.tsx          # /projects/:slug
│   └── add/
│       └── page.tsx              # /add
├── lib/
│   └── db.ts                     # Neon client
├── mcp/
│   └── index.ts                  # MCP server (cp_ tools)
│                                  # Note: co-located with the Next.js app for MVP simplicity.
│                                  # Can be extracted to a standalone package if needed later.
├── proxy.ts                      # Clerk auth middleware (Next.js 16 — replaces middleware.ts)
└── manifest.json                 # PWA manifest
```

---

## Migration Path (Neon → Convex)

ChaosPatch uses Neon for simplicity. If real-time sync becomes a need later:

1. Export Neon data as JSON
2. Write equivalent Convex schema (2 tables = low effort)
3. Run one-time import script
4. Swap MCP tools from SQL queries → Convex functions

Estimated effort: a few hours.

---

## Domain

`chaospatch.adhdesigns.dev`
