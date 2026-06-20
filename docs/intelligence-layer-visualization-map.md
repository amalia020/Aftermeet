# AfterMeet Intelligence Layer - Visualization Map

## Workstream Flow

```mermaid
flowchart LR
  P1["Part 1: Capture and Extraction"] --> H1["ExtractionHandoff"]
  H1 --> P2["Part 2: Enrichment and Evidence"]
  P2 --> H2["EvidenceBundle"]
  H2 --> P3["Part 3: Decision and Action Engine"]
  P3 --> H3["RecommendationPackage"]
  H3 --> P4["Part 4: Frontend Experience and Visualization"]
  P4 --> User["User sees cascade, trace, board, terminal, traction"]
```

## User Experience Flow

```mermaid
flowchart TB
  Mission["Mission Setup"] --> Capture["Capture Conversation"]
  Capture --> Processing["Processing Cascade"]
  Processing --> Trace["Decision Trace"]
  Trace --> Draft["Draft Preview"]
  Trace --> Person["Person View"]
  Draft --> Board["Follow-Up Board"]
  Board --> Outcomes["Manual Outcome Updates"]
  Outcomes --> Traction["Traction View"]
  Traction --> Terminal["Opportunity Terminal"]
  Terminal --> Capture
```

## Screen Map

```mermaid
flowchart LR
  Dashboard["/"] --> Capture["/capture"]
  Dashboard --> Contacts["/contacts"]
  Contacts --> Person["/contacts/[id]"]
  Dashboard --> Board["/board"]
  Dashboard --> Terminal["/terminal"]
  Dashboard --> Traction["/traction"]
  Capture --> Trace["Decision Trace panel"]
  Person --> Trace
  Board --> Person
```

## Contract-to-Screen Map

| Contract | Screen or Component | Owner |
| --- | --- | --- |
| `UserObjectiveProfile` | Mission setup, app shell, terminal | Part 4 consumes, Part 1 produces |
| `ProcessStageEvent` | Processing cascade | Part 4 consumes, Part 1 streams |
| `ExtractionHandoff` | Fixture replay, debug visualization | Part 4 consumes, Part 1 produces |
| `EvidenceBundle` | Person view, source register, confidence display | Part 4 consumes, Part 2 produces |
| `RecommendationPackage` | Decision trace, draft preview, board card | Part 4 consumes, Part 3 produces |
| `FrontendMockDataset` | Fixture-backed demo | Part 4 owns |

## Component Ownership

```mermaid
flowchart TB
  P4["Part 4 Frontend"] --> Shell["AppShell"]
  P4 --> Mission["MissionSetup"]
  P4 --> Capture["CaptureCard, VoiceCapture, CardScan"]
  P4 --> Cascade["ProcessingCascade"]
  P4 --> Trace["DecisionTrace, FiveForksView"]
  P4 --> Evidence["SourceRegister, ConfidenceBreakdown"]
  P4 --> Contacts["ContactList, PersonView"]
  P4 --> Board["FollowUpBoard, WarmthDecayBar"]
  P4 --> Terminal["OpportunityMatrix, RecommendedGroupCard, ActionQueue"]
  P4 --> Draft["DraftPreview"]
  P4 --> Traction["TractionView"]
```

## Parallel Build Picture

```mermaid
gantt
  title Parallel First Milestone
  dateFormat  YYYY-MM-DD
  axisFormat  %m-%d
  section Part 1
  ExtractionHandoff fixture and text capture API :p1, 2026-06-20, 2d
  section Part 2
  EvidenceBundle from fixture enrichment :p2, 2026-06-20, 2d
  section Part 3
  RecommendationPackage from fixture evidence :p3, 2026-06-20, 2d
  section Part 4
  Fixture-backed screens and visual cascade :p4, 2026-06-20, 2d
```
