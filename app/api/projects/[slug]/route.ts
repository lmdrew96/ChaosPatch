import { auth } from "@clerk/nextjs/server";
import { deleteProject } from "@/lib/queries";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  await deleteProject(userId, slug);
  return new Response(null, { status: 204 });
}
