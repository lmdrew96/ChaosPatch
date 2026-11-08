import { auth } from "@clerk/nextjs/server";
import { fileSpecPatches, getSpec, SpecError, type PatchToFile } from "@/lib/specs";

const PRIORITIES = new Set(["low", "medium", "high"]);

/** File the proposals Nae approved, each linked to its source section. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { patches } = await req.json();
  if (!Array.isArray(patches) || patches.length === 0) {
    return Response.json({ error: "No patches to file" }, { status: 400 });
  }

  const toFile: PatchToFile[] = [];
  for (const raw of patches as Record<string, unknown>[]) {
    if (typeof raw?.section_id !== "string" || typeof raw.title !== "string") {
      return Response.json({ error: "Each patch needs a section_id and title" }, { status: 400 });
    }
    toFile.push({
      section_id: raw.section_id,
      title: raw.title,
      notes: typeof raw.notes === "string" ? raw.notes : undefined,
      tags: Array.isArray(raw.tags)
        ? raw.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim())
        : [],
      priority: PRIORITIES.has(String(raw.priority))
        ? (raw.priority as PatchToFile["priority"])
        : "medium",
    });
  }

  const spec = await getSpec(userId, id);
  if (!spec) return Response.json({ error: "Spec not found" }, { status: 404 });
  try {
    const filed = await fileSpecPatches(userId, spec, toFile);
    return Response.json({ filed }, { status: 201 });
  } catch (err) {
    if (err instanceof SpecError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
