import { auth } from "@clerk/nextjs/server";
import {
  addPatchAttachment,
  createPatch,
  getPatches,
  getProjectBySlug,
} from "@/lib/queries";

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

  const { project_slug, title, priority, notes, tags, due_date, attachments } =
    await req.json();
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

  // Attachments were uploaded to Blob client-side before submit; persist the
  // rows now that the patch (and its id) exist.
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (
        att &&
        typeof att.url === "string" &&
        typeof att.pathname === "string"
      ) {
        await addPatchAttachment(userId, patch.id, {
          url: att.url,
          pathname: att.pathname,
          contentType: typeof att.contentType === "string" ? att.contentType : null,
          size: typeof att.size === "number" ? att.size : null,
        });
      }
    }
  }

  return Response.json(patch, { status: 201 });
}
