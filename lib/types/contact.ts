import type { Id, ISODateTime, NumericScore } from "./common";

export type ContactSourceType = "voice" | "card" | "manual" | "import";

export interface Contact {
  id: Id;
  userId: Id;
  name?: string | null;
  role?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  sourceType: ContactSourceType;
  entityMatchConfidence: NumericScore;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ContactCandidate {
  name?: string | null;
  role?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
}

export interface ContactSummary {
  id: Id;
  name?: string | null;
  company?: string | null;
  role?: string | null;
  status: string;
  lastRelevantActionAt?: ISODateTime | null;
}
