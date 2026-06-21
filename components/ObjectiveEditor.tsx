"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Save } from "lucide-react";
import type { UserGoal, UserObjectiveProfile, UserRole } from "@/lib/types";

const roleOptions: UserRole[] = [
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

const goalOptions: UserGoal[] = [
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

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ObjectiveEditor({
  objective,
  title = "Setup",
  kicker = "Workspace setup",
  saveLabel = "Save setup",
  returnTo = "/today",
}: {
  objective: UserObjectiveProfile;
  title?: string;
  kicker?: string;
  saveLabel?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const primaryGoal = String(form.get("primaryGoal")) as UserGoal;
    const activeGoals = splitList(form.get("activeGoals")) as UserGoal[];

    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: objective.id,
          userId: objective.userId,
          role: String(form.get("role")) as UserRole,
          primaryGoal,
          activeGoals: activeGoals.length ? activeGoals : [primaryGoal],
          secondaryGoals: splitList(form.get("secondaryGoals")) as UserGoal[],
          eventContext: String(form.get("eventContext") ?? ""),
          companyName: String(form.get("companyName") ?? ""),
          companyStage: objective.companyStage,
          productDescription: String(form.get("productDescription") ?? ""),
          targetCustomer: String(form.get("targetCustomer") ?? ""),
          currentTraction: String(form.get("currentTraction") ?? ""),
          fundraisingStatus: objective.fundraisingStatus,
          hiringNeeds: splitList(form.get("hiringNeeds")),
          attentionBudgetToday: Number(form.get("attentionBudgetToday") ?? 5),
          preferredTone: objective.preferredTone,
          constraints: splitList(form.get("constraints")),
        }),
      });
      if (response.ok) {
        setSaved(true);
        router.refresh();
        router.push(returnTo);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="screen objective-screen">
      <div className="screen-kicker">{kicker}</div>
      <h1>{title}</h1>
      <form className="objective-form" onSubmit={submit}>
        <div className="objective-grid">
          <label>
            <span>Role</span>
            <select defaultValue={objective.role} name="role">
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {titleCase(role)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Primary goal</span>
            <select defaultValue={objective.primaryGoal} name="primaryGoal">
              {goalOptions.map((goal) => (
                <option key={goal} value={goal}>
                  {titleCase(goal)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Company</span>
            <input defaultValue={objective.companyName ?? ""} name="companyName" />
          </label>
          <label>
            <span>Event context</span>
            <input defaultValue={objective.eventContext ?? ""} name="eventContext" />
          </label>
          <label>
            <span>Attention budget</span>
            <input
              defaultValue={objective.attentionBudgetToday}
              min={1}
              name="attentionBudgetToday"
              type="number"
            />
          </label>
          <label>
            <span>Active goals</span>
            <input defaultValue={objective.activeGoals.join(", ")} name="activeGoals" />
          </label>
        </div>

        <label>
          <span>Product description</span>
          <textarea defaultValue={objective.productDescription ?? ""} name="productDescription" />
        </label>
        <label>
          <span>Target customer</span>
          <textarea defaultValue={objective.targetCustomer ?? ""} name="targetCustomer" />
        </label>
        <label>
          <span>Hiring needs</span>
          <textarea defaultValue={(objective.hiringNeeds ?? []).join("\n")} name="hiringNeeds" />
        </label>
        <label>
          <span>Constraints</span>
          <textarea defaultValue={objective.constraints.join("\n")} name="constraints" />
        </label>
        <input defaultValue={objective.secondaryGoals.join(", ")} name="secondaryGoals" type="hidden" />
        <input defaultValue={objective.currentTraction ?? ""} name="currentTraction" type="hidden" />

        <button className="primary-action objective-save" disabled={saving} type="submit">
          {saved ? <Check size={17} /> : <Save size={17} />}
          {saved ? "Saved" : saveLabel}
        </button>
      </form>
    </section>
  );
}
