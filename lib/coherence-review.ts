const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export interface CoherenceReview {
  drifted: boolean;
  revisedBody?: string;
  reason?: string;
}

const SYSTEM_PROMPT = `You are a coherence reviewer for written posts. Your sole job is to detect SIGNIFICANT drift between a post's opening and its ending — and to fix that drift when present, without changing anything else.

DRIFT means: the opening establishes a central idea or argument, but the post ends up landing on a distinctly different idea or conclusion, so the ending doesn't fulfill what the opening promised.

What is NOT drift:
- Intentional pivots that are clearly earned and signaled
- Earned turns: the post builds toward a shift in a way the reader follows
- Cosmetic variation: rephrasing or elaborating on the same core idea
- Developing the same idea in more depth or from a different angle

Only flag SIGNIFICANT drift. If you are unsure, return drifted: false. Do not manufacture work.

If you detect significant drift:
- Produce a revised version that lands on what the opening promised
- Change ONLY the trajectory — where the piece ends up
- NEVER change: voice, tone, paragraph rhythm, sentence length patterns, sentence structure, vocabulary, or any distinctive stylistic patterns
- The revision must be indistinguishable in texture from the original — the same writer, same style, fixing only the direction

The reason field must be ONE short, plain-English sentence. No jargon.

Respond with valid JSON only — no markdown fences, no prose outside the JSON object:
{
  "drifted": boolean,
  "reason": "one short plain-English sentence (only if drifted is true)",
  "revisedBody": "the full revised body text (only if drifted is true)"
}`;

export async function reviewCoherence(
  transcript: string,
  body: string,
  format: "x" | "blog",
): Promise<CoherenceReview> {
  if (!body.trim()) return { drifted: false };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const userMessage = `Original transcript (what was said):\n${transcript}\n\n---\n\nGenerated ${format === "x" ? "X post" : "blog post"} to review:\n${body}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API returned ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text: string = data.content[0].text;

  try {
    const cleaned = text
      .replace(/^```json\n?/m, "")
      .replace(/^```\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.drifted !== "boolean") return { drifted: false };
    if (!parsed.drifted) return { drifted: false };
    return {
      drifted: true,
      revisedBody: typeof parsed.revisedBody === "string" ? parsed.revisedBody : undefined,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  } catch {
    return { drifted: false };
  }
}
