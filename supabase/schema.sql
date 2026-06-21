create extension if not exists pgcrypto;

grant usage on schema public to authenticated, service_role;

create table if not exists public.user_objectives (
  id text primary key default ('obj_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  primary_goal text not null,
  active_goals text[] not null default '{}',
  secondary_goals text[] not null default '{}',
  event_context text,
  company_name text,
  company_stage text,
  product_description text,
  target_customer text,
  current_traction text,
  fundraising_status text,
  hiring_needs text[] not null default '{}',
  attention_budget_today integer not null default 3,
  preferred_tone text not null default 'warm',
  constraints text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id text primary key default ('contact_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  role text,
  company text,
  email text,
  phone text,
  website text,
  linkedin_url text,
  source_type text not null default 'manual',
  entity_match_confidence numeric not null default 0.5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id text primary key default ('conv_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id text references public.contacts(id) on delete set null,
  raw_text text not null,
  capture_type text not null,
  transcript text,
  event_context text,
  captured_at timestamptz not null default now(),
  processing_status text not null default 'pending'
);

create table if not exists public.conversation_atoms (
  id text primary key default ('atoms_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id text not null references public.conversations(id) on delete cascade,
  facts jsonb not null default '[]'::jsonb,
  asks jsonb not null default '[]'::jsonb,
  offers jsonb not null default '[]'::jsonb,
  commitments jsonb not null default '[]'::jsonb,
  uncertainties text[] not null default '{}',
  sentiment text,
  extraction_confidence numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.public_entity_context (
  id text primary key default ('ctx_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id text references public.contacts(id) on delete cascade,
  provider text not null,
  provider_entity_id text,
  entity_type text not null default 'unknown',
  canonical_name text,
  raw_context jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz not null default now(),
  confidence numeric not null default 0
);

create table if not exists public.source_records (
  id text primary key default ('src_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id text references public.contacts(id) on delete cascade,
  provider text not null,
  source_type text not null,
  source_name text,
  source_url text,
  retrieved_at timestamptz not null default now(),
  source_confidence numeric not null default 0,
  notes text
);

create table if not exists public.evidence_facts (
  id text primary key default ('fact_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id text references public.contacts(id) on delete cascade,
  conversation_id text not null references public.conversations(id) on delete cascade,
  fact text not null,
  fact_type text,
  source_record_id text references public.source_records(id) on delete set null,
  source_type text not null,
  entity_match_confidence numeric not null default 0,
  source_confidence numeric not null default 0,
  extraction_confidence numeric not null default 0,
  freshness numeric not null default 0,
  contradiction_penalty numeric not null default 0,
  fact_confidence numeric not null default 0,
  safe_for_draft boolean not null default false,
  is_professional boolean not null default true,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_bundles (
  id text primary key default ('bundle_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id text references public.contacts(id) on delete cascade,
  conversation_id text references public.conversations(id) on delete cascade,
  request_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.extraction_handoffs (
  request_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.opportunity_routes (
  id text primary key default ('route_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id text references public.contacts(id) on delete cascade,
  conversation_id text references public.conversations(id) on delete cascade,
  type text not null,
  score numeric not null default 0,
  evidence text[] not null default '{}',
  why text[] not null default '{}',
  why_not text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.action_recommendations (
  id text primary key default ('rec_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id text not null references public.contacts(id) on delete cascade,
  conversation_id text not null references public.conversations(id) on delete cascade,
  recommended_action text not null,
  priority_score numeric not null,
  urgency_score numeric not null,
  recipient_burden numeric not null,
  confidence numeric not null,
  status text not null default 'pending',
  explanation jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.drafts (
  id text primary key default ('draft_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id text not null references public.action_recommendations(id) on delete cascade,
  contact_id text not null references public.contacts(id) on delete cascade,
  channel text not null default 'manual',
  tone text,
  subject text,
  body text not null,
  facts_used text[] not null default '{}',
  status text not null default 'drafted',
  risk_note text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.outcomes (
  id text primary key default ('outcome_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id text not null references public.contacts(id) on delete cascade,
  recommendation_id text references public.action_recommendations(id) on delete set null,
  outcome_type text not null,
  notes text,
  value numeric,
  created_at timestamptz not null default now()
);

alter table public.user_objectives enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_atoms enable row level security;
alter table public.public_entity_context enable row level security;
alter table public.source_records enable row level security;
alter table public.evidence_facts enable row level security;
alter table public.evidence_bundles enable row level security;
alter table public.extraction_handoffs enable row level security;
alter table public.opportunity_routes enable row level security;
alter table public.action_recommendations enable row level security;
alter table public.drafts enable row level security;
alter table public.outcomes enable row level security;

grant select, insert, update, delete on table
  public.user_objectives,
  public.contacts,
  public.conversations,
  public.conversation_atoms,
  public.public_entity_context,
  public.source_records,
  public.evidence_facts,
  public.evidence_bundles,
  public.extraction_handoffs,
  public.opportunity_routes,
  public.action_recommendations,
  public.drafts,
  public.outcomes
to authenticated, service_role;

drop policy if exists "own objectives" on public.user_objectives;
drop policy if exists "own contacts" on public.contacts;
drop policy if exists "own conversations" on public.conversations;
drop policy if exists "own conversation atoms" on public.conversation_atoms;
drop policy if exists "own public context" on public.public_entity_context;
drop policy if exists "own source records" on public.source_records;
drop policy if exists "own evidence facts" on public.evidence_facts;
drop policy if exists "own evidence bundles" on public.evidence_bundles;
drop policy if exists "own extraction handoffs" on public.extraction_handoffs;
drop policy if exists "own opportunity routes" on public.opportunity_routes;
drop policy if exists "own recommendations" on public.action_recommendations;
drop policy if exists "own drafts" on public.drafts;
drop policy if exists "own outcomes" on public.outcomes;

create policy "own objectives" on public.user_objectives for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own contacts" on public.contacts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own conversations" on public.conversations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own conversation atoms" on public.conversation_atoms for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own public context" on public.public_entity_context for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own source records" on public.source_records for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own evidence facts" on public.evidence_facts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own evidence bundles" on public.evidence_bundles for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own extraction handoffs" on public.extraction_handoffs for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own opportunity routes" on public.opportunity_routes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own recommendations" on public.action_recommendations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own drafts" on public.drafts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own outcomes" on public.outcomes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists user_objectives_user_updated_idx on public.user_objectives(user_id, updated_at desc);
create index if not exists contacts_user_updated_idx on public.contacts(user_id, updated_at desc);
create index if not exists contacts_user_email_idx on public.contacts(user_id, email);
create index if not exists conversations_user_captured_idx on public.conversations(user_id, captured_at desc);
create index if not exists conversations_contact_idx on public.conversations(contact_id);
create index if not exists conversation_atoms_user_idx on public.conversation_atoms(user_id);
create index if not exists conversation_atoms_conversation_idx on public.conversation_atoms(conversation_id);
create index if not exists public_entity_context_user_idx on public.public_entity_context(user_id);
create index if not exists public_entity_context_contact_idx on public.public_entity_context(contact_id);
create index if not exists source_records_user_idx on public.source_records(user_id);
create index if not exists action_recommendations_user_created_idx on public.action_recommendations(user_id, created_at desc);
create index if not exists action_recommendations_contact_created_idx on public.action_recommendations(contact_id, created_at desc);
create index if not exists action_recommendations_conversation_idx on public.action_recommendations(conversation_id);
create index if not exists evidence_bundles_user_idx on public.evidence_bundles(user_id);
create index if not exists evidence_bundles_contact_idx on public.evidence_bundles(contact_id);
create index if not exists evidence_bundles_conversation_idx on public.evidence_bundles(conversation_id);
create index if not exists extraction_handoffs_user_idx on public.extraction_handoffs(user_id);
create index if not exists opportunity_routes_user_idx on public.opportunity_routes(user_id);
create index if not exists opportunity_routes_contact_idx on public.opportunity_routes(contact_id);
create index if not exists opportunity_routes_conversation_idx on public.opportunity_routes(conversation_id);
create index if not exists evidence_facts_contact_idx on public.evidence_facts(contact_id, created_at desc);
create index if not exists evidence_facts_user_idx on public.evidence_facts(user_id);
create index if not exists evidence_facts_conversation_idx on public.evidence_facts(conversation_id);
create index if not exists evidence_facts_source_record_idx on public.evidence_facts(source_record_id);
create index if not exists source_records_contact_idx on public.source_records(contact_id, retrieved_at desc);
create index if not exists outcomes_user_created_idx on public.outcomes(user_id, created_at desc);
create index if not exists outcomes_contact_idx on public.outcomes(contact_id);
create index if not exists outcomes_recommendation_idx on public.outcomes(recommendation_id);
create index if not exists drafts_user_idx on public.drafts(user_id);
create index if not exists drafts_contact_idx on public.drafts(contact_id);
create index if not exists drafts_recommendation_idx on public.drafts(recommendation_id);

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
  end if;
end $$;
