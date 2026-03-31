import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProjects } from "@/lib/queries";
import type { Project } from "@/lib/queries";
import { NewProjectButton } from "./new-project-button";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const projects = await getProjects(userId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">ChaosPatch</h1>
        <div className="flex items-center gap-3">
          <NewProjectButton />
          <Link
            href="/add"
            className="rounded-md border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 text-sm text-zinc-300 hover:text-zinc-100 font-medium transition-colors"
          >
            + New patch
          </Link>
          <Link
            href="/settings"
            className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Settings
          </Link>
        </div>
      </header>

      <main className="px-6 py-8 max-w-4xl mx-auto">
        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const openCount = project.open_count ?? 0;
  return (
    <Link href={`/projects/${project.slug}`}>
      <div className="group rounded-lg border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-600 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-3 h-3 rounded-full mt-1 shrink-0"
            style={{ backgroundColor: project.color }}
          />
          {openCount > 0 && (
            <span className="text-xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
              {openCount} open
            </span>
          )}
        </div>
        <p className="font-medium text-zinc-100 group-hover:text-white truncate">
          {project.name}
        </p>
        <p className="mt-1 text-xs font-mono text-zinc-500">{project.slug}</p>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-24">
      <p className="text-zinc-500 text-sm">No projects yet.</p>
      <p className="text-zinc-600 text-xs mt-1">
        Use <strong className="text-zinc-400">+ New project</strong> above, or from Claude Code with{" "}
        <code className="font-mono bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400">
          cp_add_project
        </code>
        .
      </p>
    </div>
  );
}
