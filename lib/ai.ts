import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import { z } from "zod";
import { presignGetUrl } from "@/lib/r2";

/** The one place the in-app Claude model is chosen. */
export const AI_MODEL = "claude-sonnet-5-5";

// Thinking is adaptive (on by default on Sonnet 5.5); effort sets how hard it
// thinks. Patch generation (screenshot → patch, spec → patches) runs at high,
// per Nae; the changelog writer stays at low.
type Effort = "low" | "medium" | "high";

/** Thrown when ANTHROPIC_API_KEY isn't set, so routes can answer 503. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI features aren't configured: set ANTHROPIC_API_KEY.");
  }
}

let client: Anthropic | null = null;

const getClient = (): Anthropic => {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiNotConfiguredError();
  client ??= new Anthropic();
  return client;
};

/**
 * Parse a structured response, turning refusals and unparseable output into
 * plain errors the routes can surface. Streams so a large max_tokens (high
 * effort thinking + long output) doesn't hit the SDK's non-streaming limit.
 */
const parseStructured = async <T extends z.ZodType>(
  schema: T,
  params: {
    system: string;
    content: Anthropic.ContentBlockParam[];
    // Thinking tokens count toward this, so leave plenty of room at high effort.
    maxTokens: number;
    effort: Effort;
  }
): Promise<z.infer<T>> => {
  const response = await getClient()
    .messages.stream({
      model: AI_MODEL,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [{ role: "user", content: params.content }],
      output_config: { effort: params.effort, format: zodOutputFormat(schema) },
    })
    .finalMessage();
  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined this request.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "The answer ran past its length limit. Try fewer sections at a time."
    );
  }
  if (!response.parsed_output) {
    throw new Error("Claude's response couldn't be read — try again.");
  }
  return response.parsed_output;
};

// ── Patch from a screenshot ───────────────────────────────────────────────

const PatchDraftSchema = z.object({
  title: z.string(),
  notes: z.string(),
});

export type PatchDraft = z.infer<typeof PatchDraftSchema>;

const DRAFT_SYSTEM = `You turn a screenshot of a software bug or UI problem into a draft patch for a developer's tracker.

Write:
- title: one short imperative line naming what's wrong and where (e.g. "Fix overlapping labels on the dashboard stats card"). No trailing period.
- notes: brief markdown. Say what is visibly wrong and where on screen, then what it probably should look like or do. Quote visible error text exactly. Use a short bullet list when there's more than one issue.

Describe only what the screenshot shows. If the problem isn't obvious, say what stands out and flag that the intent is unclear rather than inventing a cause.`;

// Anthropic's per-image cap is 5MB; their recommended long edge is 1568px.
const MAX_IMAGE_EDGE = 1568;

/** Load an R2 image and shrink it to a size Claude accepts and reads well. */
const loadImageForClaude = async (
  pathname: string
): Promise<Anthropic.ImageBlockParam> => {
  const res = await fetch(await presignGetUrl(pathname));
  if (!res.ok) throw new Error(`Couldn't load the screenshot (HTTP ${res.status}).`);
  const data = await sharp(Buffer.from(await res.arrayBuffer()))
    .rotate()
    .resize({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  return {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: data.toString("base64") },
  };
};

export const draftPatchFromScreenshot = async (
  pathname: string,
  projectName: string | null
): Promise<PatchDraft> => {
  const image = await loadImageForClaude(pathname);
  return parseStructured(PatchDraftSchema, {
    system: DRAFT_SYSTEM,
    maxTokens: 32000,
    effort: "high",
    content: [
      image,
      {
        type: "text",
        text: projectName
          ? `Project: ${projectName}. Draft a patch for this screenshot.`
          : "Draft a patch for this screenshot.",
      },
    ],
  });
};

// ── Changelog ─────────────────────────────────────────────────────────────

const ChangelogSchema = z.object({
  features: z.array(z.string()),
  fixes: z.array(z.string()),
  polish: z.array(z.string()),
});

export type ChangelogSections = z.infer<typeof ChangelogSchema>;

const CHANGELOG_SYSTEM = `You write release notes for a small software project from its completed dev tickets ("patches").

Sort every patch into exactly one group:
- features: something new a user can now do or see
- fixes: something that was broken and now works
- polish: refinements, performance, copy, visual tweaks, internal cleanup a user might notice

Write each entry as one plain-language sentence for the people who use the app, not the developer: describe the effect, not the implementation. Drop ticket shorthand, version numbers, file names, and internal tool names unless a user would recognize them. Merge patches that describe the same change into one entry. Leave out patches with no user-visible effect (pure refactors, test-only or tooling changes) unless that would leave every group empty. Start each entry with a capital letter and end it with a period. No markdown inside entries except inline code for things a user types.`;

const NOTES_EXCERPT = 600;

export const draftChangelog = async (
  projectName: string,
  patches: { title: string; notes: string | null; tags: string[] }[]
): Promise<ChangelogSections> => {
  const list = patches
    .map((p, i) => {
      const notes = p.notes?.trim()
        ? `\n   Notes: ${p.notes.trim().slice(0, NOTES_EXCERPT).replace(/\s+/g, " ")}`
        : "";
      const tags = p.tags.length ? ` [${p.tags.join(", ")}]` : "";
      return `${i + 1}. ${p.title}${tags}${notes}`;
    })
    .join("\n");
  return parseStructured(ChangelogSchema, {
    system: CHANGELOG_SYSTEM,
    maxTokens: 32000,
    effort: "low",
    content: [
      {
        type: "text",
        text: `Project: ${projectName}\n\nCompleted patches:\n${list}`,
      },
    ],
  });
};

// ── Patches from a spec (Specs 4/5) ───────────────────────────────────────
// ONE prompt for both paths — the in-app "Generate patches" button and
// cp_propose_patches_from_spec over MCP — so specs break down the same way
// whichever one Nae uses. Proposals are never filed here.

const SpecPatchesSchema = z.object({
  patches: z.array(
    z.object({
      section_id: z.string(),
      title: z.string(),
      notes: z.string(),
      tags: z.array(z.string()),
      priority: z.enum(["low", "medium", "high"]),
    })
  ),
});

export type ProposedPatch = z.infer<typeof SpecPatchesSchema>["patches"][number] & {
  section_heading: string;
};

export const SPEC_PATCHES_SYSTEM = `You break a software spec into patches (dev tickets) for a solo developer's tracker. A coding agent implements each patch, then the developer reviews it.

You get the whole spec for context, then the sections to break down. Only propose patches for those sections, and set section_id to the id of the section each patch comes from.

Each patch:
- title: one short imperative line naming the change (e.g. "Add CSV export to the reports page"). No trailing period, no ticket numbers.
- notes: brief markdown. One or two sentences of context, then "AC:" and a short bullet list of acceptance criteria that can be checked by using the app. Keep the spec's own words for decisions it states; never invent requirements, numbers, or names it doesn't give. If something the patch needs is undecided in the spec, add an "Open question:" line instead of picking an answer.
- tags: 1–4 short lowercase tags (e.g. "ui", "db", "api", "mcp", "bug"), plus exactly one of "energy:low", "energy:med", "energy:high" for how much focus the work takes.
- priority: "high" only if other patches depend on it or the spec calls it core; otherwise "medium", or "low" for nice-to-haves.

Build order: if the spec has a build order, phases, or milestones anywhere in it (even in a section you aren't breaking down), add one tag "phase:N" to every patch you propose, where N is the number of the spec's phase that patch belongs to (use the spec's own numbering). Every patch gets one; pick the closest phase when the fit isn't exact. If the spec has no build order, add no phase tags. Either way, when a patch can't start until another is done, say so in its notes on a line "Depends on: <exact title>", naming either another proposal or a patch already on the board. List proposals in the order they should be built.

Sizing: one patch = one session's work that ends with something testable (backend + UI shipped end to end). Fold siblings that share one generator, template set, or file into one patch: the variants of one generator, the entries of one data file, the fields of one form. Split things the spec calls standalone or one session each into one patch apiece, and never bundle several separately shippable sessions into one patch. When the spec states its own sizing ("one session", "standalone", "each session should add one…"), follow it exactly. Data-model or schema work that other patches rely on gets its own patch, listed first. Sections that describe goals, context, or out-of-scope items usually need no patch: propose none for them.

You also get every patch already on the project's board, whichever section it was filed under. Work is covered if any of them already does it, even one filed under a different section: a summary or build-order section is usually covered by patches filed under the design sections it summarizes. Never propose a patch that duplicates or overlaps one on the board. If the spec changes how a board patch should be built (a later section replaces its approach, say), propose only the change itself, and start its notes with "Changes: <that patch's exact title>" so the developer can reconcile the two. Propose only what is still missing; proposing nothing is a good answer when everything is covered.`;

export const proposePatchesFromSpec = async (input: {
  projectName: string;
  specTitle: string;
  // Every section, in order, for context.
  sections: { id: string; heading: string; body: string }[];
  // The ones to break down, each with the titles already filed from it.
  targets: { id: string; existingPatchTitles: string[] }[];
  // Every patch already on the project's board (any section, any status).
  board: { title: string; status: string; section_heading: string | null }[];
}): Promise<ProposedPatch[]> => {
  const byId = new Map(input.sections.map((s) => [s.id, s]));
  const fullSpec = input.sections
    .map((s) => `## ${s.heading}\n${s.body.trim() || "(empty)"}`)
    .join("\n\n");
  const targetList = input.targets
    .map((t) => {
      const s = byId.get(t.id);
      if (!s) return "";
      const existing = t.existingPatchTitles.length
        ? `\nAlready filed from this section:\n${t.existingPatchTitles.map((x) => `- ${x}`).join("\n")}`
        : "";
      return `<section id="${s.id}" heading="${s.heading.replace(/"/g, "'")}">\n${s.body.trim()}${existing}\n</section>`;
    })
    .join("\n\n");

  const boardList = input.board.length
    ? input.board
        .map(
          (p) =>
            `- ${p.title} [${p.status}]${p.section_heading ? ` (filed under: ${p.section_heading})` : ""}`
        )
        .join("\n")
    : "(no patches yet)";

  const result = await parseStructured(SpecPatchesSchema, {
    system: SPEC_PATCHES_SYSTEM,
    // A fresh breakdown of a big spec can run 20+ detailed patches.
    maxTokens: 64000,
    effort: "high",
    content: [
      {
        type: "text",
        text: `Project: ${input.projectName}\nSpec: ${input.specTitle}\n\n<spec>\n${fullSpec}\n</spec>\n\n<board>\n${boardList}\n</board>\n\nBreak down these sections:\n\n${targetList}`,
      },
    ],
  });

  // Keep only proposals pointing at a section we asked about.
  const allowed = new Set(input.targets.map((t) => t.id));
  return result.patches
    .filter((p) => allowed.has(p.section_id) && p.title.trim())
    .map((p) => ({
      ...p,
      title: p.title.trim(),
      tags: [...new Set(p.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
      section_heading: byId.get(p.section_id)?.heading ?? "",
    }));
};
