import { auth } from "@clerk/nextjs/server";
import { del } from "@vercel/blob";

/**
 * Delete a blob by url. Used to clean up a *pending* add-form image the user
 * removes before the patch (and its attachment rows) exist. Auth-gated; blob
 * urls carry a random suffix so they're unguessable.
 */
export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await request.json();
  if (typeof url !== "string" || !url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }
  try {
    await del(url);
  } catch {
    // ignore — blob may already be gone
  }
  return new Response(null, { status: 204 });
}
