import { auth } from "@clerk/nextjs/server";
import { addPatchAttachment, getPatchById } from "@/lib/queries";
import { verifyUploadedImage } from "@/lib/r2";

/**
 * Attach an already-uploaded image to an existing patch. The browser uploads to
 * R2 first, then POSTs the resulting { pathname, ... } here. Only the pathname
 * is trusted; type/size are verified against the stored object. Ownership is
 * enforced in addPatchAttachment.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { pathname } = await req.json();
  if (typeof pathname !== "string") {
    return Response.json({ error: "pathname is required" }, { status: 400 });
  }

  // Check ownership before the HEAD so a bad patch id can't delete objects.
  if (!(await getPatchById(userId, id))) {
    return Response.json({ error: "Patch not found" }, { status: 404 });
  }
  const verified = await verifyUploadedImage(pathname);
  if (!verified.ok) {
    return Response.json({ error: verified.error }, { status: 400 });
  }

  const attachment = await addPatchAttachment(userId, id, {
    url: verified.url,
    pathname: verified.pathname,
    contentType: verified.contentType,
    size: verified.size,
  });
  if (!attachment) {
    return Response.json({ error: "Patch not found" }, { status: 404 });
  }
  return Response.json(attachment, { status: 201 });
}
