import { auth } from "@clerk/nextjs/server";
import {
  archiveProject,
  ProjectHasActiveWorkError,
  unarchiveProject,
} from "@/lib/queries";

// POST archives (body { force?: boolean }); DELETE unarchives.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  try {
    const project = await archiveProject(userId, slug, force);
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
    return Response.json(project);
  } catch (err) {
    if (err instanceof ProjectHasActiveWorkError) {
      return Response.json(
        { error: err.message, in_progress_count: err.inProgressCount },
        { status: 409 }
      );
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const project = await unarchiveProject(userId, slug);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
  return Response.json(project);
}
