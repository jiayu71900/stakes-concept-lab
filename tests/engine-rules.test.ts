import assert from "node:assert/strict";
import test from "node:test";
import type { Challenge, User } from "../domain/models.js";
import { advanceThrough, transitionChallenge } from "../engine/challengeStateMachine.js";
import { cleanseOneDefault, defaultMarksFor, recordDefault } from "../engine/defaultEngine.js";
import { discoverNext } from "../engine/discoveryEngine.js";
import { rankLeaderboard } from "../engine/leaderboardEngine.js";

function user(id: string, unresolvedDefaults = 0): User {
  return {
    id,
    handle: `@${id}`,
    displayName: id,
    avatar: id.slice(0, 2).toUpperCase(),
    bio: "",
    unresolvedDefaults,
    historicalDefaults: unresolvedDefaults,
    defaultsReceived: 0,
    refreshesRemaining: 7,
  };
}

function challenge(
  id: string,
  creatorId: string,
  estimatedValue: number,
  state: Challenge["state"] = "OPEN",
): Challenge {
  return {
    id,
    slug: id,
    creatorId,
    title: id,
    promise: id,
    proof: ["A timestamped result"],
    deadlineLabel: "Later",
    durationDays: 14,
    daysRemaining: 14,
    stake: {
      id: `stake-${id}`,
      itemName: id,
      category: "Test",
      estimatedValue,
      condition: "Good",
      ownershipVerified: true,
      significance: "Test fixture",
      accent: "#000000",
      glyph: "T",
    },
    state,
    entrantIds: [],
    entrantCount: 0,
    watchers: estimatedValue,
    interestingScore: estimatedValue,
  };
}

test("the challenge state machine allows the full default path and rejects shortcuts", () => {
  const draft = challenge("state-machine", "maker", 100, "DRAFT");
  const defaulted = advanceThrough(draft, [
    "OPEN",
    "MATCHED",
    "ACTIVE",
    "AWAITING_RESULT",
    "FAILED",
    "AWAITING_SHIPMENT",
    "DEFAULTED",
  ]);

  assert.equal(defaulted.state, "DEFAULTED");
  assert.throws(() => transitionChallenge(draft, "SUCCESS"), /Invalid challenge transition/);
});

test("highest-stakes defaults add ten marks while ordinary defaults add one", () => {
  const ordinary = challenge("ordinary", "maker", 100);
  const highest = {
    ...challenge("highest", "maker", 1000),
    leaderboardPlacement: { board: "highest_stakes", rank: 1 } as const,
  };
  const maker = user("maker");
  const challenger = user("challenger");

  assert.equal(defaultMarksFor(ordinary), 1);
  assert.equal(defaultMarksFor(highest), 10);
  const result = recordDefault(maker, challenger, highest);
  assert.equal(result.debtor.unresolvedDefaults, 10);
  assert.equal(result.debtor.historicalDefaults, 10);
  assert.equal(result.record.marks, 10);
  assert.equal(maker.unresolvedDefaults, 0, "recording must not mutate its input");
});

test("cleaning removes one unresolved mark without erasing history", () => {
  const marked = { ...user("marked", 10), historicalDefaults: 14 };
  const cleaned = cleanseOneDefault(marked);

  assert.equal(cleaned.unresolvedDefaults, 9);
  assert.equal(cleaned.historicalDefaults, 14);
  assert.equal(cleaned.defaultsReceived, 1);
  assert.equal(cleanseOneDefault(user("clear")).unresolvedDefaults, 0);
});

test("an unresolved default removes every pact by that maker from leaderboards", () => {
  const eligibleMaker = user("eligible");
  const markedMaker = user("marked", 1);
  const visible = challenge("visible", eligibleMaker.id, 400);
  const excluded = challenge("excluded", markedMaker.id, 2000);

  const ranked = rankLeaderboard(
    [excluded, visible],
    [eligibleMaker, markedMaker],
    "highest_stakes",
  );

  assert.deepEqual(ranked.map((entry) => entry.challenge.id), ["visible"]);
  assert.equal(ranked[0].placement.rank, 1);
});

test("random discovery excludes the viewer, closed pacts, and already-seen pacts", () => {
  const viewer = user("viewer");
  const eligible = challenge("eligible", "other", 100);
  const own = challenge("own", viewer.id, 200);
  const closed = challenge("closed", "other", 300, "SUCCESS");
  const seen = challenge("seen", "other", 400);

  const result = discoverNext(
    [own, closed, seen, eligible],
    viewer,
    { seenChallengeIds: [seen.id], refreshesRemaining: 2 },
    () => 0,
  );

  assert.equal(result.challenge?.id, eligible.id);
  assert.equal(result.session.refreshesRemaining, 1);
  assert.deepEqual(result.session.seenChallengeIds, [seen.id, eligible.id]);

  const exhausted = discoverNext(
    [eligible],
    viewer,
    { seenChallengeIds: [], refreshesRemaining: 0 },
    () => 0,
  );
  assert.equal(exhausted.challenge, null);
  assert.equal(exhausted.session.refreshesRemaining, 0);
});
