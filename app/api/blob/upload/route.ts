import { auth } from "@clerk/nextjs/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getPatchById } from "@/lib/queries";

/**
 * Token route for client-side uploads (`upload()` from @vercel/blob/client).
 * Validates the Clerk session and, when uploading to an existing patch, that
 * the user owns it. The browser uploads straight to Vercel Blob, so this never
 * sees the file bytes — only mints a scoped, short-lived upload token.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const { userId } = await auth();
        if (!userId) throw new Error("Not authorized");

        let patchId: string | undefined;
        if (clientPayload) {
          try {
            patchId = (JSON.parse(clientPayload) as { patchId?: string }).patchId;
          } catch {
            // Malformed payload — treat as no patch context (add-form flow).
          }
        }
        if (patchId) {
          const patch = await getPatchById(userId, patchId);
          if (!patch) throw new Error("Not authorized");
        }

        return {
          allowedContentTypes: ["image/*"],
          maximumSizeInBytes: 10 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId, patchId: patchId ?? null }),
        };
      },
      onUploadCompleted: async () => {
        // No-op: the DB row is inserted by a client-initiated call after
        // upload() resolves, so attaching works on localhost too (Vercel can't
        // reach this webhook in local dev).
      },
    });

    return Response.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return Response.json(
      { error: message },
      { status: message === "Not authorized" ? 401 : 400 }
    );
  }
}
