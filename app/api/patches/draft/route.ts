import { auth } from "@clerk/nextjs/server";
import { AiNotConfiguredError, draftPatchFromScreenshot } from "@/lib/ai";
import { getProjectBySlug } from "@/lib/queries";

/**
 * Draft a patch title + notes from an already-uploaded screenshot. Nothing is
 * saved — the Add Patch form fills its fields and the user decides.
 */
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { pathname, project_slug } = await req.json();
  if (typeof pathname !== "string" || !pathname.startsWith("attachments/")) {
    return Response.json({ error: "pathname is required" }, { status: 400 });
  }

  const project =
    typeof project_slug === "string" && project_slug
      ? await getProjectBySlug(userId, project_slug)
      : null;

  try {
    const draft = await draftPatchFromScreenshot(pathname, project?.name ?? null);
    return Response.json(draft);
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error("Screenshot draft failed", err);
    const message = err instanceof Error ? err.message : "Drafting failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
