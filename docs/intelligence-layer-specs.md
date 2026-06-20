---
noteId: "2b272b716c8a11f1bc4eed32644d11d4"
tags: []

---

# AfterMeet Intelligence Layer — Spec-Driven Development Plan

## 0. Project Summary

Build **AfterMeet**, a personalized relationship intelligence system for high-density networking events.

The product captures conversations, extracts structured facts, enriches the person/company with public professional context, clusters the relationship according to the user’s current objective, ranks possible next actions, and generates an evidence-backed follow-up only after the system has decided what action is actually appropriate.

This is **not** a generic CRM, digital business card clone, LinkedIn competitor, or mass follow-up generator.

It is a **goal-conditioned relationship intelligence layer**.

The core thesis:

> The same conversation means different things to different people. AfterMeet personalizes the meaning and the next action.

---

# 1. Product Positioning

## 1.1 One-Liner

AfterMeet turns event conversations into personalized next-best actions based on who the user is, what they want, who they met, and what context matters.

## 1.2 Short Pitch

At high-density events, people meet dozens of potentially valuable contacts, but most conversations decay because users do not know which ones matter, what they promised, or what action to take next.

AfterMeet captures the conversation, extracts structured relationship intelligence, enriches it with public context, scores it against the user’s current goal, and recommends whether to follow up, nudge, ask, introduce, wait, ignore, or confirm details.

## 1.3 What It Is

* A personalized relationship intelligence layer.
* A private professional memory system.
* A next-best-action ranking engine.
* A conversation-to-action policy engine.
* A source-aware enrichment system.
* A goal-conditioned follow-up assistant.
* A decision-support terminal for high-density networking.

## 1.4 What It Is Not

* Not a LinkedIn competitor.
* Not a public people marketplace.
* Not an event attendee discovery platform.
* Not a generic CRM.
* Not a mass follow-up generator.
* Not a badge scanner clone.
* Not a sales automation spam tool.
* Not an autonomous outreach bot.
* Not a tool that scrapes LinkedIn.
* Not a tool that contacts people without user confirmation.

---

# 2. Product Philosophy

## 2.1 Founder/User Remains In Control

The system provides:

* signals
* clusters
* explanations
* action suggestions
* confidence breakdowns
* decision traces
* drafts

The user decides.

The app must never behave as if it knows better than the user.

## 2.2 Less Follow-Up, Better Follow-Up

The app should not help users contact everyone.

It should help them decide:

* who deserves action
* who should stay calm
* who is going cold
* who should be ignored
* who needs confirmation
* what kind of action is appropriate

## 2.3 Evidence Before Output

The draft is the last step.

The core pipeline should be:

```text
Capture
→ Extract
→ Resolve
→ Enrich
→ Score
→ Choose action
→ Explain
→ Draft
```

Do not generate a draft until the system has:

* extracted facts
* checked context
* scored confidence
* selected action
* determined safe facts for use

## 2.4 Confidence Is Computed, Not Believed

Never blindly trust an LLM confidence score.

LLM confidence may be included as one weak signal, but system confidence must be computed from:

* entity match confidence
* source confidence
* fact confidence
* freshness
* evidence agreement
* user confirmation
* extraction certainty
* contradiction penalties

## 2.5 Private-First, Not Marketplace

The system only works on:

* people the user actually met
* notes the user created
* business cards the user captured
* public professional information relevant to that contact

Do not build:

* public user search
* attendee marketplace
* “discover people near me”
* LinkedIn-style connection graph
* event-wide people scraping
* public profiles for all attendees

---

# 3. Core Demo Narrative

## 3.1 Demo Input

The user records:

> “Maya from Recursive just closed Series A, scaling the team fast, doing the European conference circuit. She liked AfterMeet and said she wants to try it at her next event.”

## 3.2 Demo Cascade

The UI should show:

```text
Voice note
  ↓
Conversation atoms
  ↓
Public entity context
  ↓
User objective model
  ↓
Opportunity routes
  ↓
Chosen action
  ↓
Why this / why not others
  ↓
Warmth decay
  ↓
Draft
```

## 3.3 Demo Output

```text
Chosen route: USER
Confidence: High
Recommended action: Send early access today
Why:
- Explicit product interest
- High ICP fit
- Event-heavy founder/operator profile
- Low recipient burden
- Warm conversation still fresh

Why not:
- Not an investor conversation, so do not send deck
- No concrete partner pilot discussed, so do not pitch partnership yet
- No mentor ask needed yet

Draft:
Warm-peer early access message
```

## 3.4 Magic Moment

The magic moment is **not** the follow-up draft.

The magic moment is the decision trace:

> The system shows how it moved from messy conversation to personalized action.

---

# 4. User Objective Model

## 4.1 Why This Exists

The product must not default to founder mode.

It must adapt to the individual user.

The same contact means different things depending on the user’s goal.

Example:

```text
Maya, Series A founder

For a founder looking for users:
→ Potential high-value user

For a recruiter:
→ Potential client / hiring manager

For a VC:
→ Potential deal lead

For a student:
→ Potential mentor / career contact

For sponsor BD:
→ Potential customer / event buyer
```

## 4.2 User Objective Schema

Create a `UserObjectiveProfile`.

```ts
export type UserRole =
  | "founder"
  | "operator"
  | "investor"
  | "recruiter"
  | "student"
  | "job_seeker"
  | "sponsor_bd"
  | "sales"
  | "community_builder"
  | "other";

export type UserGoal =
  | "raise"
  | "hire"
  | "find_users"
  | "find_design_partners"
  | "find_mentors"
  | "find_investments"
  | "source_candidates"
  | "find_customers"
  | "find_partners"
  | "find_job_opportunities"
  | "build_community"
  | "win_hackathon"
  | "collect_wtp"
  | "learn"
  | "other";

export interface UserObjectiveProfile {
  id: string;
  userId: string;
  role: UserRole;
  activeGoals: UserGoal[];
  primaryGoal: UserGoal;
  secondaryGoals: UserGoal[];
  eventContext?: string;
  companyName?: string;
  companyStage?: string;
  productDescription?: string;
  targetCustomer?: string;
  currentTraction?: string;
  fundraisingStatus?: string;
  hiringNeeds?: string[];
  attentionBudgetToday: number;
  preferredTone: "direct" | "warm" | "formal" | "casual" | "concise";
  constraints: string[];
  createdAt: string;
  updatedAt: string;
}
```

## 4.3 Onboarding Questions

On first use, ask:

1. Who are you at this event?
2. What are you trying to achieve today?
3. What is your primary goal?
4. What secondary goals matter?
5. How many follow-ups can you realistically send today?
6. What should the app avoid doing?
7. What tone should drafts use?

## 4.4 Example Objective Profiles

### Fundraising Founder

```json
{
  "role": "founder",
  "primaryGoal": "raise",
  "secondaryGoals": ["find_users", "find_mentors"],
  "companyStage": "pre-seed",
  "fundraisingStatus": "raising €500k",
  "attentionBudgetToday": 5
}
```

### Recruiter

```json
{
  "role": "recruiter",
  "primaryGoal": "source_candidates",
  "secondaryGoals": ["find_partners"],
  "attentionBudgetToday": 8
}
```

### Sponsor BD

```json
{
  "role": "sponsor_bd",
  "primaryGoal": "find_customers",
  "secondaryGoals": ["find_partners", "build_community"],
  "attentionBudgetToday": 10
}
```

---

# 5. Core Domain Model

## 5.1 Main Entities

The system should model:

* users
* user objectives
* contacts
* conversations
* conversation atoms
* public entity context
* evidence facts
* source records
* opportunity routes
* cluster assignments
* action recommendations
* drafts
* outcomes
* decision traces

---

# 6. Database Schema

Use Postgres/Supabase if available.

If time constrained, use local JSON/in-memory store first, but structure the code as if it can persist.

## 6.1 Users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 6.2 User Objectives

```sql
CREATE TABLE user_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL,
  primary_goal TEXT NOT NULL,
  secondary_goals TEXT[] DEFAULT '{}',
  active_goals TEXT[] DEFAULT '{}',
  event_context TEXT,
  company_name TEXT,
  company_stage TEXT,
  product_description TEXT,
  target_customer TEXT,
  current_traction TEXT,
  fundraising_status TEXT,
  attention_budget_today INTEGER DEFAULT 5,
  preferred_tone TEXT DEFAULT 'warm',
  constraints TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## 6.3 Contacts

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT,
  role TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  linkedin_url TEXT,
  source_type TEXT,
  entity_match_confidence NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## 6.4 Conversations

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  contact_id UUID REFERENCES contacts(id),
  raw_text TEXT,
  capture_type TEXT NOT NULL,
  transcript TEXT,
  event_context TEXT,
  captured_at TIMESTAMPTZ DEFAULT now(),
  processing_status TEXT DEFAULT 'pending'
);
```

## 6.5 Conversation Atoms

```sql
CREATE TABLE conversation_atoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  facts JSONB DEFAULT '[]',
  asks JSONB DEFAULT '[]',
  offers JSONB DEFAULT '[]',
  commitments JSONB DEFAULT '[]',
  uncertainties JSONB DEFAULT '[]',
  sentiment TEXT,
  extraction_confidence NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 6.6 Public Entity Context

```sql
CREATE TABLE public_entity_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  provider TEXT NOT NULL,
  provider_entity_id TEXT,
  entity_type TEXT,
  canonical_name TEXT,
  raw_context JSONB,
  retrieved_at TIMESTAMPTZ DEFAULT now(),
  confidence NUMERIC DEFAULT 0
);
```

## 6.7 Source Records

```sql
CREATE TABLE source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  provider TEXT,
  source_type TEXT,
  source_name TEXT,
  source_url TEXT,
  retrieved_at TIMESTAMPTZ DEFAULT now(),
  source_confidence NUMERIC DEFAULT 0,
  notes TEXT
);
```

## 6.8 Evidence Facts

```sql
CREATE TABLE evidence_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),
  fact TEXT NOT NULL,
  fact_type TEXT,
  source_record_id UUID REFERENCES source_records(id),
  entity_match_confidence NUMERIC DEFAULT 0,
  source_confidence NUMERIC DEFAULT 0,
  extraction_confidence NUMERIC DEFAULT 0,
  freshness NUMERIC DEFAULT 0,
  contradiction_penalty NUMERIC DEFAULT 0,
  fact_confidence NUMERIC DEFAULT 0,
  safe_for_draft BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 6.9 Opportunity Routes

```sql
CREATE TABLE opportunity_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),
  route_type TEXT NOT NULL,
  score NUMERIC DEFAULT 0,
  evidence JSONB DEFAULT '[]',
  why TEXT[],
  why_not TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 6.10 Action Recommendations

```sql
CREATE TABLE action_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  contact_id UUID REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),
  recommended_action TEXT NOT NULL,
  priority_score NUMERIC DEFAULT 0,
  urgency_score NUMERIC DEFAULT 0,
  recipient_burden NUMERIC DEFAULT 0,
  confidence NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  explanation JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 6.11 Drafts

```sql
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES action_recommendations(id),
  contact_id UUID REFERENCES contacts(id),
  channel TEXT DEFAULT 'email',
  tone TEXT,
  subject TEXT,
  body TEXT,
  facts_used JSONB DEFAULT '[]',
  status TEXT DEFAULT 'drafted',
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);
```

## 6.12 Outcomes

```sql
CREATE TABLE outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  contact_id UUID REFERENCES contacts(id),
  recommendation_id UUID REFERENCES action_recommendations(id),
  outcome_type TEXT NOT NULL,
  notes TEXT,
  value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Possible outcome types:

```text
sent
reply
booked
paid
wtp
ignored
snoozed
marked_not_relevant
manual_override
```

---

# 7. System Architecture

## 7.1 Recommended Stack

Use:

* TypeScript
* React
* Tailwind
* Next.js App Router or Vite + API server
* Supabase/Postgres if possible
* Gemini API for extraction and drafting
* Cala API for structured, verified public entity context
* Gemini API (grounded with Google Search) for unstructured public context when Cala has no match
* OpenAI Whisper (audio transcription API) for voice capture/transcription
* Mollie payment link for WTP signal
* Optional: embeddings via local/simple provider if time allows

## 7.2 Hard Rules

* No API keys in frontend.
* All Cala/Gemini/OpenAI calls go through server endpoints.
* Do not scrape LinkedIn.
* Web search is a query against a search API, never a scraper. Do not crawl, paginate, or harvest profiles.
* Web search enrichment runs only as a fallback when Cala has no match, and only for contacts the user actually met.
* Web search returns professional/public context only. Discard anything personal, sensitive, or non-professional.
* Treat unstructured web facts as lower confidence than Cala-verified facts. They may inform scoring but are not draft-safe unless confidence clears threshold and ideally the user confirms.
* Every web-derived fact must carry a source record with the citation URL. No citation, not usable.
* Do not auto-send messages.
* Do not enrich strangers the user did not meet.
* Do not store sensitive personal data.
* Do not generate drafts using low-confidence facts.
* If entity confidence is low, ask user to confirm.
* If no meaningful follow-up exists, recommend no action.
* If neither Cala nor web search yields data, say "public context unavailable." Never invent.

---

## 7.3 Architecture Decision Records (ADRs)

These ADRs are accepted and reflected throughout this document, so the spec is the
single source of truth for the decisions behind the stack and pipeline.

### ADR-001 — Run the pipeline synchronously with streamed stage updates

**Status:** Accepted (applied in Phase 3 and the `/api/intelligence/process` route).

**Context.** The pipeline has several external network hops (LLM extraction, Cala,
the Gemini web fallback, LLM draft) plus local scoring. The product's magic moment is
the visible processing cascade. Serverless functions have execution-time limits, so a
request that blocks and returns only at the end risks both a timeout and a multi-second
dead screen.

**Decision.** One orchestrator route runs the pipeline and streams a stage event as each
stage completes (HTTP streaming / SSE, or Supabase Realtime row updates). The UI advances
the cascade from those events. Each external hop is wrapped in a timeout with a typed
fallback; the deterministic scoring block runs in-process and never blocks. If a hop
exceeds budget it falls back — LLM hops to saved fixtures, Cala and the web fallback to
"unavailable" — rather than failing the request.

**Alternatives considered.** Fire-and-forget + client polling (more moving parts, worse
latency feel); message queue + background worker (over-engineered for a weekend MVP).

**Consequences.** Real cascade UX with no queue infra; must keep model/token choices lean
and set an adequate function `maxDuration` so extraction + enrich + draft stay within limits.

### ADR-002 — Use OpenAI Whisper for voice transcription (not Vapi)

**Status:** Accepted (applied across the stack, env vars, providers, and demo mode).

**Context.** Voice capture is a single short dictated memo, transcribed once — batch, not
live. Vapi is a real-time voice-agent platform (telephony, turn-taking, stacked STT/LLM/TTS)
with per-minute orchestration cost, built for two-way calls.

**Decision.** Use OpenAI's audio transcription API (Whisper / `gpt-4o-transcribe` family)
for the server-side voice path. It is a single file-in / text-out call, batch-native, and
auto-detects language with strong Dutch/multilingual handling — useful for mixed Dutch/English
event conversations. Text input stays the primary capture path; voice stays cut-line #2.

**Alternatives considered.** Deepgram — comparable quality, marginally cheaper, better at
real-time streaming; revisit only if live transcription during capture is ever needed. Browser
Web Speech API — zero-cost demo option, but support varies, so not the dependable server path.

**Consequences.** One new vendor key (`OPENAI_API_KEY`); no streaming/websocket complexity;
transcription model is configurable.

### ADR-003 — Scope Cala to company/fund context, web fallback for person gaps

**Status:** Accepted (reflected in Phase 5 and Phase 5b).

**Context.** Cala's strength is verified company/financial/regulatory facts with provenance.
It is not a professional-profile provider for arbitrary private persons.

**Decision.** Use Cala for company / investor / fund context and feed its provenance into
source records. For person-level gaps, rely on the Gemini web fallback (Phase 5b) and
user-confirmed / business-card data. Never synthesize person facts.

**Consequences.** Reinforces the privacy-first thesis and keeps source attribution clean;
person resolution leans on the fallback and user confirmation rather than Cala.

### ADR-004 — Single tenant for the demo; defer RLS to post-MVP

**Status:** Accepted (applied in Phase 0).

**Context.** The spec uses `SUPABASE_SERVICE_ROLE_KEY` server-side, which bypasses
row-level security. The privacy-first positioning implies real multi-tenant isolation, but
the hackathon demo is effectively single-user.

**Decision.** Seed one demo user and run server logic under the service role for the MVP.
Document that production requires Supabase Auth + RLS policies keying every table on
`user_id` before any real users.

**Consequences.** Nothing blocks the build now; a known, named gap between the demo and a
shippable privacy-first product.

---

# 8. File Structure

Use this structure.

```text
/app
  /page.tsx                         # main dashboard
  /capture/page.tsx                  # capture flow
  /contacts/page.tsx                 # contact list
  /contacts/[id]/page.tsx            # person view
  /terminal/page.tsx                 # opportunity terminal
  /board/page.tsx                    # follow-up board
  /api
    /capture/text/route.ts
    /capture/voice/route.ts
    /capture/card/route.ts
    /intelligence/process/route.ts
    /intelligence/recommend/route.ts
    /enrich/cala/route.ts
    /enrich/web/route.ts
    /draft/generate/route.ts
    /outcomes/route.ts
    /demo/reset/route.ts

/lib
  /types
    user.ts
    contact.ts
    conversation.ts
    context.ts
    recommendation.ts
    outcome.ts
  /intelligence
    extraction.ts
    entityResolution.ts
    enrichment.ts
    sourceConfidence.ts
    factConfidence.ts
    clustering.ts
    userObjective.ts
    opportunityRouting.ts
    scoring.ts
    warmthDecay.ts
    recipientBurden.ts
    actionPolicy.ts
    draftPolicy.ts
    decisionTrace.ts
    feedbackLearning.ts
  /providers
    gemini.ts
    cala.ts
    whisper.ts
    mollie.ts
  /db
    client.ts
    queries.ts
  /demo
    savedExamples.ts
    fixtures.ts

/components
  AppShell.tsx
  MissionSetup.tsx
  CaptureCard.tsx
  VoiceCapture.tsx
  CardScan.tsx
  ConversationAtomsView.tsx
  FiveForksView.tsx
  DecisionTrace.tsx
  ConfidenceBreakdown.tsx
  SourceRegister.tsx
  ContactList.tsx
  PersonView.tsx
  FollowUpBoard.tsx
  WarmthDecayBar.tsx
  OpportunityMatrix.tsx
  RecommendedGroupCard.tsx
  ActionQueue.tsx
  DraftPreview.tsx
  TractionView.tsx
```

---

# 9. Intelligence Pipeline

## 9.1 Full Pipeline

```text
1. User objective setup
2. Conversation capture
3. LLM extraction into conversation atoms
4. Entity resolution
5. Cala public context retrieval (structured, verified)
6. Web search fallback enrichment via Gemini when Cala has no match (unstructured, cited)
7. Source register creation
8. Fact confidence scoring
9. User clustering
10. Contact clustering
11. Multi-route opportunity scoring
12. Recipient burden scoring
13. Warmth decay scoring
14. Action policy decision
15. Decision trace generation
16. Draft generation using safe facts only
17. Outcome tracking
18. Feedback learning
```

---

# 10. Phase Plan

# Phase 0 — Project Foundation

## Goal

Set up the app, environment, routing, and project conventions.

## Tasks

* Scaffold app.
* Add Tailwind.
* Add database client.
* Add server-only provider clients.
* Add environment variables.
* Add common types.
* Add demo fixture store.
* Add basic shell layout.
* Add navigation.

## Environment Variables

```text
CALA_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MOLLIE_PAYMENT_LINK=
```

## Acceptance Criteria

* App starts locally.
* No API key is exposed in browser.
* Server can read env vars.
* `/api/health` returns OK.
* TypeScript compiles.
* A single demo user is seeded; multi-tenant RLS is deferred to post-MVP (ADR-004).

---

# Phase 1 — Core Types

## Goal

Define all core domain types before building features.

## Files

```text
/lib/types/user.ts
/lib/types/contact.ts
/lib/types/conversation.ts
/lib/types/context.ts
/lib/types/recommendation.ts
/lib/types/outcome.ts
```

## Types To Implement

### User Objective

```ts
export interface UserObjectiveProfile {
  id: string;
  userId: string;
  role: UserRole;
  primaryGoal: UserGoal;
  secondaryGoals: UserGoal[];
  activeGoals: UserGoal[];
  eventContext?: string;
  companyName?: string;
  companyStage?: string;
  productDescription?: string;
  targetCustomer?: string;
  currentTraction?: string;
  attentionBudgetToday: number;
  preferredTone: Tone;
  constraints: string[];
}
```

### Contact

```ts
export interface Contact {
  id: string;
  userId: string;
  name?: string;
  role?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  sourceType: "voice" | "card" | "manual" | "import";
  entityMatchConfidence: number;
  createdAt: string;
  updatedAt: string;
}
```

### Conversation

```ts
export interface Conversation {
  id: string;
  userId: string;
  contactId?: string;
  rawText: string;
  captureType: "voice" | "text" | "card";
  transcript?: string;
  eventContext?: string;
  capturedAt: string;
}
```

### Conversation Atoms

```ts
export interface ConversationAtoms {
  facts: AtomFact[];
  asks: AtomAsk[];
  offers: AtomOffer[];
  commitments: AtomCommitment[];
  uncertainties: string[];
  sentiment?: string;
  extractionConfidence: number;
}
```

### Public Context

```ts
export interface PublicEntityContext {
  provider: "cala" | "gemini" | "web" | "manual";
  providerEntityId?: string;
  entityType: "person" | "company" | "fund" | "unknown";
  canonicalName?: string;
  rawContext: unknown;
  retrievedAt: string;
  confidence: number;
}
```

### Recommendation

```ts
export interface ActionRecommendation {
  contactId: string;
  conversationId: string;
  recommendedAction: RecommendedActionType;
  priorityScore: number;
  urgencyScore: number;
  recipientBurden: number;
  confidence: number;
  explanation: DecisionTrace;
}
```

## Acceptance Criteria

* All types compile.
* No duplicated type definitions.
* Everything imports from `/lib/types`.

---

# Phase 2 — User Objective Setup

## Goal

Create the user objective model and mission setup UI.

## UI

Build `MissionSetup.tsx`.

It should ask:

* What are you here as?
* What is your primary goal?
* What secondary goals matter?
* What company/project are you representing?
* What kind of people are valuable to you?
* How many follow-ups can you realistically send today?

## Output

Store `UserObjectiveProfile`.

## Example UI Text

```text
What are you trying to get out of this event?
```

Options:

```text
Raise
Find users
Hire
Find candidates
Meet mentors
Find partners
Find customers
Explore opportunities
```

## Acceptance Criteria

* User can create objective profile.
* Objective profile affects scoring weights.
* Dashboard displays active mode.
* User can change active goal later.

---

# Phase 3 — Capture Layer

## Goal

Capture raw conversation input.

## Capture Methods

* voice note
* text note
* business card photo

## MVP Priority

1. Text note first.
2. Voice transcription second.
3. Card photo third.

## API Routes

```text
POST /api/capture/text
POST /api/capture/voice
POST /api/capture/card
```

## Text Capture Request

```json
{
  "userId": "user_123",
  "rawText": "Met Maya from Recursive...",
  "eventContext": "MEGATHON"
}
```

## Response

```json
{
  "conversationId": "conv_123",
  "status": "captured"
}
```

## Acceptance Criteria

* User can submit text capture.
* Capture creates conversation record.
* Capture invokes the `/api/intelligence/process` orchestrator, which runs the pipeline synchronously and streams a stage event per step to the UI cascade (ADR-001).
* Each external hop is timeout-wrapped with a typed fallback (LLM to fixtures, Cala/web to "unavailable"); the deterministic scoring block never blocks (ADR-001).
* Voice and card can fallback to text in demo mode.

---

# Phase 4 — LLM Extraction Layer

## Goal

Turn raw conversation into structured atoms.

## File

```text
/lib/intelligence/extraction.ts
```

## Function

```ts
export async function extractConversationAtoms(input: {
  rawText: string;
  userObjective: UserObjectiveProfile;
}): Promise<ConversationAtomsExtractionResult>
```

## Extraction Output

```ts
export interface ConversationAtomsExtractionResult {
  contactCandidate: {
    name?: string;
    role?: string;
    company?: string;
    email?: string;
    website?: string;
    linkedinUrl?: string;
  };
  atoms: ConversationAtoms;
  opportunityHints: {
    route: OpportunityType;
    score: number;
    evidence: string[];
  }[];
}
```

## Gemini Prompt

System:

```text
You extract structured professional conversation information. Return JSON only. Do not invent facts. If uncertain, put details in uncertainties. Never output sensitive personal data unless explicitly present and professionally relevant. Do not write a follow-up message yet.
```

User:

```text
User objective:
{{userObjective}}

Conversation:
{{rawText}}

Extract:
- contact candidate
- facts
- asks
- offers
- commitments
- uncertainties
- opportunity route hints
- extraction confidence
Return JSON only.
```

## Acceptance Criteria

* Extraction returns valid JSON.
* Parse failures fallback to safe error.
* No draft is generated in this phase.
* Uncertain details are not treated as facts.
* Unit tests cover messy input.

---

# Phase 5 — Cala Integration

## Goal

Use Cala as the primary public entity context provider for structured, verified
facts, scoped to company / investor / fund context (its strength). Cala is always
tried first. When it has no match — including most person-level lookups — the Gemini
web search fallback (Phase 5b) supplies unstructured context, and person facts
otherwise rely on user confirmation. Never synthesize person facts (ADR-003).

## Files

```text
/lib/providers/cala.ts
/app/api/enrich/cala/route.ts
```

## Cala Functions

```ts
export async function calaKnowledgeSearch(input: string): Promise<CalaSearchResult>
export async function calaKnowledgeQuery(input: string): Promise<CalaQueryResult>
export async function calaEntitySearch(name: string): Promise<CalaEntityCandidate[]>
export async function calaRetrieveEntity(entityId: string): Promise<CalaEntityDetail>
```

## Use Cases

### Person/Company Resolution

Input:

```text
Maya Linden Recursive
```

Output:

```text
possible entity candidates
```

### Company Context

Input:

```text
What is Recursive, what industry is it in, and what recent funding or growth signals exist?
```

### Investor Context

Input:

```text
What sectors and stages does this VC/fund appear to focus on?
```

### Market/Comparable Context

Input:

```text
What are common patterns in event networking or AI follow-up tools?
```

## Cala Request Strategy

Use Cala only when:

* entity match is uncertain
* contact is high priority
* public context can change recommended action
* draft quality would materially improve
* user explicitly asks for deeper context

Do not call Cala for every low-priority contact.

## Acceptance Criteria

* Cala API key stays server-side.
* Cala errors do not break app.
* Missing or low-confidence Cala result triggers the web search fallback (Phase 5b); if that also fails, leads to "public context unavailable," not hallucination.
* Cala context is stored with source records.
* Entity match remains confirmable by user.

---

# Phase 5b — Gemini + Web Search Fallback Enrichment

## Goal

When Cala has no match (or only a low-confidence match) for a contact that
warrants enrichment, retrieve unstructured public professional context using
Gemini grounded with Google Search. This is the fallback layer. Cala is always
tried first; this never runs before Cala.

## Files

```text
/lib/providers/gemini.ts
/lib/intelligence/enrichment.ts
/app/api/enrich/web/route.ts
```

## Enrichment Cascade

`enrichment.ts` owns the order so the rest of the pipeline calls one function:

```text
1. Try Cala (structured, verified).
2. If Cala returns no match OR a match below the medium threshold,
   AND the contact warrants enrichment (see triggers below),
   call Gemini grounded with Google Search for unstructured context.
3. Convert each grounded claim into an evidence fact + source record (cited URL).
4. If neither yields data, return "public context unavailable." Never invent.
```

## When To Use The Web Fallback

Run the web search fallback only when ALL of these hold:

* Cala returned no entity match, or a match below the medium threshold.
* The contact is high priority, ambiguous-but-important, or the user explicitly asked for deeper context.
* The conversation lacks the facts needed to score or draft well.

Do not run web search for every low-priority contact. Do not run it before Cala.

## Gemini Function

```ts
export async function geminiWebContext(input: {
  name?: string;
  company?: string;
  role?: string;
  query: string;
}): Promise<WebContextResult>
```

Implementation calls the Gemini API with the Google Search grounding tool
enabled, so the model answers from live web results and returns grounding
citations (URLs) alongside the text.

## Output

```ts
export interface WebContextResult {
  summary: string;            // unstructured professional context
  claims: {
    text: string;             // a single extracted professional fact
    sourceUrl: string;        // grounding citation
    sourceType: SourceType;   // inferred from the citation domain
  }[];
  retrievedAt: string;
  available: boolean;         // false => "public context unavailable"
}
```

## Gemini Prompt

System:

```text
You retrieve public, professional context about a person or company the user met at an event. Use only the grounded web results. Return concise professional facts, each with its source URL. Do not include personal, sensitive, or non-professional information. Do not guess. If the results do not clearly match the person/company, return available=false. Return JSON only.
```

User:

```text
Person/company:
{{name}} — {{role}} at {{company}}

Question:
{{query}}

Return:
- summary
- claims (each with text + sourceUrl)
- available
Return JSON only.
```

## Turning Web Claims Into Evidence

Each returned claim becomes an `evidence_fact` backed by its own `source_record`:

* `source_record.source_url` = the grounding citation.
* `source_record.source_type` is inferred from the citation domain:
  company_website, fund_website, official_press, reputable_news, personal_website,
  else search_snippet.
* `sourceConfidence` is computed from `SOURCE_PRIORS` for that type (Phase 6).
* Because extraction from unstructured text and entity match are fuzzier than
  Cala, `factConfidence` (Phase 8) naturally lands lower. Web facts therefore
  default to NOT `safe_for_draft`. They may inform scoring and be shown to the
  user, but only cross the draft threshold if `factConfidence >= 0.75` and ideally
  the user confirms.

## Acceptance Criteria

* Gemini key stays server-side.
* Web search runs only as a fallback after Cala, only for met contacts.
* Every web fact has a source record with a citation URL.
* No citation, the fact is discarded.
* Personal, sensitive, or non-professional content is filtered out.
* Web facts are lower confidence than Cala facts and are not draft-safe by default.
* If Gemini returns `available=false`, system says "public context unavailable."
* Gemini errors do not break the app; the pipeline continues with what it has.

---

# Phase 6 — Source Register

## Goal

Track where every enriched fact comes from.

## File

```text
/lib/intelligence/sourceConfidence.ts
```

## Source Record

```ts
export interface SourceRecord {
  id: string;
  provider: "cala" | "manual" | "conversation" | "business_card" | "web";
  sourceType:
    | "user_voice_note"
    | "business_card"
    | "company_website"
    | "fund_website"
    | "official_press"
    | "reputable_news"
    | "cala_verified_fact"
    | "personal_website"
    | "search_snippet"
    | "unknown";
  sourceName?: string;
  sourceUrl?: string;
  retrievedAt: string;
  sourceConfidence: number;
}
```

## Source Priors

```ts
export const SOURCE_PRIORS = {
  business_card: 0.88,
  user_voice_note: 0.72,
  company_website: 0.90,
  fund_website: 0.90,
  official_press: 0.88,
  reputable_news: 0.80,
  cala_verified_fact: 0.82,
  personal_website: 0.75,
  search_snippet: 0.45,
  unknown: 0.20
};
```

## Function

```ts
export function sourceConfidence(source: SourceRecord): number {
  return clamp01(
    0.45 * sourcePrior(source.sourceType) +
    0.20 * freshnessScore(source.retrievedAt) +
    0.20 * provenanceScore(source) +
    0.15 * crossSourceAgreement(source)
  );
}
```

## Acceptance Criteria

* Every enriched fact has a source record.
* UI can show “why we believe this.”
* No source = low confidence.
* Source score is deterministic.

---

# Phase 7 — Entity Resolution

## Goal

Determine whether Cala/public context matches the person/company captured.

## File

```text
/lib/intelligence/entityResolution.ts
```

## Function

```ts
export function entityMatchConfidence(input: {
  capturedName?: string;
  capturedCompany?: string;
  capturedRole?: string;
  capturedDomain?: string;
  candidateName?: string;
  candidateCompany?: string;
  candidateRole?: string;
  candidateDomain?: string;
  sourceAgreementScore?: number;
  lastUpdated?: string;
}): number
```

## Formula

```ts
score =
  0.30 * nameSimilarity +
  0.25 * companySimilarity +
  0.15 * roleSimilarity +
  0.15 * domainMatch +
  0.10 * sourceAgreement +
  0.05 * freshness
```

## Match Labels

```ts
if score >= 0.75 → high
if score >= 0.50 → medium
if score >= 0.30 → low
else → no_match
```

## Acceptance Criteria

* Ambiguous names produce low/medium match.
* Low match blocks draft use of enriched facts.
* UI prompts user to confirm low match.
* Tests cover common names, missing company, exact business card match.

---

# Phase 8 — Fact Confidence

## Goal

Compute confidence per fact.

## File

```text
/lib/intelligence/factConfidence.ts
```

## Function

```ts
export function factConfidence(fact: EvidenceFact): number {
  return clamp01(
    fact.sourceConfidence *
    fact.entityMatchConfidence *
    fact.extractionConfidence *
    fact.freshness *
    (1 - fact.contradictionPenalty)
  );
}
```

## Fact Safety Thresholds

```text
>= 0.75: safe for draft
0.45–0.75: safe for internal scoring, phrase carefully
< 0.45: do not use unless user confirms
```

## Acceptance Criteria

* Low-confidence facts never appear in draft.
* Medium-confidence facts can influence ranking but not be stated as certain.
* Contradictions reduce score.
* UI shows confidence breakdown.

---

# Phase 9 — User and Contact Clustering

## Goal

Cluster both the user and the contact.

## Files

```text
/lib/intelligence/userObjective.ts
/lib/intelligence/clustering.ts
```

## User Cluster

The user can belong to multiple modes.

```ts
export interface UserClusterScores {
  fundraising: number;
  hiring: number;
  userDiscovery: number;
  partnerships: number;
  mentorship: number;
  recruiting: number;
  jobSeeking: number;
  sponsorBd: number;
}
```

## Contact Cluster

```ts
export interface ContactClusterScores {
  investor: number;
  potentialUser: number;
  potentialHire: number;
  mentor: number;
  partner: number;
  recruiter: number;
  sponsor: number;
  founderPeer: number;
  lowPriority: number;
}
```

## Function

```ts
export function inferUserCluster(input: {
  objective: UserObjectiveProfile;
  recentConversations: ConversationSummary[];
  outcomes: OutcomeSummary[];
}): UserClusterScores
```

```ts
export function classifyContactCluster(input: {
  contact: Contact;
  atoms: ConversationAtoms;
  publicContext?: PublicEntityContext;
}): ContactClusterScores
```

## Acceptance Criteria

* Clusters are multi-label.
* User can override active goal.
* Contact can be both user and mentor, etc.
* UI shows route scores, not one forced label.

---

# Phase 10 — Opportunity Routing

## Goal

Generate multi-label opportunity routes.

## File

```text
/lib/intelligence/opportunityRouting.ts
```

## Opportunity Types

```ts
export type OpportunityType =
  | "raise"
  | "hire"
  | "user"
  | "partner"
  | "mentor"
  | "candidate"
  | "customer"
  | "sponsor"
  | "job"
  | "community"
  | "other";
```

## Function

```ts
export function scoreOpportunityRoutes(input: {
  userCluster: UserClusterScores;
  contactCluster: ContactClusterScores;
  atoms: ConversationAtoms;
  facts: EvidenceFact[];
  objective: UserObjectiveProfile;
}): OpportunityRoute[]
```

## Output

```ts
export interface OpportunityRoute {
  type: OpportunityType;
  score: number;
  evidence: string[];
  why: string[];
  whyNot: string[];
}
```

## Acceptance Criteria

* One contact can have multiple routes.
* Top route is chosen but suppressed routes remain visible.
* “Why not” explanations are generated.
* UI can show five-fork view.

---

# Phase 11 — Recipient Burden

## Goal

Avoid spammy recommendations.

## File

```text
/lib/intelligence/recipientBurden.ts
```

## Function

```ts
export function recipientBurden(input: {
  messageSpecificity: number;
  askSize: number;
  relationshipStrength: number;
  mutualValue: number;
  timingFit: number;
}): number
```

## Formula

```ts
burden =
  0.30 * genericness +
  0.25 * askSize +
  0.20 * weakContextPenalty +
  0.15 * lowMutualValuePenalty +
  0.10 * timingPenalty
```

## Policy

```text
burden > 0.70:
  recommend DO_NOT_SEND or ASK_FOR_CONFIRMATION
```

## Acceptance Criteria

* Generic vague follow-ups get high burden.
* Specific mutual-value follow-ups get low burden.
* High burden blocks auto-generation of pushy drafts.
* UI shows “recipient burden: low/medium/high.”

---

# Phase 12 — Warmth Decay

## Goal

Compute whether a relationship is going cold.

## File

```text
/lib/intelligence/warmthDecay.ts
```

## Base Half-Life

```ts
export const HALF_LIFE_HOURS = {
  raise: 36,
  hire: 48,
  user: 72,
  partner: 96,
  mentor: 120,
  candidate: 48,
  customer: 72,
  sponsor: 72,
  job: 48,
  community: 96,
  other: 72
};
```

## Function

```ts
export function warmthScore(input: {
  opportunityType: OpportunityType;
  hoursSinceLastAction: number;
  status: ContactStatus;
}): number {
  const halfLife = HALF_LIFE_HOURS[input.opportunityType] ?? 72;
  const base = Math.exp(-input.hoursSinceLastAction / halfLife);

  if (input.status === "reply") return clamp01(base * 1.5);
  if (input.status === "drafted") return clamp01(base * 1.2);
  if (input.status === "booked") return 0;

  return clamp01(base);
}
```

## Acceptance Criteria

* “Cold” depends on opportunity type and status.
* Reply state is urgent if user has not responded.
* Booked never flags.
* UI shows freshness/warmth indicator.

---

# Phase 13 — Opportunity Priority Score

## Goal

Rank the action opportunity for this user.

## File

```text
/lib/intelligence/scoring.ts
```

## Function

```ts
export function opportunityPriority(input: {
  userGoalFit: number;
  contactPovFit: number;
  stakes: number;
  urgencyDecay: number;
  explicitCommitment: number;
  factConfidence: number;
  relationshipStrength: number;
  recipientBurden: number;
  uncertaintyPenalty: number;
}): number
```

## Formula

```ts
priority =
  0.25 * userGoalFit +
  0.20 * contactPovFit +
  0.15 * stakes +
  0.15 * urgencyDecay +
  0.10 * explicitCommitment +
  0.10 * factConfidence +
  0.05 * relationshipStrength -
  0.15 * recipientBurden -
  0.10 * uncertaintyPenalty
```

Clamp score to [0, 1].

## Acceptance Criteria

* Different user objectives produce different priorities.
* High recipient burden lowers priority.
* Explicit commitments raise priority.
* Low confidence lowers priority.

---

# Phase 14 — Action Policy Engine

## Goal

Select the next best action.

## File

```text
/lib/intelligence/actionPolicy.ts
```

## Action Types

```ts
export type RecommendedActionType =
  | "SEND_FIRST_FOLLOWUP"
  | "SEND_DRAFT"
  | "SEND_NUDGE"
  | "REPLY_NOW"
  | "ASK_SHARP_QUESTION"
  | "SEND_EARLY_ACCESS"
  | "SEND_DECK"
  | "PROPOSE_COFFEE"
  | "PROPOSE_PILOT"
  | "MAKE_INTRO"
  | "WAIT"
  | "SNOOZE"
  | "DO_NOT_CONTACT"
  | "CONFIRM_DETAILS"
  | "STAY_CALM";
```

## Function

```ts
export function chooseAction(input: {
  status: ContactStatus;
  entityMatchConfidence: number;
  recipientBurden: number;
  priorityScore: number;
  urgencyScore: number;
  topOpportunityRoute: OpportunityRoute;
  hasExplicitCommitment: boolean;
}): RecommendedActionType
```

## Policy

```ts
if entityMatchConfidence < 0.45:
  return "CONFIRM_DETAILS"

if recipientBurden > 0.70:
  return "DO_NOT_CONTACT"

if status === "new" and priorityScore > 0.65:
  return actionForOpportunity(topOpportunityRoute)

if status === "drafted" and priorityScore > 0.55:
  return "SEND_DRAFT"

if status === "sent" and urgencyScore > 0.70:
  return "SEND_NUDGE"

if status === "reply":
  return "REPLY_NOW"

if priorityScore < 0.35:
  return "STAY_CALM"

return "WAIT"
```

## Acceptance Criteria

* System can recommend no action.
* System never blindly drafts for all contacts.
* Action depends on status.
* Action depends on user objective.
* Action produces explanation.

---

# Phase 15 — Draft Permission Gate

## Goal

Ensure only trusted facts enter drafts.

## File

```text
/lib/intelligence/draftPolicy.ts
```

## Function

```ts
export function factsAllowedInDraft(facts: EvidenceFact[]): EvidenceFact[] {
  return facts.filter(fact =>
    fact.factConfidence >= 0.75 &&
    fact.isProfessional === true &&
    fact.isSensitive !== true &&
    fact.sourceType !== "unknown"
  );
}
```

## Acceptance Criteria

* Low-confidence facts do not appear in drafts.
* Sensitive details are filtered.
* Draft includes facts used list.
* UI can show “facts used in this draft.”

---

# Phase 16 — Draft Generation

## Goal

Generate the final message after action selection.

## File

```text
/lib/intelligence/draftGeneration.ts
```

## Prompt

System:

```text
You write concise professional follow-ups based only on approved facts. Do not invent details. Match the requested tone. Avoid pushiness. The user remains in control. Return JSON only.
```

User:

```text
User objective:
{{objective}}

Contact:
{{contact}}

Chosen action:
{{action}}

Approved facts:
{{factsAllowedInDraft}}

Why this action:
{{whyThis}}

Recipient burden:
{{recipientBurden}}

Tone:
{{tone}}

Generate:
- subject if email
- body
- channel suggestion
- facts used
- risk note if any
```

## Output

```json
{
  "channel": "email",
  "tone": "warm-peer",
  "subject": "Great meeting you at MEGATHON",
  "body": "...",
  "facts_used": ["..."],
  "risk_note": null
}
```

## Acceptance Criteria

* Draft uses only approved facts.
* Draft tone matches action.
* Draft is short.
* Draft can be edited.
* Draft is not sent automatically.

---

# Phase 17 — Decision Trace

## Goal

Make the intelligence visible.

## File

```text
/lib/intelligence/decisionTrace.ts
```

## Decision Trace Object

```ts
export interface DecisionTrace {
  inputSummary: string;
  extractedFacts: string[];
  retrievedContext: string[];
  routeScores: OpportunityRoute[];
  chosenRoute: OpportunityRoute;
  chosenAction: RecommendedActionType;
  whyThisAction: string[];
  whyNotOtherActions: string[];
  confidenceBreakdown: {
    entityMatch: number;
    sourceConfidence: number;
    factConfidence: number;
    userGoalFit: number;
    contactPovFit: number;
    recipientBurden: number;
    finalConfidence: number;
  };
  safeFactsUsed: string[];
  warnings: string[];
}
```

## UI

Show as cascade:

```text
Conversation
↓
Facts
↓
Context
↓
Routes
↓
Decision
↓
Draft
```

## Acceptance Criteria

* Every recommendation has a decision trace.
* User can inspect why.
* User can see why other actions were not chosen.
* Trace is understandable in under 10 seconds.

---

# Phase 18 — Opportunity Terminal

## Goal

Give users a control-panel view without making it founder-only.

## Components

```text
OpportunityMatrix.tsx
RecommendedGroupCard.tsx
ActionQueue.tsx
CoverageGapView.tsx
```

## Terminal Should Show

* active user objective
* current conversation clusters
* opportunity coverage
* coverage gaps
* recommended next group
* action queue
* warm/cold threads
* attention budget
* traction outcomes

## Example

```text
Active goal: collect WTP
Attention budget: 5

Current opportunity mix:
- 5 mentor/peer conversations
- 2 potential users
- 1 investor
- 0 paid user leads

Coverage gap:
Not enough target-ICP user conversations.

Recommended next group:
Founder/operators who attend 4+ events per year.

Suggested action:
Ask 3 of them for €9 paid reuse signal.
```

## Acceptance Criteria

* Terminal adapts to user objective.
* It does not say founder by default.
* It recommends clusters, not random people.
* It explains why a cluster matters.

---

# Phase 19 — Cluster Recommendation

## Goal

Recommend types/groups of people the user should prioritize next.

## File

```text
/lib/intelligence/groupRecommendation.ts
```

## Function

```ts
export function recommendNextCluster(input: {
  userObjective: UserObjectiveProfile;
  currentClusters: ContactClusterSummary[];
  outcomes: OutcomeSummary[];
  attentionBudget: number;
}): ClusterRecommendation[]
```

## Score

```ts
score =
  0.25 * goalFit +
  0.25 * coverageGap +
  0.20 * expectedSignal +
  0.10 * accessibility +
  0.10 * urgency +
  0.10 * confidence
```

## Output

```ts
export interface ClusterRecommendation {
  clusterName: string;
  score: number;
  why: string[];
  suggestedAction: string;
  expectedSignal: string;
  confidence: number;
}
```

## Acceptance Criteria

* Recommends groups, not marketplace profiles.
* Based on coverage gaps.
* Based on user objective.
* Can say no group recommendation if insufficient data.
* UI shows reasoning.

---

# Phase 20 — Follow-Up Board

## Goal

Status-based board with warmth/coldness logic.

## Statuses

```text
new
drafted
sent
reply
booked
archived
```

## Board Rules

* New going cold → first follow-up
* Drafted going cold → send existing draft
* Sent going cold → gentle nudge
* Reply waiting → respond now
* Booked → never flags
* Archived → calm

## Acceptance Criteria

* Cards show status.
* Cards show time since last relevant action.
* Only rare contacts get warning flag.
* Warning flag requires stakes × staleness.
* Board feeds traction view.

---

# Phase 21 — Traction View

## Goal

Show proof, not vanity.

## Metrics

Show:

* follow-ups sent
* replies received
* booked meetings
* WTP signals
* paid commits
* reply rate by opportunity type
* actions completed
* contacts archived/ignored

Do not lead with:

* captures
* signups
* number of scanned cards

## Acceptance Criteria

* User can mark sent.
* User can mark reply.
* User can mark booked.
* User can record WTP/paid signal.
* Traction view updates.

---

# Phase 22 — Feedback Learning

## Goal

Use outcomes to improve recommendations.

## File

```text
/lib/intelligence/feedbackLearning.ts
```

## Simple MVP Logic

Track conversion by opportunity type:

```ts
replyRateByType
bookingRateByType
paidRateByType
```

Use it as small scoring adjustment.

```ts
outcomeBoost =
  0.05 * replyRateForType +
  0.10 * bookingRateForType +
  0.15 * paidRateForType
```

## Acceptance Criteria

* Outcomes affect future scores slightly.
* No overfitting after one data point.
* UI can say “your user follow-ups are converting best.”

---

# Phase 23 — Privacy and Compliance Guardrails

## Rules

* Only enrich people the user actually met.
* No LinkedIn scraping.
* No event attendee scraping.
* No bulk people discovery.
* No sensitive personal data.
* No automatic outreach.
* Web search is fallback-only (used when Cala has no match) and queries a search API, never a scraper. No crawling, pagination, or profile harvesting.
* Web facts are professional/public only, stored with citation source records, lower confidence, and user-removable.
* Store source records.
* Allow deletion.
* Allow user to edit/remove facts.
* Keep facts professional and relevant.
* Show privacy/acceptable use nudge.

## Acceptable Use Text

```text
Record your own summary after the conversation. Do not record others without their knowledge.
```

## Acceptance Criteria

* Nudge appears in capture UI.
* User can delete contact.
* User can delete enriched facts.
* System can run without public enrichment.
* If context unavailable, system does not invent.

---

# Phase 24 — UI Screens

## 24.1 Mission Setup

Shows:

```text
What are you trying to get out of this event?
```

User selects objective.

## 24.2 Capture Screen

Shows:

* voice button
* text fallback
* card scan
* acceptable use note

## 24.3 Processing Screen

Shows live cascade:

```text
Capturing
Extracting
Resolving entity
Retrieving context
Scoring routes
Choosing action
Generating draft
```

## 24.4 Decision Trace Screen

Shows:

* extracted facts
* Cala/public context
* route scores
* chosen action
* why this
* why not others
* confidence breakdown
* draft

## 24.5 Contact List

Shows:

* calm by default
* rare “follow up now” flag
* freshness dot
* status
* no leaderboard-style grading of humans

## 24.6 Person View

Shows:

* contact details
* voice transcript
* business card
* public context
* source register
* conversation atoms
* follow-up history

## 24.7 Board

Columns:

```text
New
Drafted
Sent
Reply
Booked
```

## 24.8 Opportunity Terminal

Shows:

* active objective
* coverage matrix
* recommended next cluster
* action queue
* opportunity portfolio balance

## 24.9 Traction View

Shows:

* sent
* replies
* booked
* paid
* WTP
* conversion by opportunity type

---

# Phase 25 — Demo Mode and Fallback

## Goal

Ensure the demo cannot fail.

## Demo Mode Requirements

* Saved example contacts.
* Saved example Cala response.
* Saved example Gemini/web search response.
* Saved extraction response.
* Saved decision trace.
* Toggle demo mode in env.

## Rule

Fallback should never pretend to be live.

In demo mode, label:

```text
Demo data
```

## Acceptance Criteria

* App works without Cala key.
* App works without Gemini key (skips web fallback).
* App works without Gemini key using saved examples.
* App works without OpenAI/Whisper using text input.
* Live mode preferred if keys available.

---

# Phase 26 — Tests

## Unit Tests

Test:

* `entityMatchConfidence`
* `sourceConfidence`
* `factConfidence`
* `inferUserCluster`
* `classifyContactCluster`
* `scoreOpportunityRoutes`
* `recipientBurden`
* `warmthScore`
* `opportunityPriority`
* `chooseAction`
* `factsAllowedInDraft`

## Example Test Cases

### Low Confidence Entity

Input:

```text
Maya, no company
```

Expected:

```text
entity match low
action confirm details
```

### High Burden

Input:

```text
generic ask for coffee
weak relationship
```

Expected:

```text
recipient burden high
recommend do not contact or stay calm
```

### Reply State

Input:

```text
status = reply
```

Expected:

```text
action = REPLY_NOW
```

### Investor Contact for User-Discovery Goal

Input:

```text
user goal = find users
contact = investor
```

Expected:

```text
lower priority than potential user
```

---

# Phase 27 — Build Order

## Order

1. Core types
2. Mission setup
3. Text capture
4. Extraction endpoint
5. Decision trace fixture
6. Five-fork UI
7. Scoring functions
8. Action policy
9. Draft generation
10. Contact list + person view
11. Board
12. Cala integration
13. Source register
14. Opportunity terminal
15. Traction view
16. Demo fallback
17. Polish

---

# Phase 28 — MVP Cut Lines

If behind, cut in this order:

1. Card scan
2. Voice capture
3. Web search fallback enrichment
4. Cala live enrichment
5. Opportunity terminal
6. Feedback learning
7. Advanced clustering

Never cut:

* objective model
* extraction
* five-fork route
* custom scoring
* decision trace
* action policy
* draft preview
* contact list
* board
* demo fallback

---

# Phase 29 — Final MVP Acceptance Criteria

The MVP is successful if:

1. User can set objective.
2. User can capture conversation.
3. System extracts structured atoms.
4. System identifies contact.
5. System optionally enriches with Cala.
6. System computes confidence.
7. System generates multi-route opportunity scores.
8. System chooses one action.
9. System explains why.
10. System explains why not other actions.
11. System drafts using only safe facts.
12. User can send/mark sent manually.
13. Board tracks status.
14. Coldness indicator works.
15. Traction view shows proof metrics.
16. Demo mode works if live APIs fail.

---

# Phase 30 — Codex Implementation Instructions

When implementing:

* Work phase by phase.
* Do not jump to UI before types and scoring functions exist.
* Build deterministic scoring before fancy drafts.
* Keep LLM prompts isolated in provider files.
* Keep Cala isolated in provider files.
* Never call external APIs directly from client components.
* Use typed return values.
* Add tests for scoring functions.
* Add fallback fixtures.
* Preserve user control.
* Never auto-send messages.
* Do not implement people discovery or marketplace features.
* Do not scrape LinkedIn.
* If uncertain, mark as uncertain.
* If low confidence, ask user to confirm.
* If high recipient burden, recommend no action.

---

# Final Product Sentence

AfterMeet is a goal-conditioned relationship intelligence layer.

It captures conversations, enriches professional context, clusters opportunities, ranks next-best actions, and helps each user decide what to do before warmth decays.

The draft is not the product.

The intelligence layer is the product.
