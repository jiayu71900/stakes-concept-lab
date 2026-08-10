import type { DemoState } from "@/domain/models";
import { advanceThrough, transitionChallenge } from "@/engine/challengeStateMachine";
import { cleanseOneDefault, recordDefault } from "@/engine/defaultEngine";
import { createInitialDemoState } from "./demoData";

function matchedScenario(): DemoState {
  const state = createInitialDemoState();
  const featured = transitionChallenge(state.featured, "MATCHED");
  return {
    ...state,
    joined: true,
    featured: {
      ...featured,
      match: {
        id: `match-${featured.id}`,
        challengeId: featured.id,
        creatorId: state.creator.id,
        challengerId: state.viewer.id,
        selectedAt: "2026-08-09T12:00:00.000Z",
      },
    },
    lastEvent: "MATCHED",
  };
}

function failedScenario(): DemoState {
  const state = matchedScenario();
  return {
    ...state,
    featured: advanceThrough(state.featured, [
      "ACTIVE",
      "AWAITING_RESULT",
      "FAILED",
      "AWAITING_SHIPMENT",
    ]),
    lastEvent: "FAILED",
  };
}

function defaultedScenario(): DemoState {
  const state = failedScenario();
  const result = recordDefault(state.creator, state.viewer, state.featured);
  return {
    ...state,
    creator: result.debtor,
    featured: transitionChallenge(state.featured, "DEFAULTED"),
    defaultRecords: [result.record],
    lastEvent: "DEFAULTED",
  };
}

export function scenarioAt(stage: number): DemoState {
  if (stage <= 1) return createInitialDemoState();
  if (stage === 2) return createInitialDemoState();
  if (stage === 3) return matchedScenario();
  if (stage === 4) return failedScenario();
  if (stage === 5) return defaultedScenario();

  const state = defaultedScenario();
  return {
    ...state,
    creator: cleanseOneDefault(state.creator),
    defaultRecords: state.defaultRecords.map((record) => ({ ...record, status: "CLEANSED" })),
    lastEvent: "CLEANSED",
  };
}
