import type { Id, ISODateTime, NumericScore, OpportunityType } from "./common";

export type OutcomeType =
  | "sent"
  | "reply"
  | "booked"
  | "paid"
  | "wtp"
  | "ignored"
  | "snoozed"
  | "details_confirmed"
  | "marked_not_relevant"
  | "manual_override";

export interface Outcome {
  id: Id;
  userId: Id;
  contactId: Id;
  recommendationId?: Id | null;
  outcomeType: OutcomeType;
  notes?: string | null;
  value?: number | null;
  createdAt: ISODateTime;
}

export interface OutcomeSummary {
  opportunityType?: OpportunityType;
  outcomeType: OutcomeType;
  createdAt: ISODateTime;
  value?: number | null;
}

export interface TractionSummary {
  followUpsSent: number;
  repliesReceived: number;
  bookedMeetings: number;
  wtpSignals: number;
  paidCommits: number;
  replyRateByOpportunityType: Partial<Record<OpportunityType, NumericScore>>;
  actionsCompleted: number;
  contactsArchivedOrIgnored: number;
}
