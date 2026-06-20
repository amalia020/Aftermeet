/**
 * Fixture-mode toggle and re-exports (Part 4).
 *
 * Ownership rule: "build screens from FrontendMockDataset first." Every page
 * imports its data from here, so flipping USE_MOCK to false (or wiring a live
 * loader) swaps the whole app to API data without touching component contracts.
 *
 * USE_MOCK defaults to true so the app renders end-to-end with zero API keys and
 * no live backend. When it is true, screens render fixture data and badge it as
 * "Demo data"; client components additionally attempt to hydrate from the API and
 * silently keep the fixture if the backend is unreachable.
 */

import {
  frontendMockDataset,
  part1DemoConversation,
  part1DemoHandoff,
  part2DemoEvidenceBundle,
  part3DemoRecommendationPackage,
  demoProcessingEvents,
} from "@/lib/demo/fixtures";
import { part1DemoObjective } from "@/lib/demo/savedExamples";

/**
 * Master fixture toggle. Default true: every screen renders from the saved
 * FrontendMockDataset and works with no backend. Set to false to force a
 * live-only experience (screens then depend on the API routes).
 */
export const USE_MOCK = true as boolean;

export {
  frontendMockDataset,
  part1DemoConversation,
  part1DemoHandoff,
  part2DemoEvidenceBundle,
  part3DemoRecommendationPackage,
  demoProcessingEvents,
  part1DemoObjective,
};

/** The single canonical fixture dataset Part 4 renders by default. */
export const mockDataset = frontendMockDataset;
