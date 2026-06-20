create extension if not exists pgcrypto;

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

create table if not exists public.evidence_bundles (
  id text primary key default ('bundle_' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id text references public.contacts(id) on delete cascade,
  conversation_id text references public.conversations(id) on delete cascade,
  request_id text not null,
  payload jsonb not null,
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
alter table public.evidence_bundles enable row level security;
alter table public.action_recommendations enable row level security;
alter table public.drafts enable row level security;
alter table public.outcomes enable row level security;

create policy "own objectives" on public.user_objectives for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own contacts" on public.contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own conversations" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own evidence bundles" on public.evidence_bundles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recommendations" on public.action_recommendations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own drafts" on public.drafts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own outcomes" on public.outcomes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
