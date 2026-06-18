export interface ParsedOutput {
  format?: string;    // X posts: "LONG-FORM SINGLE POST", "SHORT SINGLE POST", "THREAD", "NONE"
  title?: string;     // blog posts
  reasoning?: string;
  body: string;
  sources: string[];
}

export function parseOutput(raw: string): ParsedOutput {
  const lines = raw.split("\n");

  // Collect indices of standalone "---" delimiter lines
  const delimIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") delimIdx.push(i);
  }

  // Without at least two delimiters — likely a "weak transcript" response with
  // only TITLE:/FORMAT: NONE + REASONING: and no post body.
  if (delimIdx.length < 2) {
    const result: ParsedOutput = { body: "", sources: [] };
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("FORMAT:")) result.format = t.slice("FORMAT:".length).trim();
      else if (t.startsWith("TITLE:")) result.title = t.slice("TITLE:".length).trim();
      else if (t.startsWith("REASONING:")) result.reasoning = t.slice("REASONING:".length).trim();
    }
    return result;
  }

  const openIdx = delimIdx[0];
  const closeIdx = delimIdx[delimIdx.length - 1];

  const headerLines = lines.slice(0, openIdx);
  const bodyLines = lines.slice(openIdx + 1, closeIdx);
  const afterLines = lines.slice(closeIdx + 1);

  // Parse FORMAT / TITLE / REASONING from header
  let format: string | undefined;
  let title: string | undefined;
  let reasoning: string | undefined;

  for (const line of headerLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("FORMAT:")) {
      format = trimmed.slice("FORMAT:".length).trim();
    } else if (trimmed.startsWith("TITLE:")) {
      title = trimmed.slice("TITLE:".length).trim();
    } else if (trimmed.startsWith("REASONING:")) {
      reasoning = trimmed.slice("REASONING:".length).trim();
    }
  }

  let body = bodyLines.join("\n").trim();

  // Model sometimes places TITLE:/FORMAT:/REASONING: inside the opening body section
  // (before an inner ---) rather than before the opening delimiter. Recover those.
  if (!title && !format) {
    const innerSplit = body.search(/^---$/m);
    if (innerSplit !== -1) {
      const preamble = body.slice(0, innerSplit);
      const remainder = body.slice(innerSplit + 3).trim();
      for (const line of preamble.split("\n")) {
        const t = line.trim();
        if (t.startsWith("FORMAT:")) format = t.slice("FORMAT:".length).trim();
        else if (t.startsWith("TITLE:")) title = t.slice("TITLE:".length).trim();
        else if (t.startsWith("REASONING:")) reasoning = t.slice("REASONING:".length).trim();
      }
      if (title || format) body = remainder;
    }
  }

  // Parse optional SOURCES TO ADD section after the closing delimiter
  const sources: string[] = [];
  const afterText = afterLines.join("\n");
  const sourcesMarker = afterText.indexOf("SOURCES TO ADD:");
  if (sourcesMarker !== -1) {
    const section = afterText.slice(sourcesMarker + "SOURCES TO ADD:".length);
    for (const line of section.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ")) sources.push(trimmed.slice(2).trim());
    }
  }

  return { format, title, reasoning, body, sources };
}
