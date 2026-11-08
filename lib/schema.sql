CREATE TABLE IF NOT EXISTS projects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  color      TEXT DEFAULT '#6366f1',
  archived   BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  last_changelog_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, slug)
);

CREATE TABLE IF NOT EXISTS patches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  status       TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'review', 'done')),
  priority     TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  notes        TEXT,
  spec         TEXT,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Specs: see lib/migrate.ts for the reasoning behind each constraint.
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
);

-- At most one primary (big-picture) spec per project.
CREATE UNIQUE INDEX IF NOT EXISTS specs_one_primary_per_project
  ON specs(project_id) WHERE is_primary;

CREATE TABLE IF NOT EXISTS spec_sections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id    UUID NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  heading    TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
);

-- patches.spec_section_id (added by lib/migrate.ts): UUID REFERENCES spec_sections(id) ON DELETE SET NULL
-- patches.spec_changed_at (added by lib/migrate.ts): TIMESTAMPTZ, "spec changed since written" marker

CREATE TABLE IF NOT EXISTS patch_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id     UUID NOT NULL REFERENCES patches(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  pathname     TEXT NOT NULL,
  content_type TEXT,
  size         INTEGER,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patch_attachments_patch_id_idx
  ON patch_attachments(patch_id);

CREATE TABLE IF NOT EXISTS mcp_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id     TEXT PRIMARY KEY,
  client_secret TEXT,
  redirect_uris TEXT[] NOT NULL,
  client_name   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code            TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES oauth_clients(client_id),
  user_id         TEXT NOT NULL,
  redirect_uri    TEXT NOT NULL,
  code_challenge  TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
