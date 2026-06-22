"use client";

// Loaded with { ssr: false } via next/dynamic, so all browser API checks here are safe.

type RecordState = "idle" | "requesting" | "recording" | "recorded";

export interface RecordingSectionProps {
  recState: RecordState;
  recSeconds: number;
  recAudioUrl: string | null;
  busy: boolean;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onDiscard: (clearFile?: boolean) => void;
}

function formatRecTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-5 h-5"} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M19 10a7 7 0 0 1-14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
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

export default function RecordingSection({
  recState,
  recSeconds,
  recAudioUrl,
  busy,
  onStartRecording,
  onStopRecording,
  onDiscard,
}: RecordingSectionProps) {
  if (typeof MediaRecorder === "undefined" || !navigator?.mediaDevices) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-3 select-none">
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
        <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">

        {recState === "idle" && (
          <button
            disabled={busy}
            onClick={onStartRecording}
            className="w-full flex items-center justify-center gap-3 py-6 px-4
              text-gray-600 dark:text-gray-400
              hover:bg-gray-50 dark:hover:bg-gray-800/50
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors active:bg-gray-100 dark:active:bg-gray-800"
          >
            <MicIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium">Record audio</span>
          </button>
        )}

        {recState === "requesting" && (
          <div className="flex items-center justify-center gap-3 py-6 px-4
            text-gray-500 dark:text-gray-400 text-sm">
            <SpinnerIcon />
            <span>Requesting microphone…</span>
          </div>
        )}

        {recState === "recording" && (
          <div className="flex items-center justify-between px-5 py-4 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Recording
              </span>
              <span className="text-sm font-mono tabular-nums text-gray-500 dark:text-gray-400">
                {formatRecTime(recSeconds)}
              </span>
            </div>
            <button
              onClick={onStopRecording}
              className="flex items-center gap-2 shrink-0 text-sm font-medium
                px-4 py-2.5 rounded-lg
                bg-gray-900 text-white dark:bg-white dark:text-gray-900
                hover:bg-gray-700 dark:hover:bg-gray-200
                active:bg-gray-800 dark:active:bg-gray-300
                transition-colors"
            >
              <StopIcon />
              Stop
            </button>
          </div>
        )}

        {recState === "recorded" && recAudioUrl && (
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-green-500 dark:text-green-400 text-base leading-none">●</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Recording ready
                </span>
                <span className="text-sm tabular-nums text-gray-400 dark:text-gray-500">
                  {formatRecTime(recSeconds)}
                </span>
              </div>
              <button
                onClick={() => onDiscard(true)}
                disabled={busy}
                className="text-xs shrink-0 text-gray-400 dark:text-gray-500
                  hover:text-gray-700 dark:hover:text-gray-300
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                Re-record
              </button>
            </div>
            <audio
              src={recAudioUrl}
              controls
              className="w-full h-10"
              style={{ colorScheme: "light dark" }}
            />
          </div>
        )}

      </div>
    </>
  );
}
