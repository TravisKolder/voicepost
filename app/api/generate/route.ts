import { NextRequest, NextResponse } from "next/server";
import { composePrompt, Mode } from "@/lib/prompts/compose";
import { callClaude, AnthropicError } from "@/lib/anthropic";
import { parseOutput } from "@/lib/parse-output";
import { reviewCoherence } from "@/lib/coherence-review";

const VALID_MODES = new Set<Mode>(["voice-first", "balanced", "reach-first"]);
const MIN_TRANSCRIPT_LENGTH = 50;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  const { transcript, mode, voiceSpec } = body as Record<string, unknown>;

  if (typeof transcript !== "string" || transcript.trim().length < MIN_TRANSCRIPT_LENGTH) {
    return NextResponse.json(
      { error: `transcript must be a string of at least ${MIN_TRANSCRIPT_LENGTH} characters` },
      { status: 400 },
    );
  }

  if (typeof mode !== "string" || !VALID_MODES.has(mode as Mode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${[...VALID_MODES].join(", ")}` },
      { status: 400 },
    );
  }

  const validMode = mode as Mode;
  // In owner mode, always use the built-in VOICE_SPEC regardless of what the client sends.
  const ownerMode = process.env.OWNER_MODE === "true";
  const specOverride =
    !ownerMode && typeof voiceSpec === "string" && voiceSpec.trim() ? voiceSpec : undefined;

  try {
    const [xRaw, blogRaw] = await Promise.all([
      callClaude(composePrompt("x", validMode, specOverride), transcript),
      callClaude(composePrompt("blog", validMode, specOverride), transcript),
    ]);

    const xPost = parseOutput(xRaw);
    const blogPost = parseOutput(blogRaw);

    const [xReviewResult, blogReviewResult] = await Promise.allSettled([
      reviewCoherence(transcript, xPost.body, "x"),
      reviewCoherence(transcript, blogPost.body, "blog"),
    ]);

    const xReview =
      xReviewResult.status === "fulfilled" ? xReviewResult.value : { drifted: false as const };
    const blogReview =
      blogReviewResult.status === "fulfilled"
        ? blogReviewResult.value
        : { drifted: false as const };

    return NextResponse.json({
      xPost: { ...xPost, review: xReview },
      blogPost: { ...blogPost, review: blogReview },
    });
  } catch (err) {
    if (err instanceof AnthropicError) {
      if (err.code === "missing_api_key") {
        return NextResponse.json(
          { error: "Server misconfiguration: ANTHROPIC_API_KEY is not set" },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
