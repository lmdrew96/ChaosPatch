import { auth } from "@clerk/nextjs/server";
import { AiNotConfiguredError, proposePatchesFromSpec } from "@/lib/ai";
import { getSpec, pickProposalTargets, SpecError } from "@/lib/specs";

/**
 * "Generate patches": propose patches for a linked spec. Nothing is filed —
 * the editor shows the proposals and Nae approves them (see ../file).
 * Body: { section_ids?: string[] } to target specific sections.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { section_ids } = await req.json().catch(() => ({}));

  const spec = await getSpec(userId, id);
  if (!spec) return Response.json({ error: "Spec not found" }, { status: 404 });
  if (!spec.project_name) {
    return Response.json(
      { error: "Attach this spec to a project first: patches need a project to go in." },
      { status: 400 }
    );
  }

  try {
    const { targets, skipped } = pickProposalTargets(
      spec,
      Array.isArray(section_ids) ? section_ids.map(String) : undefined
    );
    const proposals =
      targets.length === 0
        ? []
        : await proposePatchesFromSpec({
            projectName: spec.project_name,
            specTitle: spec.title,
            sections: spec.sections,
            targets,
          });
    return Response.json({ proposals, skipped });
  } catch (err) {
    if (err instanceof SpecError) return Response.json({ error: err.message }, { status: 400 });
    if (err instanceof AiNotConfiguredError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error("Spec patch proposal failed", err);
    const message = err instanceof Error ? err.message : "Generating patches failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
