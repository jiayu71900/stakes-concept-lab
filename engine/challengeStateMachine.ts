import type { Challenge, ChallengeState } from "@/domain/models";

export const challengeTransitions: Record<ChallengeState, ChallengeState[]> = {
  DRAFT: ["OPEN"],
  OPEN: ["MATCHED"],
  MATCHED: ["ACTIVE"],
  ACTIVE: ["AWAITING_RESULT"],
  AWAITING_RESULT: ["SUCCESS", "FAILED"],
  SUCCESS: [],
  FAILED: ["AWAITING_SHIPMENT"],
  AWAITING_SHIPMENT: ["SHIPPED", "DEFAULTED"],
  SHIPPED: [],
  DEFAULTED: [],
};

export function canTransition(from: ChallengeState, to: ChallengeState) {
  return challengeTransitions[from].includes(to);
}

export function transitionChallenge(
  challenge: Challenge,
  nextState: ChallengeState,
): Challenge {
  if (!canTransition(challenge.state, nextState)) {
    throw new Error(`Invalid challenge transition: ${challenge.state} → ${nextState}`);
  }

  return { ...challenge, state: nextState };
}

export function advanceThrough(
  challenge: Challenge,
  states: ChallengeState[],
): Challenge {
  return states.reduce(transitionChallenge, challenge);
}
