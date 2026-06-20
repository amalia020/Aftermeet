import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  ActionRecommendation,
  Contact,
  Conversation,
  ConversationAtoms,
  Draft,
  EvidenceBundle,
  EvidenceFact,
  ExtractionHandoff,
  OpportunityRoute,
  Outcome,
  PublicEntityContext,
  SourceRecord,
  User,
  UserObjectiveProfile,
} from "@/lib/types";
import { demoObjective, demoUser } from "@/lib/demo/fixtures";

export interface StoredConversationAtoms extends ConversationAtoms {
  id: string;
  conversationId: string;
  createdAt: string;
}

export type ConversationAtomsRecord = StoredConversationAtoms;

export interface LocalDatabase {
  users: User[];
  userObjectives: UserObjectiveProfile[];
  contacts: Contact[];
  conversations: Conversation[];
  conversationAtoms: StoredConversationAtoms[];
  publicEntityContext: PublicEntityContext[];
  sourceRecords: SourceRecord[];
  evidenceFacts: EvidenceFact[];
  extractionHandoffs: ExtractionHandoff[];
  evidenceBundles: EvidenceBundle[];
  opportunityRoutes: OpportunityRoute[];
  actionRecommendations: ActionRecommendation[];
  drafts: Draft[];
  outcomes: Outcome[];
}

function createInitialDatabase(): LocalDatabase {
  return {
    users: [demoUser],
    userObjectives: [demoObjective],
    contacts: [],
    conversations: [],
    conversationAtoms: [],
    publicEntityContext: [],
    sourceRecords: [],
    evidenceFacts: [],
    extractionHandoffs: [],
    evidenceBundles: [],
    opportunityRoutes: [],
    actionRecommendations: [],
    drafts: [],
    outcomes: [],
  };
}

function getDatabasePath(): string {
  const configuredPath = process.env.AFTERMEET_DB_PATH?.trim();
  return configuredPath || path.join(process.cwd(), ".local", "aftermeet-db.json");
}

function ensureDatabaseFile(): void {
  const dbPath = getDatabasePath();
  mkdirSync(path.dirname(dbPath), { recursive: true });

  try {
    readFileSync(dbPath, "utf8");
  } catch {
    writeFileSync(dbPath, `${JSON.stringify(createInitialDatabase(), null, 2)}\n`, "utf8");
  }
}

export function readDatabase(): LocalDatabase {
  ensureDatabaseFile();
  const db = JSON.parse(readFileSync(getDatabasePath(), "utf8")) as Partial<LocalDatabase>;
  return {
    ...createInitialDatabase(),
    ...db,
    users: db.users ?? [],
    userObjectives: db.userObjectives ?? [],
    contacts: db.contacts ?? [],
    conversations: db.conversations ?? [],
    conversationAtoms: db.conversationAtoms ?? [],
    publicEntityContext: db.publicEntityContext ?? [],
    sourceRecords: db.sourceRecords ?? [],
    evidenceFacts: db.evidenceFacts ?? [],
    extractionHandoffs: db.extractionHandoffs ?? [],
    evidenceBundles: db.evidenceBundles ?? [],
    opportunityRoutes: db.opportunityRoutes ?? [],
    actionRecommendations: db.actionRecommendations ?? [],
    drafts: db.drafts ?? [],
    outcomes: db.outcomes ?? [],
  };
}

export function writeDatabase(db: LocalDatabase): void {
  mkdirSync(path.dirname(getDatabasePath()), { recursive: true });
  writeFileSync(getDatabasePath(), `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

export function updateDatabase<T>(mutate: (db: LocalDatabase) => T): T {
  const db = readDatabase();
  const result = mutate(db);
  writeDatabase(db);
  return result;
}

export function resetLocalDatabase(): void {
  writeDatabase(createInitialDatabase());
}

export const resetStore = resetLocalDatabase;
