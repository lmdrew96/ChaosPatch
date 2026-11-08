import { sql } from "./db";
import type { Patch } from "./queries";

// ── Types ──────────────────────────────────────────────────────────────────

// Who made a spec write. "app" = in-app generation (Specs 4/5), not a person.
export const SPEC_AUTHORS = ["nae", "coru", "cody", "app"] as const;
export type SpecAuthor = (typeof SPEC_AUTHORS)[number];

export type Spec = {
  id: string;
  user_id: string;
  title: string;
  // NULL = draft (no project yet). A project can have many specs.
  project_id: string | null;
  // The project's big-picture spec. At most one per project (DB index).
  is_primary: boolean;
  // Generated from project_id in the DB: never write it.
  status: "draft" | "linked";
  created_at: string;
  updated_at: string;
};

export type SpecListRow = Spec & {
  project_name: string | null;
  project_slug: string | null;
  section_count: number;
};

export type SpecSection = {
  id: string;
  spec_id: string;
  position: number;
  heading: string;
  body: string;
  created_at: string;
  updated_at: string;
  // From the newest spec_revisions row for this section.
  last_author: SpecAuthor | null;
  last_edited_at: string | null;
};

export type SpecLinkedPatch = Pick<
  Patch,
  "id" | "title" | "status" | "priority" | "created_at"
> & { spec_section_id: string };

export type SpecSectionWithPatches = SpecSection & {
  patches: SpecLinkedPatch[];
};

export type SpecDetail = SpecListRow & {
  sections: SpecSectionWithPatches[];
};

export type SpecRevision = {
  id: string;
  spec_id: string;
  // NULL once the section is deleted (the delete itself is a revision).
  section_id: string | null;
  kind: "create" | "edit" | "delete";
  author: SpecAuthor;
  before_heading: string | null;
  after_heading: string | null;
  before_body: string | null;
  after_body: string | null;
  created_at: string;
};

// New specs start from this template; every section can be renamed,
// removed, or reordered, and more can be added (Nae, Nov 7).
export const DEFAULT_SPEC_SECTIONS = [
  "Overview / why",
  "Users & goals",
  "Core features",
  "Out of scope",
  "Data model",
  "Design notes",
  "Open questions",
] as const;

/** A user-fixable spec problem — surface its message as-is. */
export class SpecError extends Error {}

// ── Reads ──────────────────────────────────────────────────────────────────

/** Specs for the user, primary first, then most recently edited. */
export async function listSpecs(
  userId: string,
  projectSlug?: string
): Promise<SpecListRow[]> {
  const slugFilter = projectSlug ?? null;
  const rows = await sql`
    SELECT s.*, p.name AS project_name, p.slug AS project_slug,
      (SELECT COUNT(*) FROM spec_sections ss WHERE ss.spec_id = s.id)::int AS section_count
    FROM specs s
    LEFT JOIN projects p ON p.id = s.project_id
    WHERE s.user_id = ${userId}
      AND (${slugFilter}::text IS NULL OR p.slug = ${slugFilter}::text)
    ORDER BY s.is_primary DESC, s.updated_at DESC
  `;
  return rows as SpecListRow[];
}

/** One spec with its ordered sections and each section's linked patches. */
export async function getSpec(
  userId: string,
  specId: string
): Promise<SpecDetail | null> {
  const [specRows, sectionRows, patchRows] = await Promise.all([
    sql`
      SELECT s.*, p.name AS project_name, p.slug AS project_slug,
        (SELECT COUNT(*) FROM spec_sections ss WHERE ss.spec_id = s.id)::int AS section_count
      FROM specs s
      LEFT JOIN projects p ON p.id = s.project_id
      WHERE s.user_id = ${userId} AND s.id = ${specId}
      LIMIT 1
    `,
    sql`
      SELECT ss.*, r.author AS last_author, r.created_at AS last_edited_at
      FROM spec_sections ss
      JOIN specs s ON s.id = ss.spec_id
      LEFT JOIN LATERAL (
        SELECT author, created_at FROM spec_revisions
        WHERE section_id = ss.id
        ORDER BY created_at DESC
        LIMIT 1
      ) r ON TRUE
      WHERE s.user_id = ${userId} AND ss.spec_id = ${specId}
      ORDER BY ss.position ASC, ss.created_at ASC
    `,
    sql`
      SELECT pa.id, pa.title, pa.status, pa.priority, pa.created_at, pa.spec_section_id
      FROM patches pa
      JOIN spec_sections ss ON ss.id = pa.spec_section_id
      JOIN specs s ON s.id = ss.spec_id
      WHERE s.user_id = ${userId} AND s.id = ${specId}
      ORDER BY pa.created_at ASC
    `,
  ]);
  const spec = specRows[0] as SpecListRow | undefined;
  if (!spec) return null;

  const patchesBySection = new Map<string, SpecLinkedPatch[]>();
  for (const patch of patchRows as SpecLinkedPatch[]) {
    const list = patchesBySection.get(patch.spec_section_id) ?? [];
    list.push(patch);
    patchesBySection.set(patch.spec_section_id, list);
  }
  const sections = (sectionRows as SpecSection[]).map((section) => ({
    ...section,
    patches: patchesBySection.get(section.id) ?? [],
  }));
  return { ...spec, sections };
}

/** Section revisions, newest first. Pass sectionId to narrow to one section. */
export async function getSpecHistory(
  userId: string,
  specId: string,
  sectionId?: string,
  limit = 100
): Promise<SpecRevision[]> {
  const sectionFilter = sectionId ?? null;
  const rows = await sql`
    SELECT r.*
    FROM spec_revisions r
    JOIN specs s ON s.id = r.spec_id
    WHERE s.user_id = ${userId} AND r.spec_id = ${specId}
      AND (${sectionFilter}::uuid IS NULL OR r.section_id = ${sectionFilter}::uuid)
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `;
  return rows as SpecRevision[];
}

// ── Spec writes ────────────────────────────────────────────────────────────

/**
 * Create a spec, optionally already linked to a project (projectId must be
 * one the caller verified the user owns). Sections default to the template;
 * each one gets a "create" revision attributed to author. Marking it primary
 * demotes the project's current primary spec.
 */
export async function createSpec(
  userId: string,
  input: {
    title: string;
    author: SpecAuthor;
    projectId?: string | null;
    isPrimary?: boolean;
    sections?: { heading: string; body?: string }[];
  }
): Promise<SpecDetail> {
  const specId = crypto.randomUUID();
  const projectId = input.projectId ?? null;
  const isPrimary = projectId !== null && (input.isPrimary ?? false);
  const sections =
    input.sections ??
    DEFAULT_SPEC_SECTIONS.map((heading) => ({ heading, body: "" }));

  const queries = [];
  if (isPrimary) {
    queries.push(sql`
      UPDATE specs SET is_primary = FALSE
      WHERE user_id = ${userId} AND project_id = ${projectId} AND is_primary
    `);
  }
  queries.push(sql`
    INSERT INTO specs (id, user_id, title, project_id, is_primary)
    VALUES (${specId}, ${userId}, ${input.title}, ${projectId}, ${isPrimary})
  `);
  sections.forEach((section, index) => {
    const sectionId = crypto.randomUUID();
    const body = section.body ?? "";
    queries.push(sql`
      INSERT INTO spec_sections (id, spec_id, position, heading, body)
      VALUES (${sectionId}, ${specId}, ${index}, ${section.heading}, ${body})
    `);
    queries.push(sql`
      INSERT INTO spec_revisions (spec_id, section_id, kind, author, after_heading, after_body)
      VALUES (${specId}, ${sectionId}, 'create', ${input.author}, ${section.heading}, ${body})
    `);
  });
  await sql.transaction(queries);

  const spec = await getSpec(userId, specId);
  if (!spec) throw new Error("Spec vanished right after creation");
  return spec;
}

export async function updateSpecTitle(
  userId: string,
  specId: string,
  title: string
): Promise<Spec | null> {
  const rows = await sql`
    UPDATE specs SET title = ${title}, updated_at = now()
    WHERE user_id = ${userId} AND id = ${specId}
    RETURNING *
  `;
  return (rows[0] as Spec) ?? null;
}

/**
 * Link a spec to a project the caller verified the user owns. isPrimary
 * demotes the project's current primary spec in the same transaction.
 */
export async function attachSpec(
  userId: string,
  specId: string,
  projectId: string,
  isPrimary = false
): Promise<Spec | null> {
  const queries = [];
  if (isPrimary) {
    queries.push(sql`
      UPDATE specs SET is_primary = FALSE
      WHERE user_id = ${userId} AND project_id = ${projectId} AND is_primary AND id <> ${specId}
    `);
  }
  queries.push(sql`
    UPDATE specs SET project_id = ${projectId}, is_primary = ${isPrimary}, updated_at = now()
    WHERE user_id = ${userId} AND id = ${specId}
    RETURNING *
  `);
  const results = await sql.transaction(queries);
  const rows = results[results.length - 1];
  return (rows[0] as Spec) ?? null;
}

/** Unlink from its project. The spec, its sections and history are kept. */
export async function detachSpec(
  userId: string,
  specId: string
): Promise<Spec | null> {
  const rows = await sql`
    UPDATE specs SET project_id = NULL, is_primary = FALSE, updated_at = now()
    WHERE user_id = ${userId} AND id = ${specId}
    RETURNING *
  `;
  return (rows[0] as Spec) ?? null;
}

/** Make (or unmake) a linked spec its project's primary spec. */
export async function setSpecPrimary(
  userId: string,
  specId: string,
  isPrimary: boolean
): Promise<Spec | null> {
  const current = await sql`
    SELECT project_id FROM specs WHERE user_id = ${userId} AND id = ${specId}
  `;
  const row = current[0] as { project_id: string | null } | undefined;
  if (!row) return null;
  if (isPrimary && !row.project_id) {
    throw new SpecError("Only a spec linked to a project can be its primary spec.");
  }
  if (!isPrimary) {
    const rows = await sql`
      UPDATE specs SET is_primary = FALSE, updated_at = now()
      WHERE user_id = ${userId} AND id = ${specId}
      RETURNING *
    `;
    return (rows[0] as Spec) ?? null;
  }
  return attachSpec(userId, specId, row.project_id as string, true);
}

/** Delete a spec, its sections and history. Linked patches stay, unlinked. */
export async function deleteSpec(userId: string, specId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM specs WHERE user_id = ${userId} AND id = ${specId}
    RETURNING id
  `;
  return rows.length > 0;
}

// ── Section writes (each one records a revision in the same statement) ────

/** Append a section to the end of a spec. */
export async function addSpecSection(
  userId: string,
  specId: string,
  heading: string,
  body: string,
  author: SpecAuthor
): Promise<SpecSection | null> {
  const sectionId = crypto.randomUUID();
  const rows = await sql`
    WITH s AS (
      SELECT id FROM specs WHERE id = ${specId} AND user_id = ${userId}
    ),
    ins AS (
      INSERT INTO spec_sections (id, spec_id, position, heading, body)
      SELECT ${sectionId}, s.id,
        (SELECT COALESCE(MAX(position) + 1, 0) FROM spec_sections WHERE spec_id = s.id),
        ${heading}, ${body}
      FROM s
      RETURNING *
    ),
    rev AS (
      INSERT INTO spec_revisions (spec_id, section_id, kind, author, after_heading, after_body)
      SELECT spec_id, id, 'create', ${author}, heading, body FROM ins
      RETURNING created_at
    ),
    touch AS (
      UPDATE specs SET updated_at = now() WHERE id IN (SELECT id FROM s)
    )
    SELECT ins.*, ${author}::text AS last_author, rev.created_at AS last_edited_at
    FROM ins, rev
  `;
  return (rows[0] as SpecSection) ?? null;
}

/**
 * Change a section's heading and/or body (omit a field to keep it). A write
 * that changes nothing records no revision, so autosave can't flood history.
 */
export async function updateSpecSection(
  userId: string,
  sectionId: string,
  changes: { heading?: string; body?: string },
  author: SpecAuthor
): Promise<SpecSection | null> {
  const heading = changes.heading ?? null;
  const body = changes.body ?? null;
  const rows = await sql`
    WITH old AS (
      SELECT ss.* FROM spec_sections ss
      JOIN specs s ON s.id = ss.spec_id
      WHERE ss.id = ${sectionId} AND s.user_id = ${userId}
      FOR UPDATE OF ss
    ),
    upd AS (
      UPDATE spec_sections ss
      SET heading = COALESCE(${heading}::text, ss.heading),
          body = COALESCE(${body}::text, ss.body),
          updated_at = CASE
            WHEN (COALESCE(${heading}::text, ss.heading), COALESCE(${body}::text, ss.body))
                 IS DISTINCT FROM (ss.heading, ss.body) THEN now()
            ELSE ss.updated_at
          END
      FROM old
      WHERE ss.id = old.id
      RETURNING ss.*
    ),
    rev AS (
      INSERT INTO spec_revisions
        (spec_id, section_id, kind, author, before_heading, after_heading, before_body, after_body)
      SELECT old.spec_id, old.id, 'edit', ${author},
        old.heading, upd.heading, old.body, upd.body
      FROM old JOIN upd ON upd.id = old.id
      WHERE (old.heading, old.body) IS DISTINCT FROM (upd.heading, upd.body)
      RETURNING author, created_at
    ),
    touch AS (
      UPDATE specs SET updated_at = now()
      WHERE id IN (SELECT spec_id FROM upd) AND EXISTS (SELECT 1 FROM rev)
    )
    SELECT upd.*,
      COALESCE((SELECT author FROM rev), last.author) AS last_author,
      COALESCE((SELECT created_at FROM rev), last.created_at) AS last_edited_at
    FROM upd
    LEFT JOIN LATERAL (
      SELECT author, created_at FROM spec_revisions
      WHERE section_id = upd.id
      ORDER BY created_at DESC
      LIMIT 1
    ) last ON TRUE
  `;
  return (rows[0] as SpecSection) ?? null;
}

/**
 * Remove a section. The delete is recorded as a revision (with the removed
 * heading/body) so it stays visible in the spec's history. Patches linked to
 * it keep existing, unlinked.
 */
export async function deleteSpecSection(
  userId: string,
  sectionId: string,
  author: SpecAuthor
): Promise<boolean> {
  // section_id is NULL on the revision: the row is gone by the end of the
  // statement, so a reference to it would fail the foreign key.
  const rows = await sql`
    WITH del AS (
      DELETE FROM spec_sections ss
      USING specs s
      WHERE ss.spec_id = s.id AND s.user_id = ${userId} AND ss.id = ${sectionId}
      RETURNING ss.*
    ),
    rev AS (
      INSERT INTO spec_revisions (spec_id, section_id, kind, author, before_heading, before_body)
      SELECT spec_id, NULL, 'delete', ${author}, heading, body FROM del
    ),
    touch AS (
      UPDATE specs SET updated_at = now() WHERE id IN (SELECT spec_id FROM del)
    )
    SELECT id FROM del
  `;
  return rows.length > 0;
}

/** Set section order. orderedIds must list every section of the spec once. */
export async function reorderSpecSections(
  userId: string,
  specId: string,
  orderedIds: string[]
): Promise<boolean> {
  const current = await sql`
    SELECT ss.id FROM spec_sections ss
    JOIN specs s ON s.id = ss.spec_id
    WHERE s.user_id = ${userId} AND s.id = ${specId}
  `;
  if (current.length === 0) {
    const spec = await sql`SELECT 1 FROM specs WHERE user_id = ${userId} AND id = ${specId}`;
    if (spec.length === 0) return false;
  }
  const currentIds = new Set((current as { id: string }[]).map((r) => r.id));
  const given = new Set(orderedIds);
  if (
    given.size !== orderedIds.length ||
    given.size !== currentIds.size ||
    orderedIds.some((id) => !currentIds.has(id))
  ) {
    throw new SpecError(
      "Reorder needs every section of the spec exactly once. Re-read the spec and try again."
    );
  }
  await sql`
    UPDATE spec_sections ss
    SET position = o.ord - 1
    FROM unnest(${orderedIds}::uuid[]) WITH ORDINALITY AS o(id, ord)
    WHERE ss.id = o.id AND ss.spec_id = ${specId}
  `;
  await sql`UPDATE specs SET updated_at = now() WHERE id = ${specId} AND user_id = ${userId}`;
  return true;
}

// ── Patch ↔ section links ──────────────────────────────────────────────────

/**
 * Check that sectionId belongs to one of the user's specs linked to
 * projectId. A patch may only point at a section of its own project's spec.
 * Throws SpecError (user-fixable) otherwise.
 */
export async function assertSectionInProject(
  userId: string,
  sectionId: string,
  projectId: string
): Promise<void> {
  const rows = await sql`
    SELECT s.project_id FROM spec_sections ss
    JOIN specs s ON s.id = ss.spec_id
    WHERE ss.id = ${sectionId} AND s.user_id = ${userId}
  `;
  const row = rows[0] as { project_id: string | null } | undefined;
  if (!row) throw new SpecError(`Spec section '${sectionId}' not found.`);
  if (row.project_id !== projectId) {
    throw new SpecError(
      "That section's spec isn't attached to this patch's project. Attach the spec to the project first."
    );
  }
}

/** Link a patch to a spec section (or unlink with null). */
export async function setPatchSpecSection(
  userId: string,
  patchId: string,
  sectionId: string | null
): Promise<Patch | null> {
  if (sectionId) {
    const owner = await sql`
      SELECT pa.project_id FROM patches pa
      JOIN projects p ON p.id = pa.project_id
      WHERE pa.id = ${patchId} AND p.user_id = ${userId}
    `;
    const row = owner[0] as { project_id: string } | undefined;
    if (!row) return null;
    await assertSectionInProject(userId, sectionId, row.project_id);
  }
  const rows = await sql`
    UPDATE patches pa SET spec_section_id = ${sectionId}
    FROM projects p
    WHERE pa.project_id = p.id AND p.user_id = ${userId} AND pa.id = ${patchId}
    RETURNING pa.*
  `;
  return (rows[0] as Patch) ?? null;
}
