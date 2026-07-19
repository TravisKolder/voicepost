"use client";

import { useState, useRef } from "react";

const VOICE_SPEC_KEY = "voicepost_voice_spec";

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function VoiceOnboarding({ onSpecCreated }: { onSpecCreated: (spec: string) => void }) {
  const [samples, setSamples] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function appendContent(content: string) {
    setSamples((prev) => (prev.trim() ? prev + "\n\n---\n\n" + content : content));
  }

  function stripRtf(rtf: string): string {
    return rtf
      .replace(/\\par\b ?/gi, "\n\n")
      .replace(/\\line\b ?/gi, "\n")
      .replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\{\\[^{}]*\}/g, "")
      .replace(/\\[a-zA-Z]+\d*[ ]?/g, "")
      .replace(/\\./g, "")
      .replace(/[{}]/g, "")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "txt" || ext === "md") {
      const reader = new FileReader();
      reader.onload = (e) => appendContent(e.target?.result as string);
      reader.readAsText(file);
      return;
    }

    if (ext === "rtf") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = stripRtf(e.target?.result as string);
        if (!text.trim()) { setError(`No text extracted from ${file.name}.`); return; }
        appendContent(text);
      };
      reader.readAsText(file);
      return;
    }

    if (ext === "docx" || ext === "doc") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ arrayBuffer: buffer });
          if (!result.value.trim()) {
            setError(`No text extracted from ${file.name}. If it's an old .doc file, re-save it as .docx in Word first.`);
            return;
          }
          appendContent(result.value);
        } catch {
          setError(`Could not read ${file.name}. If it's an old .doc file, re-save it as .docx in Word first.`);
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    setError(`Unsupported file type: .${ext}. Use .txt, .md, .rtf, .doc, or .docx.`);
  }

  async function handleCreate() {
    if (!samples.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const createVoiceController = new AbortController();
      const createVoiceTimeout = setTimeout(() => createVoiceController.abort(), 120_000);
      const res = await fetch("/api/create-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples }),
        signal: createVoiceController.signal,
      });
      clearTimeout(createVoiceTimeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      const spec: string = data.voiceSpec;
      localStorage.setItem(VOICE_SPEC_KEY, spec);
      onSpecCreated(spec);
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "AbortError"
          ? "Voice creation timed out — please try again"
          : e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">

        <div className="pb-2">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            VoicePost
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Turn voice notes into X posts and blog posts.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Create your voice
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              Paste samples of your own writing — blog posts, essays, threads, anything. Claude will
              analyze them and build a voice spec so generations sound like you, not like AI.
            </p>
          </div>

          <div className="px-5 py-5 space-y-4">
            <textarea
              value={samples}
              onChange={(e) => setSamples(e.target.value)}
              placeholder="Paste your writing here…"
              disabled={loading}
              rows={14}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-950
                px-4 py-3 text-[15px] leading-[1.75]
                text-gray-800 dark:text-gray-200
                placeholder:text-gray-300 dark:placeholder:text-gray-600
                resize-none outline-none
                focus:border-gray-400 dark:focus:border-gray-500
                transition-colors disabled:opacity-50"
            />

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.rtf,.doc,.docx"
                multiple
                className="hidden"
                disabled={loading}
                onChange={(e) => {
                  Array.from(e.target.files ?? []).forEach(handleFile);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
                className="text-sm text-gray-400 dark:text-gray-500
                  hover:text-gray-600 dark:hover:text-gray-300
                  underline underline-offset-2 transition-colors
                  disabled:opacity-50 disabled:no-underline"
              >
                Upload files
              </button>
              <span className="text-xs text-gray-300 dark:text-gray-700">
                .txt · .md · .rtf · .doc · .docx — appends to textarea
              </span>
            </div>
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={handleCreate}
              disabled={!samples.trim() || loading}
              className={[
                "w-full rounded-lg px-4 py-3 text-sm font-medium",
                "flex items-center justify-center gap-2 transition-colors",
                !samples.trim() || loading
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  : "bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 cursor-pointer",
              ].join(" ")}
            >
              {loading && <SpinnerIcon />}
              {loading ? "Analyzing your writing…" : "Create my voice"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30
            border border-red-200 dark:border-red-900
            px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}

        <p className="text-xs text-gray-300 dark:text-gray-700 text-center leading-relaxed">
          Your voice spec is saved locally in your browser. Nothing is stored on a server.
        </p>

      </div>
    </div>
  );
}

export { VOICE_SPEC_KEY };
