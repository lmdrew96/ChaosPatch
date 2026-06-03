import { auth } from "@clerk/nextjs/server";
import { presignBlobGetUrl } from "@/lib/blob";

/**
 * Auth-gated image proxy for private blobs: presigns a short-lived GET URL for
 * the requested pathname and 307-redirects to it. Used as the <img> src for
 * both saved and pending attachment thumbnails. Any signed-in user can sign any
 * pathname they pass; pathnames carry a random suffix (unguessable) and this is
 * a single-user tool, so that tradeoff is acceptable.
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const pathname = new URL(req.url).searchParams.get("pathname");
  if (!pathname) return new Response("pathname is required", { status: 400 });

  try {
    const signedUrl = await presignBlobGetUrl(pathname);
    return Response.redirect(signedUrl, 307);
  } catch {
    return new Response("Failed to sign blob URL", { status: 500 });
  }
}
