import { auth } from "@clerk/nextjs/server";
import { deleteSpecSection, getSectionThenAndNow, updateSpecSection } from "@/lib/specs";

type Params = { params: Promise<{ id: string }> };

// ?at=<ISO>: the section as it read then (e.g. when a patch was filed) and now.
export async function GET(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const at = new URL(req.url).searchParams.get("at");
  if (!at || Number.isNaN(Date.parse(at))) {
    return Response.json({ error: "at must be an ISO timestamp" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Section not found" }, { status: 404 });
  const result = await getSectionThenAndNow(userId, id, at);
  if (!result) return Response.json({ error: "Section not found" }, { status: 404 });
  return Response.json(result);
}

// Autosave + "Reference only" toggle target for the spec editor:
// { heading?, body?, reference_only? }, attributed to Nae.
export async function PATCH(req: Request, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { heading, body, reference_only } = await req.json();
  if (heading !== undefined && (typeof heading !== "string" || !heading.trim())) {
    return Response.json({ error: "Heading can't be empty" }, { status: 400 });
  }
  if (body !== undefined && typeof body !== "string") {
    return Response.json({ error: "body must be text" }, { status: 400 });
  }
  if (reference_only !== undefined && typeof reference_only !== "boolean") {
    return Response.json({ error: "reference_only must be true or false" }, { status: 400 });
  }
  if (heading === undefined && body === undefined && reference_only === undefined) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }
  const section = await updateSpecSection(
    userId,
    id,
    { heading: heading?.trim(), body, referenceOnly: reference_only },
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
