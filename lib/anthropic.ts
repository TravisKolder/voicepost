const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function callClaude(systemPrompt: string, transcript: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AnthropicError("missing_api_key", "ANTHROPIC_API_KEY is not set");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: transcript }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AnthropicError("api_error", `Anthropic API returned ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.content[0].text as string;
}

export class AnthropicError extends Error {
  constructor(
    public readonly code: "missing_api_key" | "api_error",
    message: string,
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}
