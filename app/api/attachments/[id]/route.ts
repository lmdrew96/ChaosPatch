import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";
import { deletePatchAttachment } from "@/lib/queries";
import { BLOB_TOKEN } from "@/lib/blob";

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
    await del(deleted.url, { token: BLOB_TOKEN });
  } catch {
    // ignore — blob may already be gone
  }
  return new Response(null, { status: 204 });
}
