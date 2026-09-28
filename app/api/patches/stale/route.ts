import { auth } from "@clerk/nextjs/server";
import { getStaleCount } from "@/lib/queries";

// Header badge count: active patches untouched for STALE_DAYS.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const count = await getStaleCount(userId);
  return Response.json({ count });
}
