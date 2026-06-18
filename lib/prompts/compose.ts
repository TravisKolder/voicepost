// ============================================================================
// compose.ts
// Single source of truth for assembling a full prompt from the pieces.
// composePrompt("x", "balanced") returns the complete system prompt string.
// ============================================================================

import { VOICE_SPEC } from "./voice-spec";
import { X_FORMAT } from "./x-format";
import { BLOG_FORMAT } from "./blog-format";
import { VOICE_FIRST, BALANCED, REACH_FIRST } from "./modes";

export type Format = "x" | "blog";
export type Mode = "voice-first" | "balanced" | "reach-first";

const FORMAT_MAP: Record<Format, string> = {
  x: X_FORMAT,
  blog: BLOG_FORMAT,
};

const MODE_MAP: Record<Mode, string> = {
  "voice-first": VOICE_FIRST,
  balanced: BALANCED,
  "reach-first": REACH_FIRST,
};

/**
 * Assemble the full system prompt.
 * Order: voice spec (the foundation) -> format rules -> mode layer.
 */
export function composePrompt(format: Format, mode: Mode): string {
  const parts = [VOICE_SPEC, FORMAT_MAP[format], MODE_MAP[mode]];
  // Filter out the empty voice-first layer so we don't add stray whitespace.
  return parts.filter((p) => p.trim().length > 0).join("\n\n");
}
