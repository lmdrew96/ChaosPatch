import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getProjects } from "@/lib/queries";
import { AddPatchForm } from "./add-patch-form";

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { project: defaultSlug } = await searchParams;
  const projects = await getProjects(userId);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-sm font-medium text-muted-foreground">
          <span className="text-foreground">ChaosPatch</span> / Add patch
        </h1>
      </header>
      <main className="px-6 py-10 max-w-md mx-auto">
        <AddPatchForm projects={projects} defaultSlug={defaultSlug} />
      </main>
    </div>
  );
}
