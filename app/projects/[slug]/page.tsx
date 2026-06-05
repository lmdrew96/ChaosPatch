import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getArchivedPatches,
  getAttachmentsForPatchIds,
  getDistinctTags,
  getPatches,
  getProjectBySlug,
  type Patch,
  type PatchAttachment,
} from "@/lib/queries";
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

  const [patches, archivedPatches, existingTags] = await Promise.all([
    getPatches(userId, slug),
    getArchivedPatches(userId, slug),
    getDistinctTags(userId),
  ]);

  // Attach images to each patch in one query (no N+1).
  const allPatchIds = [...patches, ...archivedPatches].map((p) => p.id);
  const attachments = await getAttachmentsForPatchIds(userId, allPatchIds);
  const byPatch = new Map<string, PatchAttachment[]>();
  for (const a of attachments) {
    const list = byPatch.get(a.patch_id) ?? [];
    list.push(a);
    byPatch.set(a.patch_id, list);
  }
  const withImages = (list: Patch[]): Patch[] =>
    list.map((p) => ({ ...p, attachments: byPatch.get(p.id) ?? [] }));

  const patchesWithImages = withImages(patches);
  const archivedWithImages = withImages(archivedPatches);

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <header className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors shrink-0"
            >
              <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
              Projects
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
            className="rounded-md bg-primary hover:bg-primary/90 px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors shrink-0"
          >
            + Add patch
          </Link>
        </div>
      </header>

      <main className="px-6 py-8 max-w-3xl mx-auto space-y-8">
        <ProjectPatchView
          patches={patchesWithImages}
          archivedPatches={archivedWithImages}
          existingTags={existingTags}
        />

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
