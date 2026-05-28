/**
 * One-time migration: creates the mcp_tokens table.
 * Run with: npx tsx lib/migrate.ts
 */
import { neon } from "@neondatabase/serverless";

// tsx auto-loads .env.local — no manual dotenv import needed

const sql = neon(process.env.DATABASE_URL!);

void (async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS mcp_tokens (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`
    ALTER TABLE patches
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'
  `;
  await sql`
    ALTER TABLE patches
    ADD COLUMN IF NOT EXISTS due_date DATE
  `;
  console.log("Done: mcp_tokens table ready, patches.tags + due_date columns ensured.");
})();
