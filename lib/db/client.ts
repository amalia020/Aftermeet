/**
 * In-memory data store (ADR-004). Single-tenant demo persistence with a shape
 * that maps 1:1 to the Postgres schema in the spec, so swapping to Supabase
 * later is a repository-level change, not a domain change.
 *
 * The store is a module-level singleton. In Next dev the module can be
 * re-evaluated on hot reload, so we stash it on globalThis to survive reloads.
 */

import type {
  ActionRecommendation,
  Contact,
  Conversation,
  ConversationAtoms,
  Draft,
  EvidenceFact,
  OpportunityRoute,
  Outcome,
  PublicEntityContext,
  SourceRecord,
  User,
  UserObjectiveProfile,
} from "@/lib/types";

export interface StoredConversationAtoms extends ConversationAtoms {
  id: string;
  conversationId: string;
  createdAt: string;
}

export interface Collections {
  users: Map<string, User>;
  userObjectives: Map<string, UserObjectiveProfile>;
  contacts: Map<string, Contact>;
  conversations: Map<string, Conversation>;
  conversationAtoms: Map<string, StoredConversationAtoms>;
  publicEntityContext: Map<string, PublicEntityContext>;
  sourceRecords: Map<string, SourceRecord>;
  evidenceFacts: Map<string, EvidenceFact>;
  opportunityRoutes: Map<string, OpportunityRoute>;
  actionRecommendations: Map<string, ActionRecommendation>;
  drafts: Map<string, Draft>;
  outcomes: Map<string, Outcome>;
}

export const DEMO_USER_ID = "user_demo";

function createCollections(): Collections {
  return {
    users: new Map(),
    userObjectives: new Map(),
    contacts: new Map(),
    conversations: new Map(),
    conversationAtoms: new Map(),
    publicEntityContext: new Map(),
    sourceRecords: new Map(),
    evidenceFacts: new Map(),
    opportunityRoutes: new Map(),
    actionRecommendations: new Map(),
    drafts: new Map(),
    outcomes: new Map(),
  };
}

interface StoreState {
  collections: Collections;
  seeded: boolean;
}

const globalRef = globalThis as unknown as {
  __aftermeetStore?: StoreState;
};

function getState(): StoreState {
  if (!globalRef.__aftermeetStore) {
    globalRef.__aftermeetStore = {
      collections: createCollections(),
      seeded: false,
    };
  }
  return globalRef.__aftermeetStore;
}

export function db(): Collections {
  const state = getState();
  if (!state.seeded) {
    seedDemoUser(state.collections);
    state.seeded = true;
  }
  return state.collections;
}

/** Wipe and re-seed. Backs /api/demo/reset. */
export function resetStore(): void {
  const state = getState();
  state.collections = createCollections();
  seedDemoUser(state.collections);
  state.seeded = true;
}

function seedDemoUser(collections: Collections): void {
  const now = "2026-06-20T09:00:00.000Z";
  collections.users.set(DEMO_USER_ID, {
    id: DEMO_USER_ID,
    name: "Demo Founder",
    email: "demo@aftermeet.app",
    createdAt: now,
  });
}
