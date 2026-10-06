import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import { z } from "zod";
import { presignGetUrl } from "@/lib/r2";

/** The one place the in-app Claude model is chosen. */
export const AI_MODEL = "claude-sonnet-5-5";

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
 * plain errors the routes can surface.
 */
const parseStructured = async <T extends z.ZodType>(
  schema: T,
  params: {
    system: string;
    content: Anthropic.ContentBlockParam[];
    maxTokens: number;
  }
): Promise<z.infer<T>> => {
  const response = await getClient().messages.parse({
    model: AI_MODEL,
    max_tokens: params.maxTokens,
    system: params.system,
    messages: [{ role: "user", content: params.content }],
    output_config: { effort: "low", format: zodOutputFormat(schema) },
  });
  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined this request.");
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
    maxTokens: 4000,
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
