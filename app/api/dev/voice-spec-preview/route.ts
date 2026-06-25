import { NextRequest, NextResponse } from "next/server";
import { generateVoiceSpec } from "@/lib/generate-voice-spec";

export async function POST(req: NextRequest) {
  const { samples } = await req.json();
  if (!samples || typeof samples !== "string") {
    return NextResponse.json({ error: "samples (string) is required" }, { status: 400 });
  }
  try {
    const spec = await generateVoiceSpec(samples);
    return NextResponse.json({ spec });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
