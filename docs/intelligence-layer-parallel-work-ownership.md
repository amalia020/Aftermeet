# AfterMeet Intelligence Layer - Parallel Work Ownership

## Purpose

This file defines the first-step ownership map for building the three intelligence-layer workstreams in parallel with minimal merge conflicts.

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
| `RecommendationPackage` | Part 3 | Product UI / orchestration | `lib/types/handoffs.ts` |
| API request/response shapes | Route owner | UI and services | `lib/types/api.ts` |
| Core enums and IDs | Shared | All parts | `lib/types/common.ts` |

### Contract Change Rules

- Additive optional fields are allowed when needed.
- Renaming or deleting fields requires all three workstream owners to agree.
- A producer must keep returning every required field in its handoff.
- A consumer must tolerate optional fields being absent.
- Do not duplicate these shared types inside workstream implementation files.

## Path Ownership

### Shared Foundation

| Path | Owner | Rule |
| --- | --- | --- |
| `lib/types/*` | Shared | Changes should be reviewed as contract changes. |
| `lib/db/*` | Foundation / whoever starts persistence | Keep repositories split by table ownership below. |
| `lib/demo/*` | Shared | Fixture names must include the workstream prefix: `part1`, `part2`, `part3`. |
| `app/api/intelligence/process/route.ts` | Part 1 integration owner | Part 2 and Part 3 expose services called by this route; they should not edit the route shell directly. |

### Part 1 - Capture and Extraction

Owned paths:

```text
app/capture/*
app/api/capture/*
app/api/intelligence/process/route.ts
components/MissionSetup.tsx
components/CaptureCard.tsx
components/VoiceCapture.tsx
components/CardScan.tsx
lib/intelligence/extraction.ts
lib/providers/whisper.ts
```

Shared-with-care paths:

```text
lib/providers/claude.ts
```

Part 1 may create the low-level Claude JSON provider wrapper. Part 3 should put draft-specific prompt logic in `lib/intelligence/draftGeneration.ts`, not by changing extraction behavior in the provider wrapper.

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
components/SourceRegister.tsx
components/ConfidenceBreakdown.tsx
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

### Part 3 - Decision, Action, and Experience

Owned paths:

```text
app/api/intelligence/recommend/route.ts
app/api/draft/generate/route.ts
app/api/outcomes/route.ts
app/board/*
app/terminal/*
app/contacts/*
components/DecisionTrace.tsx
components/FiveForksView.tsx
components/FollowUpBoard.tsx
components/OpportunityMatrix.tsx
components/RecommendedGroupCard.tsx
components/ActionQueue.tsx
components/DraftPreview.tsx
components/TractionView.tsx
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

## Integration Rules

1. Build and test service functions first, then wire routes.
2. Part 1 owns the process route shell and streams stage events.
3. Part 2 exposes `enrichEvidence(input: ExtractionHandoff): Promise<EvidenceBundle>`.
4. Part 3 exposes `recommendNextAction(...): Promise<RecommendationPackage>`.
5. The process route calls Part 2 and Part 3 services only after their contract tests pass.
6. If live providers fail, each workstream returns its own typed fallback state.
7. No workstream should import from another workstream's implementation file; import from `lib/types` or call the public service function.

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
| `lib/providers/claude.ts` | Provider wrapper only; prompts live in workstream files. |
| Database migrations | Split by workstream and table ownership. |
| Demo fixtures | Prefix fixture exports by workstream. |
| Shared UI shell/navigation | One foundation owner should create layout before feature pages branch off. |

## First Parallel Milestone

Each person can start immediately with:

| Person | Build First | Done When |
| --- | --- | --- |
| Part 1 owner | `extractConversationAtoms` and text capture shell | Returns valid `ExtractionHandoff` fixture and live path shape. |
| Part 2 owner | `enrichEvidence` with fixture Cala/web responses | Returns valid `EvidenceBundle` from a fixture `ExtractionHandoff`. |
| Part 3 owner | deterministic scoring and action policy | Returns valid `RecommendationPackage` from a fixture `EvidenceBundle`. |

This lets everyone work at the same time while the integration route is still being wired.
