import { auth } from "@clerk/nextjs/server";
import { addSpecSection } from "@/lib/specs";

// Append a section (attributed to Nae).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { heading, body } = await req.json();
  if (typeof heading !== "string" || !heading.trim()) {
    return Response.json({ error: "heading is required" }, { status: 400 });
  }
  const section = await addSpecSection(
    userId,
    id,
    heading.trim(),
    typeof body === "string" ? body : "",
    "nae"
  );
  if (!section) return Response.json({ error: "Spec not found" }, { status: 404 });
  return Response.json(section, { status: 201 });
}
