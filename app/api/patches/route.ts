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

  const { project_slug, title, priority, notes, tags, due_date } = await req.json();
  if (!project_slug || !title) {
    return Response.json({ error: "project_slug and title are required" }, { status: 400 });
  }

  const project = await getProjectBySlug(userId, project_slug);
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const trimmedNotes = typeof notes === "string" ? notes.trim() : "";
  const cleanTags = Array.isArray(tags)
    ? tags
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter((t) => t.length > 0)
    : undefined;
  const cleanDueDate =
    typeof due_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(due_date)
      ? due_date
      : undefined;
  const patch = await createPatch(
    project.id,
    title,
    priority,
    trimmedNotes ? trimmedNotes : undefined,
    cleanTags,
    cleanDueDate
  );
  return Response.json(patch, { status: 201 });
}
