"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ParsedOutput } from "@/lib/parse-output";

const RecordingSection = dynamic(
  () => import("../components/RecordingSection"),
  { ssr: false },
);

type Mode = "voice-first" | "balanced" | "reach-first";
type LoadingState = "idle" | "transcribing" | "generating";
type RecordState = "idle" | "requesting" | "recording" | "recorded";

interface CoherenceReview {
  drifted: boolean;
  revisedBody?: string;
  reason?: string;
}

interface GenerateResult {
  transcript: string;
  xPost: ParsedOutput & { review: CoherenceReview };
  blogPost: ParsedOutput & { review: CoherenceReview };
}

const MODES: { value: Mode; label: string; sub: string }[] = [
  { value: "voice-first", label: "Voice-first", sub: "Raw and direct" },
  { value: "balanced",    label: "Balanced",    sub: "Polished but you" },
  { value: "reach-first", label: "Reach-first", sub: "Optimized" },
];

function isNone(v?: string) {
  return !v || v.toUpperCase() === "NONE";
}

function formatBadge(format?: string) {
  if (!format || isNone(format)) return undefined;
  const map: Record<string, string> = {
    "LONG-FORM SINGLE POST": "Long-form",
    "SHORT SINGLE POST": "Short",
    "THREAD": "Thread",
  };
  return map[format.toUpperCase()] ?? format;
}

function getBestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

// ── Icons ──────────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function AudioIcon() {
  return (
    <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silent fail
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md
        text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
        hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

// ── Inline markdown renderer (for blog read view) ──────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const re = /(\*\*(?:[^*]|\*(?!\*))+\*\*|\*(?:[^*])+\*)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const m = match[0];
    if (m.startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold text-gray-900 dark:text-gray-100">{m.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++}>{m.slice(1, -1)}</em>);
    }
    last = match.index + m.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function BodyText({ text }: { text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed === "---") {
          return <hr key={i} className="border-gray-200 dark:border-gray-700" />;
        }
        const lines = trimmed.split("\n");
        return (
          <p key={i} className="leading-[1.75] text-[15px] text-gray-800 dark:text-gray-200">
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

// ── Auto-resize textarea ───────────────────────────────────────────────────

const TEXTAREA_CLASS =
  "w-full resize-none bg-transparent outline-none text-[15px] leading-[1.75] text-gray-800 dark:text-gray-200";

function AutoTextarea({
  value,
  onChange,
  onBlur,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}) {
  function resize(ta: HTMLTextAreaElement) {
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) resize(ref.current);
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
        if (el) resize(el);
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      rows={1}
      spellCheck
      autoFocus={autoFocus}
      className={TEXTAREA_CLASS}
    />
  );
}

// ── Blog body — rendered view with click-to-edit ───────────────────────────

function BlogBodyEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <AutoTextarea
        value={value}
        onChange={onChange}
        onBlur={() => setEditing(false)}
        autoFocus
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-text group"
      title="Click to edit"
    >
      <BodyText text={value} />
      <p className="mt-3 text-xs text-gray-300 dark:text-gray-700
        group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors
        flex items-center gap-1">
        <PencilIcon /> Click to edit
      </p>
    </div>
  );
}

// ── X post character count ─────────────────────────────────────────────────

function XCharCount({ body, format }: { body: string; format?: string }) {
  const fmt = format?.toUpperCase() ?? "";

  if (fmt === "THREAD") {
    const posts = body
      .split(/\n+---\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        {posts.map((post, i) => {
          const n = post.length;
          const over = n > 280;
          return (
            <span key={i}
              className={`text-xs ${over ? "text-red-500 dark:text-red-400 font-medium" : "text-gray-400 dark:text-gray-500"}`}>
              Post {i + 1}: {n} / 280
            </span>
          );
        })}
      </div>
    );
  }

  const n = body.length;

  if (fmt === "LONG-FORM SINGLE POST") {
    return (
      <p className="text-xs mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500">
        {n.toLocaleString()} characters · long-form
      </p>
    );
  }

  // SHORT SINGLE POST (or unrecognised format)
  const over = n > 280;
  return (
    <p className={`text-xs mt-3 pt-3 border-t border-gray-100 dark:border-gray-800
      ${over ? "text-red-500 dark:text-red-400 font-medium" : "text-gray-400 dark:text-gray-500"}`}>
      {n} / 280
    </p>
  );
}

// ── Post card ──────────────────────────────────────────────────────────────

function PostCard({
  label,
  post,
  bodyValue,
  onBodyChange,
  isEdited,
  copyText,
  isXPost,
  review,
  driftPicked,
  onPickVersion,
}: {
  label: string;
  post: ParsedOutput;
  bodyValue: string;
  onBodyChange: (v: string) => void;
  isEdited: boolean;
  copyText: string;
  isXPost?: boolean;
  review?: CoherenceReview;
  driftPicked: boolean;
  onPickVersion: (body: string) => void;
}) {
  const weak = isNone(post.format) && isNone(post.title);
  const badge = formatBadge(post.format);
  const showDrift = !!(review?.drifted && review.revisedBody && !driftPicked);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3
        bg-gray-50 dark:bg-gray-900/80
        border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500">
            {label}
          </span>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full
              bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {badge}
            </span>
          )}
          {isEdited && (
            <span className="text-xs px-2 py-0.5 rounded-full
              bg-blue-50 dark:bg-blue-950/40
              border border-blue-100 dark:border-blue-900
              text-blue-500 dark:text-blue-400">
              edited
            </span>
          )}
        </div>
        {!weak && !showDrift && <CopyButton text={copyText} />}
      </div>

      {/* Card body */}
      <div className="px-5 py-5">
        {post.title && !isNone(post.title) && (
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3 leading-snug">
            {post.title}
          </h2>
        )}

        {!weak && post.reasoning && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic mb-4 leading-relaxed">
            {post.reasoning}
          </p>
        )}

        {weak ? (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40
            border border-amber-200 dark:border-amber-900
            px-4 py-3 text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            <span className="font-medium">Transcript too weak —</span>{" "}
            {post.reasoning ?? "record more before trying this one."}
          </div>
        ) : showDrift ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40
              border border-amber-200 dark:border-amber-900
              px-3 py-2 text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
              <span className="font-medium">Drift detected:</span>{" "}
              {review!.reason ?? "The opening and ending land on different points."}
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2
                bg-gray-50 dark:bg-gray-800/60
                border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-semibold uppercase tracking-widest
                  text-gray-400 dark:text-gray-500">
                  Original
                </span>
                <button
                  onClick={() => onPickVersion(bodyValue)}
                  className="text-xs px-2.5 py-1 rounded-md font-medium
                    bg-gray-900 text-white dark:bg-white dark:text-gray-900
                    hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
                  Use this
                </button>
              </div>
              <div className="px-3 py-3">
                <BodyText text={bodyValue} />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2
                bg-gray-50 dark:bg-gray-800/60
                border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs font-semibold uppercase tracking-widest
                  text-gray-400 dark:text-gray-500">
                  Tightened
                </span>
                <button
                  onClick={() => onPickVersion(review!.revisedBody!)}
                  className="text-xs px-2.5 py-1 rounded-md font-medium
                    bg-gray-900 text-white dark:bg-white dark:text-gray-900
                    hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors">
                  Use this
                </button>
              </div>
              <div className="px-3 py-3">
                <BodyText text={review!.revisedBody!} />
              </div>
            </div>
          </div>
        ) : isXPost ? (
          <>
            <AutoTextarea value={bodyValue} onChange={onBodyChange} />
            <XCharCount body={bodyValue} format={post.format} />
          </>
        ) : (
          <BlogBodyEditor value={bodyValue} onChange={onBodyChange} />
        )}

        {post.sources.length > 0 && (
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs uppercase tracking-widest font-semibold
              text-gray-400 dark:text-gray-500 mb-2">
              Sources to add
            </p>
            <ul className="space-y-1.5">
              {post.sources.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="text-gray-300 dark:text-gray-600 shrink-0 mt-px">–</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<Mode>("balanced");
  const [loading, setLoading] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  // Live-editable body text for each output
  const [xPostBody, setXPostBody] = useState("");
  const [blogBody, setBlogBody] = useState("");
  // Baseline for edit detection — updated when a drift version is picked
  const [xStartBody, setXStartBody] = useState("");
  const [blogStartBody, setBlogStartBody] = useState("");
  // Whether the drift UI has been resolved for each post
  const [xDriftPicked, setXDriftPicked] = useState(false);
  const [blogDriftPicked, setBlogDriftPicked] = useState(false);

  // Recording state machine
  const [recState, setRecState] = useState<RecordState>("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const [recAudioUrl, setRecAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recAudioUrlRef = useRef<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      recStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (recAudioUrlRef.current) URL.revokeObjectURL(recAudioUrlRef.current);
    };
  }, []);

  function setRecAudioUrlSafe(url: string | null) {
    if (recAudioUrlRef.current) URL.revokeObjectURL(recAudioUrlRef.current);
    recAudioUrlRef.current = url;
    setRecAudioUrl(url);
  }

  function resetForNewInput() {
    setError(null);
    setResult(null);
    setXPostBody("");
    setBlogBody("");
    setXStartBody("");
    setBlogStartBody("");
    setXDriftPicked(false);
    setBlogDriftPicked(false);
  }

  // clearFile = true when user explicitly discards (Re-record); false when caller sets a new file
  function discardRecording(clearFile = true) {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      recChunksRef.current = []; // Prevent onstop from processing the partial data
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    recStreamRef.current = null;
    mediaRecorderRef.current = null;
    recChunksRef.current = [];
    setRecState("idle");
    setRecSeconds(0);
    setRecAudioUrlSafe(null);
    if (clearFile) {
      setFile(null);
      resetForNewInput();
    }
  }

  function handleFileSelect(f: File) {
    discardRecording(false); // clean up any recording without clearing file state
    setFile(f);
    resetForNewInput();
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function startRecording() {
    if (recState !== "idle") return;
    setRecState("requesting");
    setError(null);
    // Clear any uploaded file — we're switching to recording mode
    setFile(null);
    resetForNewInput();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setRecState("idle");
      if (e instanceof DOMException) {
        if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
          setError("Microphone permission denied — allow access in your browser settings and try again.");
        } else if (e.name === "NotFoundError") {
          setError("No microphone found on this device.");
        } else {
          setError(`Microphone error: ${e.message}`);
        }
      } else {
        setError("Could not access the microphone.");
      }
      return;
    }

    recStreamRef.current = stream;
    const mimeType = getBestMimeType();

    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      mr = new MediaRecorder(stream);
    }
    mediaRecorderRef.current = mr;
    recChunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) recChunksRef.current.push(e.data);
    };

    mr.onerror = () => {
      discardRecording(true);
      setError("Recording stopped unexpectedly. Please try again.");
    };

    mr.onstop = () => {
      const chunks = recChunksRef.current;
      if (chunks.length === 0) return; // recording was discarded

      const actualType = chunks[0]?.type || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type: actualType });
      const ext = actualType.includes("mp4") ? "mp4"
        : actualType.includes("ogg") ? "ogg"
        : "webm";
      const recordedFile = new File([blob], `recording.${ext}`, { type: actualType });

      setRecAudioUrlSafe(URL.createObjectURL(blob));
      setRecState("recorded");
      setFile(recordedFile);
      // result state was already reset at startRecording; keep it clear
      stream.getTracks().forEach((t) => t.stop());
      recStreamRef.current = null;
    };

    mr.start(1000); // 1-second timeslices — safer on mobile Safari
    setRecState("recording");
    setRecSeconds(0);
    recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
  }

  async function handleGenerate() {
    if (!file) return;

    if (hasUnsavedEdits) {
      const ok = window.confirm(
        "You have unsaved edits that will be replaced. Regenerate anyway?"
      );
      if (!ok) return;
    }

    setError(null);
    setResult(null);
    setXPostBody("");
    setBlogBody("");
    setXStartBody("");
    setBlogStartBody("");

    setLoading("transcribing");
    let transcript: string;
    try {
      const form = new FormData();
      form.append("file", file);
      const transcribeController = new AbortController();
      const transcribeTimeout = setTimeout(() => transcribeController.abort(), 90_000);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
        signal: transcribeController.signal,
      });
      clearTimeout(transcribeTimeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Transcription failed (${res.status})`);
      transcript = data.transcript;
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "AbortError"
          ? "Transcription timed out — please try again"
          : e instanceof Error ? e.message : "Transcription failed";
      setError(msg);
      setLoading("idle");
      return;
    }

    setLoading("generating");
    try {
      const generateController = new AbortController();
      const generateTimeout = setTimeout(() => generateController.abort(), 60_000);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, mode }),
        signal: generateController.signal,
      });
      clearTimeout(generateTimeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Generation failed (${res.status})`);
      const newResult: GenerateResult = {
        transcript,
        xPost: data.xPost,
        blogPost: data.blogPost,
      };
      console.log("[voicepost] blogPost:", {
        title: newResult.blogPost.title,
        format: newResult.blogPost.format,
        bodyLength: newResult.blogPost.body.length,
        bodyPreview: newResult.blogPost.body.slice(0, 120),
      });
      setResult(newResult);
      setXPostBody(newResult.xPost.body);
      setBlogBody(newResult.blogPost.body);
      setXStartBody(newResult.xPost.body);
      setBlogStartBody(newResult.blogPost.body);
      setXDriftPicked(false);
      setBlogDriftPicked(false);
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "AbortError"
          ? "Generation timed out — please try again"
          : e instanceof Error ? e.message : "Generation failed";
      setError(msg);
    } finally {
      setLoading("idle");
    }
  }

  const busy = loading !== "idle";
  const xIsEdited    = xPostBody !== xStartBody;
  const blogIsEdited = blogBody !== blogStartBody;
  const hasUnsavedEdits = xIsEdited || blogIsEdited;

  const xCopyText = xPostBody;
  const blogCopyText =
    result?.blogPost.title && !isNone(result.blogPost.title)
      ? `${result.blogPost.title}\n\n${blogBody}`
      : blogBody;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-5">

        {/* Header */}
        <div className="pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            VoicePost
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Turn voice notes into X posts and blog posts.
          </p>
        </div>

        {/* Upload zone */}
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => { e.preventDefault(); if (!busy && recState === "idle") setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !busy && recState !== "recording" && fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" && !busy && recState !== "recording") fileInputRef.current?.click(); }}
          className={[
            "rounded-xl border-2 border-dashed transition-colors select-none",
            busy || recState === "recording" ? "opacity-60 pointer-events-none" : "cursor-pointer",
            dragging
              ? "border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-900"
              : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50/60 dark:hover:bg-gray-900/40",
          ].join(" ")}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".m4a,.mp3,.wav,.webm,.ogg,.flac,.aac,.mp4,.opus"
            className="hidden"
            disabled={busy || recState === "recording"}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />
          <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
            {file && recState !== "recording" && recState !== "recorded" ? (
              <>
                <AudioIcon />
                <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{file.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Click to change file</p>
              </>
            ) : (
              <>
                <UploadIcon />
                <div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    {dragging ? "Drop to upload" : "Drop your audio here"}
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">or click to browse</p>
                </div>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                  .m4a .mp3 .wav .webm .ogg .flac .aac
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Recording section ────────────────────────────────────────── */}
        <RecordingSection
          recState={recState}
          recSeconds={recSeconds}
          recAudioUrl={recAudioUrl}
          busy={busy}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onDiscard={discardRecording}
        />

        {/* Mode selector */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Mode</p>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                disabled={busy}
                onClick={() => setMode(m.value)}
                className={[
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  busy ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                  mode === m.value
                    ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900",
                ].join(" ")}
              >
                <div className="text-sm font-medium">{m.label}</div>
                <div
                  className="text-xs mt-0.5 text-gray-400 dark:text-gray-500"
                  style={mode === m.value ? { color: "rgb(156 163 175)" } : undefined}
                >
                  {m.sub}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!file || busy || recState === "recording"}
          className={[
            "w-full rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
            !file || recState === "recording"
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              : busy
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 opacity-70 cursor-not-allowed"
              : "bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 cursor-pointer",
          ].join(" ")}
        >
          {busy && <SpinnerIcon />}
          {loading === "transcribing"
            ? "Transcribing audio…"
            : loading === "generating"
            ? "Generating posts…"
            : "Generate"}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30
            border border-red-200 dark:border-red-900
            px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-5 pt-2">

            {/* Transcript */}
            <details className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-3 cursor-pointer
                bg-gray-50 dark:bg-gray-900
                hover:bg-gray-100 dark:hover:bg-gray-800/60
                transition-colors select-none
                text-sm font-medium text-gray-500 dark:text-gray-400
                hover:text-gray-700 dark:hover:text-gray-200">
                <span>Transcript</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {result.transcript.split(/\s+/).filter(Boolean).length} words
                </span>
              </summary>
              <div className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400
                leading-relaxed whitespace-pre-wrap
                border-t border-gray-100 dark:border-gray-800
                bg-white dark:bg-gray-950">
                {result.transcript}
              </div>
            </details>

            {/* X Post */}
            <PostCard
              label="X Post"
              post={result.xPost}
              bodyValue={xPostBody}
              onBodyChange={setXPostBody}
              isEdited={xIsEdited}
              copyText={xCopyText}
              isXPost
              review={result.xPost.review}
              driftPicked={xDriftPicked}
              onPickVersion={(body) => {
                setXPostBody(body);
                setXStartBody(body);
                setXDriftPicked(true);
              }}
            />

            {/* Blog Post */}
            <PostCard
              label="Blog Post"
              post={result.blogPost}
              bodyValue={blogBody}
              onBodyChange={setBlogBody}
              isEdited={blogIsEdited}
              copyText={blogCopyText}
              review={result.blogPost.review}
              driftPicked={blogDriftPicked}
              onPickVersion={(body) => {
                setBlogBody(body);
                setBlogStartBody(body);
                setBlogDriftPicked(true);
              }}
            />

          </div>
        )}

      </div>
    </div>
  );
}
