import { sql } from "./db";

// ── Types ──────────────────────────────────────────────────────────────────

export type Project = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  color: string;
  created_at: string;
  open_count?: number;
};

export type Patch = {
  id: string;
  project_id: string;
  title: string;
  status: "open" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type PatchWithProject = Patch & {
  project_name: string;
  project_slug: string;
  project_color: string;
};

// ── All Patches (cross-project) ────────────────────────────────────────────

export async function getAllPatches(userId: string): Promise<PatchWithProject[]> {
  const rows = await sql`
    SELECT pa.*, p.name AS project_name, p.slug AS project_slug, p.color AS project_color
    FROM patches pa
    JOIN projects p ON p.id = pa.project_id
    WHERE p.user_id = ${userId}
    ORDER BY pa.created_at DESC
  `;
  return rows as PatchWithProject[];
}

// ── Projects ───────────────────────────────────────────────────────────────

export async function getProjects(userId: string): Promise<Project[]> {
  const rows = await sql`
    SELECT p.*, COUNT(pa.id) FILTER (WHERE pa.status = 'open') AS open_count
    FROM projects p
    LEFT JOIN patches pa ON pa.project_id = p.id
    WHERE p.user_id = ${userId}
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `;
  return rows as Project[];
}

export async function getProjectBySlug(
  userId: string,
  slug: string
): Promise<Project | null> {
  const rows = await sql`
    SELECT * FROM projects
    WHERE user_id = ${userId} AND slug = ${slug}
    LIMIT 1
  `;
  return (rows[0] as Project) ?? null;
}

export async function createProject(
  userId: string,
  name: string,
  slug: string,
  color = "#6366f1"
): Promise<Project> {
  const rows = await sql`
    INSERT INTO projects (user_id, name, slug, color)
    VALUES (${userId}, ${name}, ${slug}, ${color})
    RETURNING *
  `;
  return rows[0] as Project;
}

export async function deleteProject(
  userId: string,
  slug: string
): Promise<void> {
  await sql`
    DELETE FROM projects
    WHERE user_id = ${userId} AND slug = ${slug}
  `;
}

// ── Patches ────────────────────────────────────────────────────────────────

export async function getPatches(
  userId: string,
  projectSlug: string,
  status?: Patch["status"]
): Promise<Patch[]> {
  if (status) {
    const rows = await sql`
      SELECT pa.* FROM patches pa
      JOIN projects p ON p.id = pa.project_id
      WHERE p.user_id = ${userId} AND p.slug = ${projectSlug}
        AND pa.status = ${status}
      ORDER BY pa.created_at DESC
    `;
    return rows as Patch[];
  }
  const rows = await sql`
    SELECT pa.* FROM patches pa
    JOIN projects p ON p.id = pa.project_id
    WHERE p.user_id = ${userId} AND p.slug = ${projectSlug}
    ORDER BY pa.created_at DESC
  `;
  return rows as Patch[];
}

export async function createPatch(
  projectId: string,
  title: string,
  priority: Patch["priority"] = "medium"
): Promise<Patch> {
  const rows = await sql`
    INSERT INTO patches (project_id, title, priority)
    VALUES (${projectId}, ${title}, ${priority})
    RETURNING *
  `;
  return rows[0] as Patch;
}

export async function updatePatchStatus(
  patchId: string,
  status: Patch["status"]
): Promise<Patch> {
  const now = new Date().toISOString();
  if (status === "in_progress") {
    const rows = await sql`
      UPDATE patches SET status = ${status}, started_at = ${now}
      WHERE id = ${patchId}
      RETURNING *
    `;
    return rows[0] as Patch;
  }
  if (status === "done") {
    const rows = await sql`
      UPDATE patches SET status = ${status}, completed_at = ${now}
      WHERE id = ${patchId}
      RETURNING *
    `;
    return rows[0] as Patch;
  }
  const rows = await sql`
    UPDATE patches SET status = ${status}
    WHERE id = ${patchId}
    RETURNING *
  `;
  return rows[0] as Patch;
}

export async function addNote(patchId: string, note: string): Promise<Patch> {
  const rows = await sql`
    UPDATE patches
    SET notes = CASE
      WHEN notes IS NULL THEN ${note}
      ELSE notes || E'\n\n' || ${note}
    END
    WHERE id = ${patchId}
    RETURNING *
  `;
  return rows[0] as Patch;
}

export async function updatePatch(
  patchId: string,
  title: string,
  priority: Patch["priority"]
): Promise<Patch> {
  const rows = await sql`
    UPDATE patches SET title = ${title}, priority = ${priority}
    WHERE id = ${patchId}
    RETURNING *
  `;
  return rows[0] as Patch;
}

export async function getPatchById(patchId: string): Promise<Patch | null> {
  const rows = await sql`SELECT * FROM patches WHERE id = ${patchId} LIMIT 1`;
  return (rows[0] as Patch) ?? null;
}

export async function deletePatch(patchId: string): Promise<void> {
  await sql`DELETE FROM patches WHERE id = ${patchId}`;
}

export async function updateProject(
  userId: string,
  slug: string,
  name: string,
  color: string
): Promise<Project> {
  const rows = await sql`
    UPDATE projects SET name = ${name}, color = ${color}
    WHERE user_id = ${userId} AND slug = ${slug}
    RETURNING *
  `;
  return rows[0] as Project;
}

// ── Reopen Patch ──────────────────────────────────────────────────────────

export async function reopenPatch(
  patchId: string,
  status: "open" | "in_progress" = "open"
): Promise<Patch> {
  if (status === "in_progress") {
    const rows = await sql`
      UPDATE patches SET status = 'in_progress', completed_at = NULL
      WHERE id = ${patchId}
      RETURNING *
    `;
    return rows[0] as Patch;
  }
  const rows = await sql`
    UPDATE patches SET status = 'open', started_at = NULL, completed_at = NULL
    WHERE id = ${patchId}
    RETURNING *
  `;
  return rows[0] as Patch;
}

// ── Project Summary ───────────────────────────────────────────────────────

export type ProjectSummary = {
  project_name: string;
  project_slug: string;
  project_color: string;
  open: number;
  in_progress: number;
  done: number;
  total: number;
};

export async function getProjectSummary(userId: string): Promise<ProjectSummary[]> {
  const rows = await sql`
    SELECT
      p.name AS project_name,
      p.slug AS project_slug,
      p.color AS project_color,
      COUNT(pa.id) FILTER (WHERE pa.status = 'open')::int AS open,
      COUNT(pa.id) FILTER (WHERE pa.status = 'in_progress')::int AS in_progress,
      COUNT(pa.id) FILTER (WHERE pa.status = 'done')::int AS done,
      COUNT(pa.id)::int AS total
    FROM projects p
    LEFT JOIN patches pa ON pa.project_id = p.id
    WHERE p.user_id = ${userId}
    GROUP BY p.id
    ORDER BY p.name ASC
  `;
  return rows as ProjectSummary[];
}

// ── Search Patches ────────────────────────────────────────────────────────

export async function searchPatches(
  userId: string,
  query: string
): Promise<PatchWithProject[]> {
  const pattern = `%${query}%`;
  const rows = await sql`
    SELECT pa.*, p.name AS project_name, p.slug AS project_slug, p.color AS project_color
    FROM patches pa
    JOIN projects p ON p.id = pa.project_id
    WHERE p.user_id = ${userId}
      AND (pa.title ILIKE ${pattern} OR pa.notes ILIKE ${pattern})
    ORDER BY pa.created_at DESC
  `;
  return rows as PatchWithProject[];
}

// ── MCP Tokens ─────────────────────────────────────────────────────────────

export async function getOrCreateMcpToken(userId: string): Promise<string> {
  const rows = await sql`SELECT token FROM mcp_tokens WHERE user_id = ${userId} LIMIT 1`;
  if (rows[0]?.token) return rows[0].token as string;
  const token =
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  await sql`INSERT INTO mcp_tokens (token, user_id) VALUES (${token}, ${userId})`;
  return token;
}

export async function getUserIdFromToken(
  token: string
): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM mcp_tokens WHERE token = ${token} LIMIT 1`;
  return (rows[0]?.user_id as string) ?? null;
}
