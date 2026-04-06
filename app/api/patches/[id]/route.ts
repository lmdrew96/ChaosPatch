import { auth } from "@clerk/nextjs/server";
import { addNote, deletePatch, updatePatch, updatePatchStatus } from "@/lib/queries";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (body.status) {
    const patch = await updatePatchStatus(id, body.status);
    return Response.json(patch);
  }

  if (body.note) {
    const patch = await addNote(id, body.note);
    return Response.json(patch);
  }

  if (body.title !== undefined && body.priority !== undefined) {
    const patch = await updatePatch(id, body.title, body.priority);
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
  await deletePatch(id);
  return new Response(null, { status: 204 });
}
