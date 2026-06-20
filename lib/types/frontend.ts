import type { CaptureType, ContactStatus, Id } from "./common";
import type { TractionSummary } from "./outcome";
import type { UserObjectiveProfile } from "./user";

export type ViewState = "ready" | "loading" | "empty" | "error";

export interface OpportunityTerminalViewModel {
  activeObjective: UserObjectiveProfile | null;
}

export interface CaptureScreenViewModel extends OpportunityTerminalViewModel {
  acceptableUseText: string;
  supportedCaptureTypes: CaptureType[];
  state: ViewState;
}

export interface PersonViewModel {
  contactId: Id;
  state: ViewState;
}

export interface FollowUpBoardColumn {
  id: string;
  title: string;
  status: ContactStatus;
  cardIds: Id[];
}

export interface FollowUpBoardViewModel {
  state: ViewState;
  columns: FollowUpBoardColumn[];
}

export interface TractionViewModel {
  state: ViewState;
  summary: TractionSummary;
}
