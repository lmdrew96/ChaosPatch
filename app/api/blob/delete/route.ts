import { auth } from "@clerk/nextjs/server";
import { deleteObject } from "@/lib/r2";

/**
 * Delete an object by key. Used to clean up a *pending* add-form image the
 * user removes before the patch (and its attachment rows) exist. Auth-gated;
 * keys carry a random prefix so they're unguessable.
 */
export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { pathname } = await request.json();
  if (typeof pathname !== "string" || !pathname) {
    return Response.json({ error: "pathname is required" }, { status: 400 });
  }
  try {
    await deleteObject(pathname);
  } catch {
    // ignore — object may already be gone
  }
  return new Response(null, { status: 204 });
}
