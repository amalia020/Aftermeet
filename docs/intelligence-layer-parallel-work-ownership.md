# AfterMeet Intelligence Layer - Parallel Work Ownership

## Purpose

This file defines the first-step ownership map for building the intelligence layer and frontend visualization workstreams in parallel with minimal merge conflicts.

The rule of thumb:

```text
Teams share contracts, not implementation files.
```

Each person should implement behind the shared contracts in `lib/types` and avoid editing another workstream's owned files unless the contract itself must change.

## Shared Contracts

All workstreams import from:

```text
lib/types/index.ts
```

The most important boundary contracts are:

| Contract | Produced By | Consumed By | File |
| --- | --- | --- | --- |
| `ExtractionHandoff` | Part 1 | Part 2 | `lib/types/handoffs.ts` |
| `EvidenceBundle` | Part 2 | Part 3 | `lib/types/handoffs.ts` |
| `RecommendationPackage` | Part 3 | Part 4 / orchestration | `lib/types/handoffs.ts` |
| Frontend view models | Part 4 | Part 4 components | `lib/types/ui.ts` |
| `FrontendMockDataset` | Part 4 | Part 4 fixture mode | `lib/types/ui.ts` |
| API request/response shapes | Route owner | UI and services | `lib/types/api.ts` |
| Core enums and IDs | Shared | All parts | `lib/types/common.ts` |

### Contract Change Rules

- Additive optional fields are allowed when needed.
- Renaming or deleting fields requires all affected workstream owners to agree.
- A producer must keep returning every required field in its handoff.
- A consumer must tolerate optional fields being absent.
- Do not duplicate these shared types inside workstream implementation files.

## Path Ownership

### Shared Foundation

| Path | Owner | Rule |
| --- | --- | --- |
| `lib/types/*` | Shared | Changes should be reviewed as contract changes. |
| `lib/db/*` | Foundation / whoever starts persistence | Keep repositories split by table ownership below. |
| `lib/demo/*` | Shared | Fixture names must include the workstream prefix: `part1`, `part2`, `part3`, or `part4`. |
| `app/api/intelligence/process/route.ts` | Part 1 integration owner | Part 2 and Part 3 expose services called by this route; they should not edit the route shell directly. |

### Part 1 - Capture and Extraction

Owned paths:

```text
app/api/objectives/*
app/api/capture/*
app/api/intelligence/process/route.ts
lib/intelligence/extraction.ts
lib/providers/whisper.ts
```

Shared-with-care paths:

```text
lib/providers/gemini.ts
```

Part 1 may create the low-level Gemini JSON provider wrapper. Part 3 should put draft-specific prompt logic in `lib/intelligence/draftGeneration.ts`, not by changing extraction behavior in the provider wrapper.

Tables owned:

```text
users
user_objectives
contacts
conversations
conversation_atoms
```

Primary output:

```ts
ExtractionHandoff
```

### Part 2 - Enrichment and Evidence

Owned paths:

```text
app/api/enrich/cala/route.ts
app/api/enrich/web/route.ts
lib/intelligence/enrichment.ts
lib/intelligence/sourceConfidence.ts
lib/intelligence/entityResolution.ts
lib/intelligence/factConfidence.ts
lib/providers/cala.ts
lib/providers/gemini.ts
```

Tables owned:

```text
public_entity_context
source_records
evidence_facts
```

Primary input:

```ts
ExtractionHandoff
```

Primary output:

```ts
EvidenceBundle
```

### Part 3 - Decision and Action Engine

Owned paths:

```text
app/api/intelligence/recommend/route.ts
app/api/draft/generate/route.ts
app/api/outcomes/route.ts
lib/intelligence/userObjective.ts
lib/intelligence/clustering.ts
lib/intelligence/opportunityRouting.ts
lib/intelligence/scoring.ts
lib/intelligence/warmthDecay.ts
lib/intelligence/recipientBurden.ts
lib/intelligence/actionPolicy.ts
lib/intelligence/draftPolicy.ts
lib/intelligence/draftGeneration.ts
lib/intelligence/decisionTrace.ts
lib/intelligence/groupRecommendation.ts
lib/intelligence/feedbackLearning.ts
```

Tables owned:

```text
opportunity_routes
action_recommendations
drafts
outcomes
```

Primary input:

```ts
EvidenceBundle
```

Primary output:

```ts
RecommendationPackage
```

### Part 4 - Frontend Experience and Visualization

Owned paths:

```text
app/page.tsx
app/capture/*
app/contacts/*
app/board/*
app/terminal/*
app/traction/*
components/*
lib/frontend/*
```

Shared-with-care paths:

```text
lib/types/ui.ts
lib/demo/*
```

Part 4 owns all user-visible routes and components. It consumes typed API responses, `ProcessStageEvent`, `ExtractionHandoff`, `EvidenceBundle`, `RecommendationPackage`, and frontend view models. It should not import from `lib/intelligence/*`, `lib/providers/*`, or `lib/db/*`.

Tables owned:

```text
none
```

Primary inputs:

```ts
ProcessStageEvent
ExtractionHandoff
EvidenceBundle
RecommendationPackage
FrontendMockDataset
```

Primary output:

```ts
Rendered app experience
```

## Integration Rules

1. Build and test service functions first, then wire routes.
2. Part 1 owns the process route shell and streams stage events.
3. Part 2 exposes `enrichEvidence(input: ExtractionHandoff): Promise<EvidenceBundle>`.
4. Part 3 exposes `recommendNextAction(...): Promise<RecommendationPackage>`.
5. Part 4 builds screens from `FrontendMockDataset` first, then swaps to API data.
6. The process route calls Part 2 and Part 3 services only after their contract tests pass.
7. If live providers fail, each workstream returns its own typed fallback state.
8. No workstream should import from another workstream's implementation file; import from `lib/types` or call the public service function.
9. Frontend components should consume view models and API responses only.

## Migration Ownership

To avoid migration conflicts:

- Use one migration file per workstream if migrations exist.
- Prefix migration names with the workstream number.
- Do not edit another workstream's migration after it lands.

Suggested names:

```text
001_part1_capture_extraction.sql
002_part2_enrichment_evidence.sql
003_part3_decision_action.sql
```

## Conflict Hotspots

| Hotspot | Avoidance Rule |
| --- | --- |
| `lib/types/*` | Keep changes additive unless everyone agrees. |
| `app/api/intelligence/process/route.ts` | Part 1 owns shell; other parts expose callable services. |
| `components/*` | Part 4 owns visual components; backend workstreams provide data only. |
| `app/*` pages | Part 4 owns pages; backend workstreams own `app/api/*` routes. |
| `lib/providers/gemini.ts` | Provider wrapper only; prompts live in workstream files. |
| Database migrations | Split by workstream and table ownership. |
| Demo fixtures | Prefix fixture exports by workstream. |
| Shared UI shell/navigation | Part 4 owns layout before feature pages branch off. |

## First Parallel Milestone

Each person can start immediately with:

| Person | Build First | Done When |
| --- | --- | --- |
| Part 1 owner | `extractConversationAtoms` and text capture shell | Returns valid `ExtractionHandoff` fixture and live path shape. |
| Part 2 owner | `enrichEvidence` with fixture Cala/web responses | Returns valid `EvidenceBundle` from a fixture `ExtractionHandoff`. |
| Part 3 owner | deterministic scoring and action policy | Returns valid `RecommendationPackage` from a fixture `EvidenceBundle`. |
| Part 4 owner | fixture-backed screens and processing cascade | Renders `FrontendMockDataset` without backend implementation imports. |

This lets everyone work at the same time while the integration route is still being wired.
