import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { getPatchById } from "@/lib/queries";
import { objectUrl, presignPutUrl } from "@/lib/r2";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Mint a presigned PUT URL for a direct-to-R2 browser upload. Validates the
 * Clerk session and, when uploading to an existing patch, that the user owns
 * it. The browser uploads straight to R2 with the returned URL, so this
 * route never sees the file bytes.
 */
export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }

  const { filename, contentType, size, patchId } = await request.json();
  if (
    typeof filename !== "string" ||
    !filename ||
    typeof contentType !== "string" ||
    typeof size !== "number"
  ) {
    return Response.json(
      { error: "filename, contentType, and size are required" },
      { status: 400 }
    );
  }
  if (!contentType.startsWith("image/")) {
    return Response.json(
      { error: "Only image uploads are allowed" },
      { status: 400 }
    );
  }
  if (size > MAX_BYTES) {
    return Response.json(
      { error: "Image exceeds the 10MB limit" },
      { status: 400 }
    );
  }
  if (typeof patchId === "string" && patchId) {
    const patch = await getPatchById(userId, patchId);
    if (!patch) {
      return Response.json({ error: "Not authorized" }, { status: 401 });
    }
  }

  const key = `attachments/${randomUUID()}-${filename}`;
  const uploadUrl = await presignPutUrl(key, contentType, size);
  return Response.json({ uploadUrl, key, url: objectUrl(key) });
}
