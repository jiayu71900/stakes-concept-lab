export type ChallengeState =
  | "DRAFT"
  | "OPEN"
  | "MATCHED"
  | "ACTIVE"
  | "AWAITING_RESULT"
  | "SUCCESS"
  | "FAILED"
  | "AWAITING_SHIPMENT"
  | "SHIPPED"
  | "DEFAULTED";

export type LeaderboardType =
  | "highest_stakes"
  | "most_watched"
  | "most_interesting";

export interface User {
  id: string;
  handle: string;
  displayName: string;
  avatar: string;
  bio: string;
  unresolvedDefaults: number;
  historicalDefaults: number;
  defaultsReceived: number;
  refreshesRemaining: number;
}

export interface Stake {
  id: string;
  itemName: string;
  category: string;
  estimatedValue: number;
  condition: string;
  ownershipVerified: boolean;
  significance: string;
  accent: string;
  glyph: string;
}

export interface DefaultRecord {
  id: string;
  challengeId: string;
  debtorId: string;
  creditorId: string;
  marks: number;
  status: "UNRESOLVED" | "CLEANSED";
  createdAt: string;
}

export interface DefaultSettlement {
  debtorId: string;
  creditorId: string;
  debtorMarksAdded: number;
  creditorMarksBefore: number;
  creditorMarksAfter: number;
  cleanedMarks: number;
}

export interface LeaderboardPlacement {
  board: LeaderboardType;
  rank: number;
}

export interface Match {
  id: string;
  challengeId: string;
  creatorId: string;
  challengerId: string;
  selectedAt: string;
}

export interface ChallengeMessage {
  id: string;
  challengeId: string;
  authorId: string;
  day: number;
  body: string;
  kind: "CREATOR_UPDATE";
}

export interface Challenge {
  id: string;
  slug: string;
  creatorId: string;
  title: string;
  promise: string;
  proof: string[];
  deadlineLabel: string;
  durationDays: number;
  daysRemaining: number;
  stake: Stake;
  state: ChallengeState;
  entrantIds: string[];
  entrantCount: number;
  watchers: number;
  interestingScore: number;
  leaderboardPlacement?: LeaderboardPlacement;
  match?: Match;
}

export interface DiscoverySession {
  seenChallengeIds: string[];
  refreshesRemaining: number;
}

export interface DemoState {
  creator: User;
  viewer: User;
  featured: Challenge;
  discoveryIndex: number;
  joined: boolean;
  createdChallenge: boolean;
  defaultRecords: DefaultRecord[];
  lastDefaultSettlement?: DefaultSettlement;
  simulatedDay: number;
  messages: ChallengeMessage[];
  lastEvent:
    | "READY"
    | "CREATED"
    | "JOINED"
    | "MATCHED"
    | "ACTIVE"
    | "AWAITING_RESULT"
    | "SUCCESS"
    | "FAILED"
    | "SHIPPED"
    | "DEFAULTED"
    | "CLEANSED";
}
