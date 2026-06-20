"use client";

/**
 * useProcessStream (Part 4).
 *
 * Consumes the SSE process stream (text/event-stream, one JSON ProcessStageEvent
 * per `data:` line). It exposes the folded pipeline stages and, when the final
 * `handoff_ready` event arrives, the RecommendationPackage carried in its payload.
 *
 * Resilience: if the stream errors, is unreachable, or never produces a handoff,
 * the hook gracefully replays the fixture events and surfaces the fixture
 * recommendation package, flipping `usingFallback` so the UI can badge demo data.
 *
 * It uses fetch + ReadableStream (not EventSource) so it can stream from a GET or
 * a POST and parse partial chunks.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PipelineStageView,
  ProcessStageEvent,
  RecommendationPackage,
  ScreenState,
} from "@/lib/types";
import {
  demoProcessingEvents,
  part3DemoRecommendationPackage,
} from "@/lib/demo/fixtures";
import { buildCascadeStages } from "./viewModels";

export interface UseProcessStreamResult {
  stages: PipelineStageView[];
  events: ProcessStageEvent[];
  recommendation?: RecommendationPackage;
  state: ScreenState;
  usingFallback: boolean;
  /** Start consuming a live SSE stream at `url`. */
  start: (url: string) => void;
  /** Replay the bundled fixture events without any network call. */
  startFixtureReplay: () => void;
  reset: () => void;
}

const FIXTURE_STEP_MS = 420;

function isHandoffReady(event: ProcessStageEvent): boolean {
  return event.stage === "handoff_ready" && event.status === "completed";
}

function extractPackage(event: ProcessStageEvent): RecommendationPackage | undefined {
  if (!isHandoffReady(event)) return undefined;
  const payload = event.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as unknown as RecommendationPackage;
  }
  return undefined;
}

export function useProcessStream(): UseProcessStreamResult {
  const [events, setEvents] = useState<ProcessStageEvent[]>([]);
  const [recommendation, setRecommendation] = useState<RecommendationPackage>();
  const [state, setState] = useState<ScreenState>("idle");
  const [usingFallback, setUsingFallback] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const fixtureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
      if (fixtureTimer.current) clearTimeout(fixtureTimer.current);
    };
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (fixtureTimer.current) clearTimeout(fixtureTimer.current);
    fixtureTimer.current = null;
    setEvents([]);
    setRecommendation(undefined);
    setState("idle");
    setUsingFallback(false);
  }, []);

  const startFixtureReplay = useCallback(() => {
    if (fixtureTimer.current) clearTimeout(fixtureTimer.current);
    setEvents([]);
    setRecommendation(undefined);
    setUsingFallback(true);
    setState("loading");

    let index = 0;
    const tick = () => {
      if (!mounted.current) return;
      const event = demoProcessingEvents[index];
      if (!event) {
        setRecommendation(part3DemoRecommendationPackage);
        setState("ready");
        return;
      }
      setEvents((prev) => [...prev, event]);
      index += 1;
      fixtureTimer.current = setTimeout(tick, FIXTURE_STEP_MS);
    };
    tick();
  }, []);

  const start = useCallback(
    (url: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setEvents([]);
      setRecommendation(undefined);
      setUsingFallback(false);
      setState("loading");

      (async () => {
        try {
          const res = await fetch(url, {
            method: "GET",
            headers: { accept: "text/event-stream" },
            signal: controller.signal,
          });
          if (!res.ok || !res.body) {
            throw new Error(`stream failed (${res.status})`);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let sawHandoff = false;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // SSE frames are separated by a blank line.
            const frames = buffer.split("\n\n");
            buffer = frames.pop() ?? "";
            for (const frame of frames) {
              const dataLine = frame
                .split("\n")
                .find((line) => line.startsWith("data:"));
              if (!dataLine) continue;
              const json = dataLine.slice("data:".length).trim();
              if (!json) continue;
              let event: ProcessStageEvent;
              try {
                event = JSON.parse(json) as ProcessStageEvent;
              } catch {
                continue;
              }
              if (!mounted.current) return;
              setEvents((prev) => [...prev, event]);
              const pkg = extractPackage(event);
              if (pkg) {
                sawHandoff = true;
                setRecommendation(pkg);
                setState("ready");
              }
              if (event.stage === "failed") {
                throw new Error(event.message ?? "pipeline failed");
              }
            }
          }

          if (!sawHandoff && mounted.current) {
            // Stream ended without a recommendation — fall back gracefully.
            setRecommendation(part3DemoRecommendationPackage);
            setUsingFallback(true);
            setState("ready");
          }
        } catch {
          if (controller.signal.aborted || !mounted.current) return;
          // Any failure: replay fixtures so the demo path always completes.
          startFixtureReplay();
        }
      })();
    },
    [startFixtureReplay],
  );

  const stages = buildCascadeStages(events);

  return {
    stages,
    events,
    recommendation,
    state,
    usingFallback,
    start,
    startFixtureReplay,
    reset,
  };
}
