import { auth } from "@clerk/nextjs/server";
import { deletePatchAttachment } from "@/lib/queries";
import { deleteObject } from "@/lib/r2";

/**
 * Delete an attachment: remove the DB row (ownership-checked) then best-effort
 * delete the underlying blob.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const deleted = await deletePatchAttachment(userId, id);
  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteObject(deleted.pathname);
  } catch {
    // ignore — object may already be gone
  }
  return new Response(null, { status: 204 });
}
