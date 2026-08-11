import type { Challenge, DiscoverySession, User } from "../domain/models.js";

export interface DiscoveryResult {
  challenge: Challenge | null;
  session: DiscoverySession;
}

export interface DiscoveryOptions {
  includeOwn?: boolean;
}

export function discoverNext(
  challenges: Challenge[],
  viewer: User,
  session: DiscoverySession,
  random: () => number = Math.random,
  options: DiscoveryOptions = {},
): DiscoveryResult {
  if (session.refreshesRemaining <= 0) {
    return { challenge: null, session };
  }

  const eligible = challenges.filter(
    (challenge) =>
      challenge.state === "OPEN" &&
      (options.includeOwn || challenge.creatorId !== viewer.id) &&
      !session.seenChallengeIds.includes(challenge.id),
  );

  if (eligible.length === 0) {
    return { challenge: null, session };
  }

  const challenge = eligible[Math.min(eligible.length - 1, Math.floor(random() * eligible.length))];
  return {
    challenge,
    session: {
      seenChallengeIds: [...session.seenChallengeIds, challenge.id],
      refreshesRemaining: session.refreshesRemaining - 1,
    },
  };
}

export function canChallenge(challenge: Challenge, viewer: User) {
  return !challenge.ownedByCurrentVisitor && challenge.creatorId !== viewer.id;
}
