import { auth } from "@clerk/nextjs/server";
import { archiveCompletedPatches } from "@/lib/queries";

// GUI equivalent of the cp_archive_completed MCP tool: archive every done,
// non-archived patch in one shot. Scoped to a project when `project` (slug) is
// provided, otherwise applies across all of the user's projects.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const project =
    typeof body?.project === "string" && body.project.trim()
      ? body.project.trim()
      : undefined;

  const result = await archiveCompletedPatches(userId, project);
  return Response.json(result);
}
