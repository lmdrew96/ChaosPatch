import { auth } from "@clerk/nextjs/server";
import {
  createProject,
  getProjectBySlug,
  SLUG_PATTERN,
} from "@/lib/queries";
import {
  attachSpec,
  deleteSpec,
  detachSpec,
  getSpec,
  reorderSpecSections,
  setSpecPrimary,
  SpecError,
  updateSpecTitle,
} from "@/lib/specs";

type Params = { params: Promise<{ id: string }> };

const bad = (error: string, status = 400): Response => Response.json({ error }, { status });

/**
 * One action per request:
 * { title } | { attach: slug, is_primary? } | { detach: true } |
 * { is_primary } | { reorder: sectionIds[] } |
 * { create_project: { name, slug, color? } } (creates it, links this spec as primary)
 * Responds with the full spec.
 */
export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return bad("Unauthorized", 401);
  const { id } = await params;
  const body = await req.json();

  try {
    if (typeof body.title === "string") {
      if (!body.title.trim()) return bad("Title can't be empty");
      if (!(await updateSpecTitle(userId, id, body.title.trim()))) return bad("Spec not found", 404);
    } else if (typeof body.attach === "string") {
      const project = await getProjectBySlug(userId, body.attach);
      if (!project) return bad("Project not found", 404);
      if (!(await attachSpec(userId, id, project.id, body.is_primary === true))) {
        return bad("Spec not found", 404);
      }
    } else if (body.detach === true) {
      if (!(await detachSpec(userId, id))) return bad("Spec not found", 404);
    } else if (typeof body.is_primary === "boolean") {
      if (!(await setSpecPrimary(userId, id, body.is_primary))) return bad("Spec not found", 404);
    } else if (Array.isArray(body.reorder)) {
      if (!(await reorderSpecSections(userId, id, body.reorder.map(String)))) {
        return bad("Spec not found", 404);
      }
    } else if (body.create_project && typeof body.create_project === "object") {
      const { name, slug, color } = body.create_project as { name?: unknown; slug?: unknown; color?: unknown };
      if (typeof name !== "string" || !name.trim()) return bad("Project name is required");
      if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
        return bad("Use lowercase letters, numbers, and single hyphens for the slug (e.g. 'my-project').");
      }
      const spec = await getSpec(userId, id);
      if (!spec) return bad("Spec not found", 404);
      if (spec.project_id) return bad("This spec is already linked to a project.");
      if (await getProjectBySlug(userId, slug)) return bad(`Slug '${slug}' is already used by another project.`);
      const project = await createProject(
        userId,
        name.trim(),
        slug,
        typeof color === "string" ? color : undefined
      );
      // The spec a project was born from is its big-picture spec.
      await attachSpec(userId, id, project.id, true);
    } else {
      return bad("Nothing to update");
    }
  } catch (err) {
    if (err instanceof SpecError) return bad(err.message);
    throw err;
  }

  const spec = await getSpec(userId, id);
  if (!spec) return bad("Spec not found", 404);
  return Response.json(spec);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return bad("Unauthorized", 401);
  const { id } = await params;
  if (!(await deleteSpec(userId, id))) return bad("Spec not found", 404);
  return new Response(null, { status: 204 });
}
