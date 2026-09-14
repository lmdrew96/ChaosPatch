import { auth } from "@clerk/nextjs/server";
import {
  BATCH_ACTIONS,
  batchUpdatePatches,
  getAttachmentsForPatchIds,
  type BatchUpdateAction,
  type Patch,
} from "@/lib/queries";
import { deleteObjects } from "@/lib/r2";

const PRIORITIES: readonly Patch["priority"][] = ["low", "medium", "high"];

function isAction(value: unknown): value is BatchUpdateAction {
  return typeof value === "string" && (BATCH_ACTIONS as readonly string[]).includes(value);
}

function isPriority(value: unknown): value is Patch["priority"] {
  return typeof value === "string" && (PRIORITIES as readonly string[]).includes(value);
}

// GUI equivalent of the cp_batch_update MCP tool: bulk-apply one action across
// many patches in one call. Ownership is enforced inside the query.
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
      { error: `action must be one of: ${BATCH_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  let priority: Patch["priority"] | undefined;
  if (action === "set_priority") {
    if (!isPriority(body?.priority)) {
      return Response.json(
        { error: `priority must be one of: ${PRIORITIES.join(", ")}` },
        { status: 400 }
      );
    }
    priority = body.priority;
  }

  let tags: string[] | undefined;
  if (action === "add_tags") {
    tags = Array.isArray(body?.tags)
      ? body.tags
          .map((t: unknown) => (typeof t === "string" ? t.trim() : ""))
          .filter((t: string) => t.length > 0)
      : [];
    if (!tags || tags.length === 0) {
      return Response.json(
        { error: "tags must be a non-empty array of strings" },
        { status: 400 }
      );
    }
  }

  // Grab storage keys before the cascade removes the attachment rows.
  const attachments =
    action === "delete" ? await getAttachmentsForPatchIds(userId, patchIds) : [];

  const result = await batchUpdatePatches(userId, patchIds, action, { priority, tags });

  await deleteObjects(attachments.map((a) => a.pathname));

  return Response.json(result);
}
