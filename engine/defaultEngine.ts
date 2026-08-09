import type { Challenge, DefaultRecord, User } from "@/domain/models";

export function defaultMarksFor(challenge: Challenge) {
  return challenge.leaderboardPlacement?.board === "highest_stakes" ? 10 : 1;
}

export function recordDefault(
  debtor: User,
  creditor: User,
  challenge: Challenge,
): { debtor: User; record: DefaultRecord } {
  const marks = defaultMarksFor(challenge);

  return {
    debtor: {
      ...debtor,
      unresolvedDefaults: debtor.unresolvedDefaults + marks,
      historicalDefaults: debtor.historicalDefaults + marks,
    },
    record: {
      id: `default-${challenge.id}-${Date.now()}`,
      challengeId: challenge.id,
      debtorId: debtor.id,
      creditorId: creditor.id,
      marks,
      status: "UNRESOLVED",
      createdAt: new Date().toISOString(),
    },
  };
}

export function cleanseOneDefault(user: User): User {
  return {
    ...user,
    unresolvedDefaults: Math.max(0, user.unresolvedDefaults - 1),
    defaultsReceived: user.defaultsReceived + 1,
  };
}

export function isLeaderboardEligible(user: User) {
  return user.unresolvedDefaults === 0;
}
