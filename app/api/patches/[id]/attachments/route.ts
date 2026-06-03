import { auth } from "@clerk/nextjs/server";
import { addPatchAttachment } from "@/lib/queries";

/**
 * Attach an already-uploaded blob to an existing patch. The browser uploads to
 * Vercel Blob first, then POSTs the resulting { url, pathname, contentType, size }
 * here. Ownership is enforced in addPatchAttachment.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { url, pathname, contentType, size } = await req.json();
  if (typeof url !== "string" || typeof pathname !== "string") {
    return Response.json(
      { error: "url and pathname are required" },
      { status: 400 }
    );
  }

  const attachment = await addPatchAttachment(userId, id, {
    url,
    pathname,
    contentType: typeof contentType === "string" ? contentType : null,
    size: typeof size === "number" ? size : null,
  });
  if (!attachment) {
    return Response.json({ error: "Patch not found" }, { status: 404 });
  }
  return Response.json(attachment, { status: 201 });
}
