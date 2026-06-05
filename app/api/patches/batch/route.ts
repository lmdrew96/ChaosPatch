import { auth } from "@clerk/nextjs/server";
import { batchUpdatePatches } from "@/lib/queries";

const ACTIONS = ["start", "complete", "reopen"] as const;
type Action = (typeof ACTIONS)[number];

function isAction(value: unknown): value is Action {
  return typeof value === "string" && (ACTIONS as readonly string[]).includes(value);
}

// GUI equivalent of the cp_batch_update MCP tool: bulk-apply a status change
// across many patches in one call. Ownership is enforced inside the query.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const patchIds = Array.isArray(body?.patch_ids)
    ? body.patch_ids.filter((id: unknown): id is string => typeof id === "string")
    : null;
  const action = body?.action;

  if (!patchIds || patchIds.length === 0) {
    return Response.json(
      { error: "patch_ids must be a non-empty array of strings" },
      { status: 400 }
    );
  }
  if (!isAction(action)) {
    return Response.json(
      { error: `action must be one of: ${ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const result = await batchUpdatePatches(userId, patchIds, action);
  return Response.json(result);
}
