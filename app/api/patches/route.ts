import { auth } from "@clerk/nextjs/server";
import {
  addPatchAttachment,
  createPatch,
  getPatches,
  getProjectBySlug,
  unarchiveProject,
  type Patch,
} from "@/lib/queries";
import { verifyUploadedImage } from "@/lib/r2";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("project");
  const status = searchParams.get("status") as Patch["status"] | null;

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
  // Attachments were uploaded to R2 client-side before submit. Verify them
  // before creating anything, so a bad file can't leave a half-made patch.
  // Only the pathname is trusted; type/size come from the stored object.
  const verifiedAttachments = [];
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (!att || typeof att.pathname !== "string") {
        return Response.json({ error: "Invalid attachment" }, { status: 400 });
      }
      const verified = await verifyUploadedImage(att.pathname);
      if (!verified.ok) {
        return Response.json({ error: verified.error }, { status: 400 });
      }
      verifiedAttachments.push(verified);
    }
  }

  // New work means the project is active again (same rule as cp_add_patch).
  if (project.archived) await unarchiveProject(userId, project.slug);

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

  for (const att of verifiedAttachments) {
    await addPatchAttachment(userId, patch.id, {
      url: att.url,
      pathname: att.pathname,
      contentType: att.contentType,
      size: att.size,
    });
  }

  return Response.json(patch, { status: 201 });
}
