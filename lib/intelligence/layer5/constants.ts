import type { RelationshipMoveAction } from "@/lib/types";

export const DEFAULT_ATTENTION_BUDGET = 3;

export const DAILY_PRIORITY_THRESHOLDS = {
  showInBrief: 0.2,
  highPriority: 0.75,
  mediumPriority: 0.45,
  lowPriority: 0.35
} as const;

export const ASK_SIZE_BY_ACTION: Record<RelationshipMoveAction, number> = {
  share_resource: 0.1,
  simple_followup: 0.2,
  ask_quick_opinion: 0.35,
  ask_for_feedback: 0.45,
  ask_for_intro: 0.6,
  ask_for_meeting: 0.7,
  ask_for_pilot: 0.8,
  ask_for_investment: 0.9,
  ask_for_job_or_hiring_loop: 0.85,
  make_intro: 0.5,
  confirm_details: 0.15,
  add_context: 0,
  wait: 0,
  snooze: 0,
  re_engage: 0.25,
  archive: 0,
  do_not_act: 0
};

export const USER_EFFORT_BY_ACTION: Record<RelationshipMoveAction, number> = {
  share_resource: 0.2,
  simple_followup: 0.2,
  ask_quick_opinion: 0.25,
  ask_for_feedback: 0.25,
  ask_for_intro: 0.5,
  ask_for_meeting: 0.45,
  ask_for_pilot: 0.35,
  ask_for_investment: 0.65,
  ask_for_job_or_hiring_loop: 0.5,
  make_intro: 0.5,
  confirm_details: 0.25,
  add_context: 0.25,
  wait: 0,
  snooze: 0,
  re_engage: 0.2,
  archive: 0.1,
  do_not_act: 0
};

export const ROUTE_ACTIONS = {
  raise: ["ask_for_investment", "simple_followup", "share_resource"],
  hire: ["ask_for_job_or_hiring_loop", "share_resource", "simple_followup"],
  user: ["simple_followup", "share_resource", "ask_for_feedback", "ask_for_pilot"],
  partner: ["simple_followup", "ask_for_meeting", "share_resource"],
  mentor: ["ask_quick_opinion", "simple_followup"],
  candidate: ["ask_for_job_or_hiring_loop", "share_resource"],
  customer: ["simple_followup", "ask_for_pilot", "ask_for_feedback"],
  sponsor: ["ask_for_meeting", "share_resource"],
  job: ["ask_quick_opinion", "simple_followup"],
  community: ["share_resource", "make_intro", "simple_followup"],
  other: ["simple_followup", "wait"]
} as const satisfies Record<string, readonly RelationshipMoveAction[]>;
