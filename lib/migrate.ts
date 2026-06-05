/**
 * One-time migration: creates the mcp_tokens table.
 * Run with: pnpm db:migrate
 */
import { neon } from "@neondatabase/serverless";

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
  await sql`
    ALTER TABLE patches
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE patches
    ADD COLUMN IF NOT EXISTS spec TEXT
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS patch_attachments (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patch_id     UUID NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
      url          TEXT NOT NULL,
      pathname     TEXT NOT NULL,
      content_type TEXT,
      size         INTEGER,
      created_at   TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS patch_attachments_patch_id_idx
      ON patch_attachments(patch_id)
  `;
  console.log(
    "Done: mcp_tokens + patch_attachments tables ready, patches.tags + due_date + archived + spec columns ensured."
  );
})();
