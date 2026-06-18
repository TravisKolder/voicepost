const GROK_STT_URL = "https://api.x.ai/v1/stt";

const SUPPORTED_TYPES = new Set([
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  "audio/aac",
  "audio/x-aac",
  "audio/mp4",
  "video/mp4",
  "audio/opus",
]);

const SUPPORTED_EXTENSIONS = new Set([
  ".m4a", ".mp3", ".wav", ".webm", ".ogg", ".flac", ".aac", ".mp4", ".opus",
]);

export function isSupportedAudioFile(file: File): boolean {
  if (SUPPORTED_TYPES.has(file.type)) return true;
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export interface GrokTranscriptResponse {
  text: string;
  language?: string;
  duration?: number;
  words?: Array<{ word: string; start: number; end: number }>;
}

export async function transcribeAudio(file: File): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new GrokError("missing_api_key", "XAI_API_KEY is not set");

  const form = new FormData();
  form.append("file", file);
  form.append("model", "grok-stt");
  form.append("language", "en");
  form.append("response_format", "json");

  const res = await fetch(GROK_STT_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GrokError("api_error", `Grok STT returned ${res.status}: ${body}`);
  }

  const data: GrokTranscriptResponse = await res.json();
  return data.text;
}

export class GrokError extends Error {
  constructor(
    public readonly code: "missing_api_key" | "api_error",
    message: string,
  ) {
    super(message);
    this.name = "GrokError";
  }
}
