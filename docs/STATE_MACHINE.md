# Challenge State Machine

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> OPEN
  OPEN --> MATCHED
  MATCHED --> ACTIVE
  ACTIVE --> AWAITING_RESULT
  AWAITING_RESULT --> SUCCESS
  AWAITING_RESULT --> FAILED
  FAILED --> AWAITING_SHIPMENT
  AWAITING_SHIPMENT --> SHIPPED
  AWAITING_SHIPMENT --> DEFAULTED
  SUCCESS --> [*]
  SHIPPED --> [*]
  DEFAULTED --> [*]
```

The transition table in `engine/challengeStateMachine.ts` is the source of truth. Invalid transitions throw; the interface advances only through engine calls.

Leaderboards never appear in this graph. They are a discoverability concern, calculated from challenge metrics and creator eligibility.

## Demo path

```text
OPEN → MATCHED → ACTIVE → AWAITING_RESULT
     → FAILED → AWAITING_SHIPMENT → DEFAULTED
```

The shipped branch is interactive so reviewers can compare outcomes, but the default branch carries the main V0 story.
