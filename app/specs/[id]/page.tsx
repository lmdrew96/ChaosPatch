import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProjects } from "@/lib/queries";
import { getSpec } from "@/lib/specs";
import { SpecEditor } from "./spec-editor";

export default async function SpecPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  // A malformed id would make Postgres throw on the uuid cast; treat it as missing.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [spec, projects] = await Promise.all([getSpec(userId, id), getProjects(userId)]);
  if (!spec) notFound();

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      <header className="border-b border-border px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={spec.project_slug ? `/projects/${spec.project_slug}` : "/dashboard?view=specs"}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm transition-colors shrink-0"
          >
            <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
            {spec.project_name ?? "Specs"}
          </Link>
          <span className="text-border shrink-0">/</span>
          <span className="text-sm text-foreground/80 truncate">{spec.title}</span>
        </div>
      </header>
      <main className="px-4 py-8 sm:px-6 max-w-3xl mx-auto">
        <SpecEditor
          initialSpec={spec}
          projects={projects.map((p) => ({ slug: p.slug, name: p.name }))}
        />
      </main>
    </div>
  );
}
