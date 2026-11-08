import { auth } from "@clerk/nextjs/server";
import { deleteSpecSection, updateSpecSection } from "@/lib/specs";

type Params = { params: Promise<{ id: string }> };

// Autosave target for the spec editor: { heading?, body? }, attributed to Nae.
export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { heading, body } = await req.json();
  if (heading !== undefined && (typeof heading !== "string" || !heading.trim())) {
    return Response.json({ error: "Heading can't be empty" }, { status: 400 });
  }
  if (body !== undefined && typeof body !== "string") {
    return Response.json({ error: "body must be text" }, { status: 400 });
  }
  if (heading === undefined && body === undefined) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }
  const section = await updateSpecSection(
    userId,
    id,
    { heading: heading?.trim(), body },
    "nae"
  );
  if (!section) return Response.json({ error: "Section not found" }, { status: 404 });
  return Response.json(section);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await deleteSpecSection(userId, id, "nae"))) {
    return Response.json({ error: "Section not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
