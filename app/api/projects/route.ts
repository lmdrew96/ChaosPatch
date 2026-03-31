import { auth } from "@clerk/nextjs/server";
import { createProject, getProjects } from "@/lib/queries";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await getProjects(userId);
  return Response.json(projects);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name, slug, color } = await req.json();
  if (!name || !slug) {
    return Response.json({ error: "name and slug are required" }, { status: 400 });
  }

  const project = await createProject(userId, name, slug, color);
  return Response.json(project, { status: 201 });
}
