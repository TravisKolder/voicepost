import { NextRequest, NextResponse } from "next/server";
import { generateVoiceSpec } from "@/lib/generate-voice-spec";
import { AnthropicError } from "@/lib/anthropic";

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

  const { samples } = body as Record<string, unknown>;

  if (typeof samples !== "string" || samples.trim().length === 0) {
    return NextResponse.json({ error: "samples must be a non-empty string" }, { status: 400 });
  }

  try {
    const voiceSpec = await generateVoiceSpec(samples);
    return NextResponse.json({ voiceSpec });
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
