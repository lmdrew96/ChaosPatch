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

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "chaospatch": {
      "command": "node",
      "args": ["path/to/chaospatch/mcp/index.js"],
      "env": {
        "DATABASE_URL": "your_neon_connection_string"
      }
    }
  }
}
```

---

## MCP Tools

Once connected, Claude Code can use these tools in any session:

| Tool | What it does |
|---|---|
| `cp_list_projects` | See all your dev projects |
| `cp_list_patches` | Get patches for a project (filter by status) |
| `cp_add_patch` | Add a new patch to a project |
| `cp_start_patch` | Mark a patch as in progress |
| `cp_complete_patch` | Mark a patch as done |
| `cp_add_note` | Add a note to an existing patch |

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
│   └── add/page.tsx
├── lib/
│   ├── db.ts
│   └── schema.sql
├── mcp/
│   └── index.ts
├── middleware.ts
└── manifest.json
```

---

## Roadmap

- [ ] MVP: projects + patches + MCP tools
- [ ] PWA manifest + install prompt
- [ ] GitHub issue sync
- [ ] Shared projects (team mode)

---

## Part of the Chaos Ecosystem

| App | Purpose |
|---|---|
| [ControlledChaos](https://controlledchaos.adhdesigns.dev) | ADHD-friendly task manager |
| [ChaosLimbă](https://chaoslimba.adhdesigns.dev) | English → Romanian CALL platform |
| [Cha(t)os](https://github.com/lmdrew96) | BYOK group chat with Claude instances |
| **ChaosPatch** | Dev patch tracker + Claude Code MCP |

---

Built with 🩹 by [ADHDesigns](https://adhdesigns.dev)
