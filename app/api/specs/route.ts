import { auth } from "@clerk/nextjs/server";
import { getProjectBySlug } from "@/lib/queries";
import { createSpec, listSpecs } from "@/lib/specs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listSpecs(userId));
}

// Create a spec from the app (attributed to Nae). project_slug links it; a
// spec made from a project page is a feature spec unless is_primary is set.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { title, project_slug, is_primary } = await req.json();
  if (typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  let projectId: string | null = null;
  if (project_slug) {
    const project = await getProjectBySlug(userId, String(project_slug));
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
    projectId = project.id;
  }
  const spec = await createSpec(userId, {
    title: title.trim(),
    author: "nae",
    projectId,
    isPrimary: is_primary === true,
  });
  return Response.json(spec, { status: 201 });
}
