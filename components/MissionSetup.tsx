"use client";

/**
 * MissionSetup (Part 4) — the Phase 2 objective form. Captures role, primary and
 * secondary goals, company, valuable people, attention budget, and tone, then
 * POSTs a UserObjectiveProfileInput to /api/objectives. Pre-fills from the active
 * objective when present.
 */

import { useState } from "react";
import type {
  MissionSetupViewModel,
  Tone,
  UserGoal,
  UserObjectiveProfileInput,
  UserRole,
} from "@/lib/types";
import { saveObjective, DEMO_USER_ID } from "@/lib/frontend/apiClient";
import { humanizeGoal } from "@/lib/frontend/viewModels";

const ROLES: UserRole[] = [
  "founder",
  "operator",
  "investor",
  "recruiter",
  "student",
  "job_seeker",
  "sponsor_bd",
  "sales",
  "community_builder",
  "other",
];

const GOALS: UserGoal[] = [
  "raise",
  "hire",
  "find_users",
  "find_design_partners",
  "find_mentors",
  "find_investments",
  "source_candidates",
  "find_customers",
  "find_partners",
  "find_job_opportunities",
  "build_community",
  "win_hackathon",
  "collect_wtp",
  "learn",
  "other",
];

const TONES: Tone[] = ["direct", "warm", "formal", "casual", "concise"];

export interface MissionSetupProps {
  viewModel: MissionSetupViewModel;
  onSaved?: (objective: UserObjectiveProfileInput) => void;
}

export function MissionSetup({ viewModel, onSaved }: MissionSetupProps) {
  const existing = viewModel.activeObjective;
  const [role, setRole] = useState<UserRole>(existing?.role ?? "founder");
  const [primaryGoal, setPrimaryGoal] = useState<UserGoal>(existing?.primaryGoal ?? "find_users");
  const [secondaryGoals, setSecondaryGoals] = useState<UserGoal[]>(existing?.secondaryGoals ?? []);
  const [companyName, setCompanyName] = useState(existing?.companyName ?? "");
  const [eventContext, setEventContext] = useState(existing?.eventContext ?? "");
  const [valuablePeople, setValuablePeople] = useState(existing?.targetCustomer ?? "");
  const [attentionBudget, setAttentionBudget] = useState(existing?.attentionBudgetToday ?? 5);
  const [preferredTone, setPreferredTone] = useState<Tone>(existing?.preferredTone ?? "warm");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "local">("idle");

  const toggleSecondary = (goal: UserGoal) => {
    setSecondaryGoals((cur) =>
      cur.includes(goal) ? cur.filter((g) => g !== goal) : [...cur, goal],
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const secondaries = secondaryGoals.filter((g) => g !== primaryGoal);
    const input: UserObjectiveProfileInput = {
      userId: DEMO_USER_ID,
      role,
      primaryGoal,
      secondaryGoals: secondaries,
      activeGoals: Array.from(new Set<UserGoal>([primaryGoal, ...secondaries])),
      eventContext: eventContext || null,
      companyName: companyName || null,
      companyStage: existing?.companyStage ?? null,
      productDescription: existing?.productDescription ?? null,
      targetCustomer: valuablePeople || null,
      currentTraction: existing?.currentTraction ?? null,
      fundraisingStatus: existing?.fundraisingStatus ?? null,
      hiringNeeds: existing?.hiringNeeds ?? [],
      attentionBudgetToday: attentionBudget,
      preferredTone,
      constraints: existing?.constraints ?? [],
    };

    const result = await saveObjective(input);
    setStatus(result.ok ? "saved" : "local");
    setSaving(false);
    onSaved?.(input);
  };

  const field =
    "w-full rounded-md border border-ink-line bg-ink px-3 py-2 text-sm text-cloud focus:border-signal-calm focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-cloud-dim";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ms-role" className={labelCls}>
            Your role
          </label>
          <select
            id="ms-role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={field}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ms-primary" className={labelCls}>
            Primary goal
          </label>
          <select
            id="ms-primary"
            value={primaryGoal}
            onChange={(e) => setPrimaryGoal(e.target.value as UserGoal)}
            className={field}
          >
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {humanizeGoal(g)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={labelCls}>Secondary goals</span>
        <div className="flex flex-wrap gap-2">
          {GOALS.filter((g) => g !== primaryGoal).map((g) => {
            const active = secondaryGoals.includes(g);
            return (
              <button
                type="button"
                key={g}
                onClick={() => toggleSecondary(g)}
                aria-pressed={active}
                className={[
                  "rounded-full border px-3 py-1 text-xs transition",
                  active
                    ? "border-signal-calm/50 bg-signal-calm/10 text-signal-calm"
                    : "border-ink-line text-cloud-dim hover:text-cloud",
                ].join(" ")}
              >
                {humanizeGoal(g)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ms-company" className={labelCls}>
            Company / project
          </label>
          <input
            id="ms-company"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={field}
            placeholder="AfterMeet"
          />
        </div>
        <div>
          <label htmlFor="ms-event" className={labelCls}>
            Event context
          </label>
          <input
            id="ms-event"
            value={eventContext}
            onChange={(e) => setEventContext(e.target.value)}
            className={field}
            placeholder="MEGATHON"
          />
        </div>
      </div>

      <div>
        <label htmlFor="ms-people" className={labelCls}>
          Who is most valuable to meet?
        </label>
        <input
          id="ms-people"
          value={valuablePeople}
          onChange={(e) => setValuablePeople(e.target.value)}
          className={field}
          placeholder="Founders and operators who attend many events per year."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ms-budget" className={labelCls}>
            Attention budget today: <span className="text-cloud">{attentionBudget}</span>
          </label>
          <input
            id="ms-budget"
            type="range"
            min={1}
            max={20}
            value={attentionBudget}
            onChange={(e) => setAttentionBudget(Number(e.target.value))}
            className="w-full accent-signal-calm"
          />
        </div>
        <div>
          <label htmlFor="ms-tone" className={labelCls}>
            Preferred tone
          </label>
          <select
            id="ms-tone"
            value={preferredTone}
            onChange={(e) => setPreferredTone(e.target.value as Tone)}
            className={field}
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-cloud px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white disabled:opacity-50"
        >
          {saving ? "Saving…" : existing ? "Update mission" : "Set mission"}
        </button>
        {status === "saved" ? (
          <span className="text-xs text-signal-go">Mission saved.</span>
        ) : null}
        {status === "local" ? (
          <span className="text-xs text-signal-warm">
            Saved locally for the demo (backend unavailable).
          </span>
        ) : null}
      </div>
    </form>
  );
}
