import { auth } from "@clerk/nextjs/server";
import {
  deleteProject,
  getAttachmentsForProject,
  ProjectSlugError,
  updateProject,
} from "@/lib/queries";
import { deleteObjects } from "@/lib/r2";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { name, color, slug: newSlug } = await req.json();
  if (!name?.trim() || !color) {
    return Response.json({ error: "name and color required" }, { status: 400 });
  }
  if (newSlug !== undefined && (typeof newSlug !== "string" || !newSlug.trim())) {
    return Response.json({ error: "slug must be a non-empty string" }, { status: 400 });
  }

  try {
    const project = await updateProject(
      userId,
      slug,
      name.trim(),
      color,
      newSlug?.trim() ?? slug
    );
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
    return Response.json(project);
  } catch (err) {
    if (err instanceof ProjectSlugError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  // Grab storage keys before the cascade removes the attachment rows.
  const attachments = await getAttachmentsForProject(userId, slug);
  await deleteProject(userId, slug);
  await deleteObjects(attachments.map((a) => a.pathname));
  return new Response(null, { status: 204 });
}
