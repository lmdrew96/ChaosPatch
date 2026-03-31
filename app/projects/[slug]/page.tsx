import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getPatches, getProjectBySlug } from "@/lib/queries";
import type { Patch } from "@/lib/queries";
import { PatchList } from "./patch-list";

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

  const open = patches.filter((p) => p.status === "open");
  const inProgress = patches.filter((p) => p.status === "in_progress");
  const done = patches.filter((p) => p.status === "done");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
        >
          ← Projects
        </Link>
        <span className="text-zinc-700">/</span>
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <h1 className="text-sm font-medium text-zinc-200">{project.name}</h1>
        </div>
        <div className="ml-auto">
          <Link
            href={`/add?project=${slug}`}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium transition-colors"
          >
            + Add patch
          </Link>
        </div>
      </header>

      <main className="px-6 py-8 max-w-3xl mx-auto space-y-8">
        {inProgress.length > 0 && (
          <Section title="In Progress" patches={inProgress} />
        )}
        <Section title="Open" patches={open} />
        {done.length > 0 && <Section title="Done" patches={done} />}
        {patches.length === 0 && (
          <p className="text-center text-zinc-600 text-sm py-16">
            No patches yet. Add one with the button above.
          </p>
        )}
      </main>
    </div>
  );
}

function Section({ title, patches }: { title: string; patches: Patch[] }) {
  if (patches.length === 0) return null;
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        {title}
        <span className="ml-2 font-mono text-zinc-600">{patches.length}</span>
      </h2>
      <PatchList patches={patches} />
    </div>
  );
}
