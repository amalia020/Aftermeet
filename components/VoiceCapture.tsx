"use client";

/**
 * VoiceCapture (Part 4) — affordance for voice capture. The MVP primary path is
 * text; this records (or simulates) a voice note and hands the transcript text
 * up to the parent, which submits it through the text capture path. It never
 * blocks the text fallback.
 */

import { useEffect, useRef, useState } from "react";

export interface VoiceCaptureProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceCapture({ onTranscript, disabled }: VoiceCaptureProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = () => {
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stop = () => {
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    // In a live build this would post audio to /api/capture/voice and await the
    // transcript. For the demo, surface a clear note in the text field so the
    // user can review and edit before processing.
    onTranscript(
      "Voice note captured. Transcription runs on submit — review and edit the text before processing.",
    );
  };

  return (
    <div className="rounded-lg border border-ink-line bg-ink-soft/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-cloud">Voice note</p>
          <p className="text-xs text-cloud-faint">
            Speak the conversation. We transcribe it for you to review.
          </p>
        </div>
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={disabled}
          aria-pressed={recording}
          className={[
            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-signal-calm disabled:opacity-50",
            recording
              ? "bg-signal-stop/20 text-signal-stop"
              : "bg-ink-soft text-cloud hover:bg-ink-line",
          ].join(" ")}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${recording ? "animate-pulse bg-signal-stop" : "bg-cloud-dim"}`}
            aria-hidden
          />
          {recording ? `Stop · ${elapsed}s` : "Record"}
        </button>
      </div>
    </div>
  );
}
