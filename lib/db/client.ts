import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Contact,
  Conversation,
  ConversationAtoms,
  EvidenceBundle,
  EvidenceFact,
  ExtractionHandoff,
  Id,
  PublicEntityContext,
  SourceRecord,
  User,
  UserObjectiveProfile
} from "@/lib/types";
import { demoObjective, demoUser } from "@/lib/demo/fixtures";

export interface ConversationAtomsRecord extends ConversationAtoms {
  id: Id;
  conversationId: Id;
  createdAt: string;
}

export interface LocalDatabase {
  users: User[];
  userObjectives: UserObjectiveProfile[];
  contacts: Contact[];
  conversations: Conversation[];
  conversationAtoms: ConversationAtomsRecord[];
  publicEntityContext: PublicEntityContext[];
  sourceRecords: SourceRecord[];
  evidenceFacts: EvidenceFact[];
  extractionHandoffs: ExtractionHandoff[];
  evidenceBundles: EvidenceBundle[];
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
    evidenceBundles: []
  };
}

function getDatabasePath(): string {
  const configuredPath = process.env.AFTERMEET_DB_PATH?.trim();
  return configuredPath || path.join(process.cwd(), ".local", "aftermeet-db.json");
}

async function ensureDatabaseFile(): Promise<void> {
  const dbPath = getDatabasePath();
  await mkdir(path.dirname(dbPath), { recursive: true });

  try {
    await readFile(dbPath, "utf8");
  } catch {
    await writeFile(dbPath, `${JSON.stringify(createInitialDatabase(), null, 2)}\n`, "utf8");
  }
}

export async function readDatabase(): Promise<LocalDatabase> {
  await ensureDatabaseFile();
  const db = JSON.parse(await readFile(getDatabasePath(), "utf8")) as Partial<LocalDatabase>;
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
    evidenceBundles: db.evidenceBundles ?? []
  };
}

export async function writeDatabase(db: LocalDatabase): Promise<void> {
  await mkdir(path.dirname(getDatabasePath()), { recursive: true });
  await writeFile(getDatabasePath(), `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

export async function updateDatabase<T>(mutate: (db: LocalDatabase) => T | Promise<T>): Promise<T> {
  const db = await readDatabase();
  const result = await mutate(db);
  await writeDatabase(db);
  return result;
}

export async function resetLocalDatabase(): Promise<void> {
  await writeDatabase(createInitialDatabase());
}
