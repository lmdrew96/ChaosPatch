import { auth } from "@clerk/nextjs/server";
import { AiNotConfiguredError } from "@/lib/ai";
import { getSpec, planProposalBatches, runSpecProposal, SpecError } from "@/lib/specs";

// High-effort Claude call: a fresh breakdown of a big spec took ~3 min in
// testing. 300s is the Fluid compute default and the Hobby maximum.
export const maxDuration = 300;

/**
 * "Generate patches": propose patches for a linked spec. Nothing is filed —
 * the editor shows the proposals and Nae approves them (see ../file).
 * Body: { section_ids?: string[], pending_titles?: string[] } (one batch, seeing
 * earlier batches' unfiled proposals), or { plan: true } for the batch plan.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { section_ids, pending_titles, plan } = await req.json().catch(() => ({}));

  const spec = await getSpec(userId, id);
  if (!spec) return Response.json({ error: "Spec not found" }, { status: 404 });

  try {
    // { plan: true }: how a whole-spec run splits into batches. The editor
    // then runs each batch as its own request (see planProposalBatches).
    if (plan === true) {
      if (!spec.project_id) {
        return Response.json(
          { error: "Attach this spec to a project first: patches need a project to go in." },
          { status: 400 }
        );
      }
      return Response.json(planProposalBatches(spec));
    }
    const result = await runSpecProposal(
      userId,
      spec,
      Array.isArray(section_ids) ? section_ids.map(String) : undefined,
      Array.isArray(pending_titles) ? pending_titles.map(String).slice(0, 500) : []
    );
    return Response.json(result);
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
