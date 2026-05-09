# 🩹 ChaosPatch

> Dev patch tracking — in your browser and in your Claude Code session.

**ChaosPatch** is a project-scoped patch tracker built for developers. Log bugs, fixes, and refactors as patches, organize them by project, and let Claude Code read and update your list mid-session via MCP.

Part of the [ADHDesigns](https://adhdesigns.dev) Chaos ecosystem.

---

## Features

- 📁 **Project-scoped** — patches organized by dev project
- 🤖 **Claude Code integration** — read, add, and complete patches directly from your Claude Code session via MCP
- 🌐 **PWA** — installable on mobile and desktop, works cross-device
- 👤 **Multi-user** — Clerk auth ties your data to you, not a device
- ⚡ **Lightweight** — two database tables, no bloat

---

## Stack

- **Next.js** (PWA)
- **Neon** (Postgres)
- **Clerk** (Auth)
- **TypeScript** MCP server
- **Vercel** (Hosting)

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/lmdrew96/chaospatch.git
cd chaospatch
npm install
```

### 2. Set up environment variables

Create a `.env.local` file:

```env
# Neon
DATABASE_URL=your_neon_connection_string

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### 3. Run the database migrations

```bash
# Run the schema SQL against your Neon database
psql $DATABASE_URL -f lib/schema.sql
```

### 4. Start the dev server

```bash
npm run dev
```

### 5. Connect the MCP server to Claude Code

ChaosPatch ships an OAuth-discoverable HTTP MCP endpoint at `https://chaospatch.adhdesigns.dev/mcp` (Streamable HTTP transport, bearer-token auth).

1. Sign in to chaospatch.adhdesigns.dev and visit `/settings` to mint a personal MCP token.
2. Add the remote server to Claude Code:

   ```bash
   claude mcp add --transport http chaospatch https://chaospatch.adhdesigns.dev/mcp \
     --header "Authorization: Bearer YOUR_TOKEN"
   ```

   Or in `~/.claude.json`:

   ```json
   {
     "mcpServers": {
       "chaospatch": {
         "type": "http",
         "url": "https://chaospatch.adhdesigns.dev/mcp",
         "headers": { "Authorization": "Bearer YOUR_TOKEN" }
       }
     }
   }
   ```

For local development against your own deployment, swap the URL for `http://localhost:3000/mcp`.

---

## MCP Tools

Once connected, Claude Code can use these tools in any session:

| Tool | What it does |
|---|---|
| `cp_list_projects` | List all your projects |
| `cp_add_project` | Create a new project |
| `cp_update_project` | Rename or recolor a project |
| `cp_delete_project` | Delete a project and all its patches |
| `cp_list_patches` | Get patches for a project (filter by status/priority) |
| `cp_list_all_patches` | Get patches across every project |
| `cp_add_patch` | Add a new patch with optional initial notes |
| `cp_update_patch` | Update a patch's title and/or priority |
| `cp_start_patch` | Mark a patch as in progress |
| `cp_complete_patch` | Mark a patch as done |
| `cp_reopen_patch` | Revert a done/in-progress patch back to open |
| `cp_delete_patch` | Delete a patch |
| `cp_add_note` | Append a note to an existing patch |
| `cp_search_patches` | Search titles + notes across projects |
| `cp_get_project_summary` | Per-project open / in-progress / done counts |
| `cp_batch_update` | Bulk start/complete/reopen multiple patches |

---

## PWA Routes

| Route | Page |
|---|---|
| `/` | Projects overview |
| `/projects/[slug]` | Patch list for a project |
| `/add` | Quick-add a patch |

---

## Project Structure

```
chaospatch/
├── app/
│   ├── page.tsx
│   ├── projects/[slug]/page.tsx
│   ├── add/page.tsx
│   ├── api/patches/[id]/route.ts
│   └── mcp/route.ts
├── lib/
│   ├── db.ts
│   ├── queries.ts
│   ├── mcp-schemas.ts
│   ├── oauth.ts
│   └── schema.sql
├── proxy.ts
└── public/manifest.json
```

---

## Roadmap

- [x] MVP: projects + patches + MCP tools
- [x] PWA manifest + install prompt
- [ ] GitHub issue sync
- [ ] Shared projects (team mode)

---

## Part of the Chaos Ecosystem

| App | Purpose |
|---|---|
| [ControlledChaos](https://controlledchaos.adhdesigns.dev) | ADHD-friendly task manager |
| [ChaosLimbă](https://chaoslimba.adhdesigns.dev) | English → Romanian CALL platform |
| [Cha(t)os](https://chatos.adhdesigns.dev) | BYOK group chat with Claude instances |
| [ChaosPatch](https://chaospatch.adhdesigns.dev) | Dev patch tracker + Claude Code MCP |

---

Built with 🩹 by [ADHDesigns](https://adhdesigns.dev)
