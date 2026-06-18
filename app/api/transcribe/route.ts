import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio, isSupportedAudioFile, GrokError } from "@/lib/grok";

const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Request must be multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file — include a 'file' field" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File too large — maximum size is 500 MB" }, { status: 413 });
  }

  if (!isSupportedAudioFile(file)) {
    return NextResponse.json(
      { error: "Unsupported file format — accepted: .m4a .mp3 .wav .webm .ogg .flac .aac .mp4 .opus" },
      { status: 415 },
    );
  }

  try {
    const transcript = await transcribeAudio(file);
    return NextResponse.json({ transcript });
  } catch (err) {
    if (err instanceof GrokError) {
      if (err.code === "missing_api_key") {
        return NextResponse.json({ error: "Server misconfiguration: XAI_API_KEY is not set" }, { status: 500 });
      }
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
