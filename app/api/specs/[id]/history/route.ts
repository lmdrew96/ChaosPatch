import { auth } from "@clerk/nextjs/server";
import { getSpec, getSpecHistory } from "@/lib/specs";

const UUID = /^[0-9a-f-]{36}$/i;

// Revisions for the spec (or one section with ?section_id=), newest first.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sectionId = new URL(req.url).searchParams.get("section_id") ?? undefined;
  if (!UUID.test(id) || (sectionId && !UUID.test(sectionId))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await getSpec(userId, id))) return Response.json({ error: "Spec not found" }, { status: 404 });
  return Response.json(await getSpecHistory(userId, id, sectionId));
}
