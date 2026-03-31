import { auth } from "@clerk/nextjs/server";
import { createPatch, getPatches, getProjectBySlug } from "@/lib/queries";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("project");
  const status = searchParams.get("status") as "open" | "in_progress" | "done" | null;

  if (!slug) {
    return Response.json({ error: "project slug is required" }, { status: 400 });
  }

  const patches = await getPatches(userId, slug, status ?? undefined);
  return Response.json(patches);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { project_slug, title, priority } = await req.json();
  if (!project_slug || !title) {
    return Response.json({ error: "project_slug and title are required" }, { status: 400 });
  }

  const project = await getProjectBySlug(userId, project_slug);
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const patch = await createPatch(project.id, title, priority);
  return Response.json(patch, { status: 201 });
}
