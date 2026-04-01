import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProjects, getAllPatches } from "@/lib/queries";
import { NewProjectButton } from "./new-project-button";
import { HomeContent } from "./home-content";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [projects, patches] = await Promise.all([
    getProjects(userId),
    getAllPatches(userId),
  ]);

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
        <HomeContent projects={projects} patches={patches} />
      </main>
    </div>
  );
}
