import type { Challenge, DiscoverySession, User } from "../domain/models.js";

export interface DiscoveryResult {
  challenge: Challenge | null;
  session: DiscoverySession;
}

export function discoverNext(
  challenges: Challenge[],
  viewer: User,
  session: DiscoverySession,
  random: () => number = Math.random,
): DiscoveryResult {
  if (session.refreshesRemaining <= 0) {
    return { challenge: null, session };
  }

  const eligible = challenges.filter(
    (challenge) =>
      challenge.state === "OPEN" &&
      challenge.creatorId !== viewer.id &&
      !session.seenChallengeIds.includes(challenge.id),
  );

  if (eligible.length === 0) {
    return { challenge: null, session };
  }

  const challenge = eligible[Math.floor(random() * eligible.length)];
  return {
    challenge,
    session: {
      seenChallengeIds: [...session.seenChallengeIds, challenge.id],
      refreshesRemaining: session.refreshesRemaining - 1,
    },
  };
}

export function deterministicDiscovery(
  challenges: Challenge[],
  currentIndex: number,
  refreshesRemaining: number,
) {
  if (refreshesRemaining <= 0) {
    return { index: currentIndex, refreshesRemaining };
  }

  return {
    index: (currentIndex + 1) % challenges.length,
    refreshesRemaining: refreshesRemaining - 1,
  };
}
