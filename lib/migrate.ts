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
  // Archived projects are hidden from the board but keep their history.
  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE
  `;
  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
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
  // updated_at = "last touched", for stale-patch notifications. Backfill from
  // the latest known timestamp, then let a trigger bump it on every UPDATE so
  // every write path (web, MCP, batch) counts without touching each query.
  await sql`
    ALTER TABLE patches
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
  `;
  await sql`
    UPDATE patches
    SET updated_at = GREATEST(created_at, started_at, completed_at)
    WHERE updated_at IS NULL
  `;
  await sql`
    ALTER TABLE patches
    ALTER COLUMN updated_at SET DEFAULT now(),
    ALTER COLUMN updated_at SET NOT NULL
  `;
  await sql`
    CREATE OR REPLACE FUNCTION patches_touch_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;
  await sql`
    CREATE OR REPLACE TRIGGER patches_touch_updated_at
    BEFORE UPDATE ON patches
    FOR EACH ROW EXECUTE FUNCTION patches_touch_updated_at()
  `;
  console.log(
    "Done: mcp_tokens + patch_attachments tables ready, patches.tags + due_date + archived + spec + updated_at and projects.archived + archived_at columns ensured."
  );
})();
