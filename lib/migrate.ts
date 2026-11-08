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
  // End of the range covered by the project's last generated changelog.
  await sql`
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS last_changelog_at TIMESTAMPTZ
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
  // the latest known timestamp, then let a trigger bump it on meaningful
  // UPDATEs so every write path (web, MCP, batch) counts without touching
  // each query.
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
      -- An explicit touch ("still relevant") sets updated_at itself; keep it.
      IF NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN
        RETURN NEW;
      END IF;
      -- Only real work counts as touching a patch. Triage metadata (tags,
      -- priority, due_date, archived) doesn't, so bulk tagging can't hide
      -- stale patches.
      IF (NEW.status, NEW.title, NEW.notes, NEW.spec)
         IS DISTINCT FROM (OLD.status, OLD.title, OLD.notes, OLD.spec) THEN
        NEW.updated_at = now();
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;
  await sql`
    CREATE OR REPLACE TRIGGER patches_touch_updated_at
    BEFORE UPDATE ON patches
    FOR EACH ROW EXECUTE FUNCTION patches_touch_updated_at()
  `;
  // 'review' sits between in_progress and done: finished, awaiting Nae's look.
  await sql`
    ALTER TABLE patches DROP CONSTRAINT IF EXISTS patches_status_check
  `;
  await sql`
    ALTER TABLE patches ADD CONSTRAINT patches_status_check
    CHECK (status IN ('open', 'in_progress', 'review', 'done'))
  `;
  // Checklist Nae ticks off while reviewing: [{ "text": string, "done": boolean }].
  // Not in the updated_at trigger — ticking steps is review, not work.
  await sql`
    ALTER TABLE patches
    ADD COLUMN IF NOT EXISTS review_steps JSONB NOT NULL DEFAULT '[]'::jsonb
  `;
  // When the patch last entered review. Insights uses it for "days waiting"
  // and wait-vs-work phases. Set by a trigger so every write path (web, MCP,
  // batch) counts. Kept through review → done; cleared when work resumes
  // (back to open/in_progress). No backfill: rows reviewed before this column
  // existed stay NULL and Insights falls back to updated_at, marked approximate.
  await sql`
    ALTER TABLE patches
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ
  `;
  await sql`
    CREATE OR REPLACE FUNCTION patches_set_reviewed_at() RETURNS trigger AS $$
    BEGIN
      IF NEW.status = 'review'
         AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'review') THEN
        NEW.reviewed_at = now();
      ELSIF NEW.status IN ('open', 'in_progress') THEN
        NEW.reviewed_at = NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;
  await sql`
    CREATE OR REPLACE TRIGGER patches_set_reviewed_at
    BEFORE INSERT OR UPDATE OF status ON patches
    FOR EACH ROW EXECUTE FUNCTION patches_set_reviewed_at()
  `;
  // ── Specs ──────────────────────────────────────────────────────────────
  // A spec can exist before any project (draft) and be attached later
  // (linked). status is generated from project_id so it can't drift.
  // A project can have many specs (big-picture + feature specs); at most one
  // is_primary per project (partial unique index below). Deleting a project
  // detaches its specs instead of deleting them. Detach code also clears
  // is_primary — no CHECK for it, since ON DELETE SET NULL would trip one.
  await sql`
    CREATE TABLE IF NOT EXISTS specs (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    TEXT NOT NULL,
      title      TEXT NOT NULL,
      project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      status     TEXT GENERATED ALWAYS AS
                   (CASE WHEN project_id IS NULL THEN 'draft' ELSE 'linked' END) STORED,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS specs_user_id_idx ON specs(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS specs_project_id_idx ON specs(project_id)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS specs_one_primary_per_project
      ON specs(project_id) WHERE is_primary
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS spec_sections (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      spec_id    UUID NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
      position   INTEGER NOT NULL,
      heading    TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS spec_sections_spec_id_idx
      ON spec_sections(spec_id, position)
  `;
  // One row per section write. section_id survives as NULL after a delete so
  // the history (including the delete itself) stays readable per spec.
  await sql`
    CREATE TABLE IF NOT EXISTS spec_revisions (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      spec_id        UUID NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
      section_id     UUID REFERENCES spec_sections(id) ON DELETE SET NULL,
      kind           TEXT NOT NULL CHECK (kind IN ('create', 'edit', 'delete')),
      author         TEXT NOT NULL CHECK (author IN ('nae', 'coru', 'cody', 'app')),
      before_heading TEXT,
      after_heading  TEXT,
      before_body    TEXT,
      after_body     TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS spec_revisions_section_idx
      ON spec_revisions(section_id, created_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS spec_revisions_spec_idx
      ON spec_revisions(spec_id, created_at)
  `;
  // The spec section a patch was generated from / belongs to.
  await sql`
    ALTER TABLE patches
    ADD COLUMN IF NOT EXISTS spec_section_id UUID
      REFERENCES spec_sections(id) ON DELETE SET NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS patches_spec_section_id_idx
      ON patches(spec_section_id) WHERE spec_section_id IS NOT NULL
  `;
  // Specs 5/5: when a linked section's body changes, its patches get stamped
  // (in updateSpecSection). The stamp clears when Nae dismisses it or the
  // patch itself is edited (title/notes/spec) by any path — this trigger.
  // Status changes don't clear it: starting a patch is exactly when the
  // warning matters. Not in patches_touch_updated_at: a spec edit isn't
  // work on the patch.
  await sql`
    ALTER TABLE patches
    ADD COLUMN IF NOT EXISTS spec_changed_at TIMESTAMPTZ
  `;
  await sql`
    CREATE OR REPLACE FUNCTION patches_clear_spec_changed() RETURNS trigger AS $$
    BEGIN
      IF NEW.spec_changed_at IS NOT DISTINCT FROM OLD.spec_changed_at
         AND (NEW.title, NEW.notes, NEW.spec)
             IS DISTINCT FROM (OLD.title, OLD.notes, OLD.spec) THEN
        NEW.spec_changed_at = NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;
  await sql`
    CREATE OR REPLACE TRIGGER patches_clear_spec_changed
    BEFORE UPDATE ON patches
    FOR EACH ROW EXECUTE FUNCTION patches_clear_spec_changed()
  `;
  console.log(
    "Done: mcp_tokens + patch_attachments + specs + spec_sections + spec_revisions tables ready, patches.tags + due_date + archived + spec + updated_at + review_steps + reviewed_at + spec_section_id + spec_changed_at (+ review status) and projects.archived + archived_at + last_changelog_at columns ensured."
  );
})();
