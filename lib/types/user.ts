import type { Id, ISODateTime } from "./common";

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

export type Tone = "direct" | "warm" | "formal" | "casual" | "concise";

export interface User {
  id: Id;
  name?: string | null;
  email?: string | null;
  createdAt: ISODateTime;
}

export interface UserObjectiveProfile {
  id: Id;
  userId: Id;
  role: UserRole;
  activeGoals: UserGoal[];
  primaryGoal: UserGoal;
  secondaryGoals: UserGoal[];
  eventContext?: string | null;
  companyName?: string | null;
  companyStage?: string | null;
  productDescription?: string | null;
  targetCustomer?: string | null;
  currentTraction?: string | null;
  fundraisingStatus?: string | null;
  hiringNeeds?: string[];
  attentionBudgetToday: number;
  preferredTone: Tone;
  constraints: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type UserObjectiveProfileInput = Omit<
  UserObjectiveProfile,
  "id" | "createdAt" | "updatedAt"
>;
