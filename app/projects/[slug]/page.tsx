import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getPatches, getProjectBySlug } from "@/lib/queries";
import { DeleteProjectButton } from "./delete-project-button";
import { EditProjectButton } from "./edit-project-button";
import { ProjectPatchView } from "./project-patch-view";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { slug } = await params;
  const project = await getProjectBySlug(userId, slug);
  if (!project) notFound();

  const patches = await getPatches(userId, slug);

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <header className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors shrink-0"
            >
              ← Projects
            </Link>
            <span className="text-border shrink-0">/</span>
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <h1 className="text-sm font-medium text-foreground/90 truncate">{project.name}</h1>
              <EditProjectButton
                slug={slug}
                currentName={project.name}
                currentColor={project.color}
              />
            </div>
          </div>
          <Link
            href={`/add?project=${slug}`}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors shrink-0"
          >
            + Add patch
          </Link>
        </div>
      </header>

      <main className="px-6 py-8 max-w-3xl mx-auto space-y-8">
        <ProjectPatchView patches={patches} />

        {/* Danger zone */}
        <div className="border-t border-border pt-8 mt-12">
          <div className="rounded-lg border border-red-950 bg-red-950/10 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-red-400 mb-2">
              Danger zone
            </h3>
            <p className="text-xs text-muted-foreground/70 mb-4">
              Permanently delete <strong className="text-foreground/70">{project.name}</strong> and
              all {patches.length} {patches.length === 1 ? "patch" : "patches"}.
              This cannot be undone.
            </p>
            <DeleteProjectButton slug={slug} projectName={project.name} />
          </div>
        </div>
      </main>
    </div>
  );
}
