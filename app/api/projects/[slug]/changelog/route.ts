import { auth } from "@clerk/nextjs/server";
import { AiNotConfiguredError, draftChangelog, type ChangelogSections } from "@/lib/ai";
import {
  getCompletedPatchesInRange,
  getProjectBySlug,
  setLastChangelogAt,
} from "@/lib/queries";

const SECTIONS: { key: keyof ChangelogSections; heading: string }[] = [
  { key: "features", heading: "New" },
  { key: "fixes", heading: "Fixed" },
  { key: "polish", heading: "Polish" },
];

const toMarkdown = (title: string, sections: ChangelogSections): string => {
  const body = SECTIONS.filter(({ key }) => sections[key].length > 0)
    .map(({ key, heading }) =>
      [`### ${heading}`, ...sections[key].map((entry) => `- ${entry}`)].join("\n")
    )
    .join("\n\n");
  return `## ${title}\n\n${body || "_No user-visible changes in this range._"}\n`;
};

const isInstant = (v: unknown): v is string =>
  typeof v === "string" && !Number.isNaN(Date.parse(v));

/**
 * Generate release notes from a project's patches completed in
 * [since, until). The client converts its local-day range to instants, and
 * sends the local dates as labels for the heading. Remembers `until` (capped
 * at now) as the project's last changelog date.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { since, until, from_label, to_label } = await req.json();
  if (!isInstant(since) || !isInstant(until) || Date.parse(since) >= Date.parse(until)) {
    return Response.json({ error: "Pick a start date before the end date." }, { status: 400 });
  }

  const project = await getProjectBySlug(userId, slug);
  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const patches = await getCompletedPatchesInRange(userId, slug, since, until);
  if (patches.length === 0) {
    return Response.json({ markdown: null, count: 0 });
  }

  try {
    const sections = await draftChangelog(project.name, patches);
    const title =
      typeof from_label === "string" && typeof to_label === "string"
        ? `${project.name} — ${from_label} to ${to_label}`
        : project.name;
    const covered = new Date(Math.min(Date.parse(until), Date.now())).toISOString();
    await setLastChangelogAt(userId, slug, covered);
    return Response.json({
      markdown: toMarkdown(title, sections),
      count: patches.length,
      last_changelog_at: covered,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error("Changelog generation failed", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
