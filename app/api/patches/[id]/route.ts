import { auth } from "@clerk/nextjs/server";
import { addNote, deletePatch, reopenPatch, updatePatch, updatePatchStatus } from "@/lib/queries";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (body.reopen) {
    const patch = await reopenPatch(userId, id, body.reopen);
    if (!patch) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(patch);
  }

  if (body.status) {
    const patch = await updatePatchStatus(userId, id, body.status);
    if (!patch) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(patch);
  }

  if (body.note) {
    const patch = await addNote(userId, id, body.note);
    if (!patch) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(patch);
  }

  if (body.title !== undefined && body.priority !== undefined) {
    const cleanTags = Array.isArray(body.tags)
      ? body.tags
          .map((t: unknown) => (typeof t === "string" ? t.trim() : ""))
          .filter((t: string) => t.length > 0)
      : undefined;
    const patch = await updatePatch(userId, id, body.title, body.priority, cleanTags);
    if (!patch) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(patch);
  }

  return Response.json({ error: "Nothing to update" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ok = await deletePatch(userId, id);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
