import { auth } from "@clerk/nextjs/server";
import { deleteProject, updateProject } from "@/lib/queries";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { name, color } = await req.json();
  if (!name?.trim() || !color) {
    return Response.json({ error: "name and color required" }, { status: 400 });
  }

  const project = await updateProject(userId, slug, name.trim(), color);
  return Response.json(project);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  await deleteProject(userId, slug);
  return new Response(null, { status: 204 });
}
