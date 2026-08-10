# STAKES.

> **What would you risk to finally do it?**

Finish the goal — keep your stuff.  
Fail — ship it to your challenger.  
Chicken out — everyone knows.

**Sounds simple. It gets weird quickly.**

STAKES. is a working concept for a social commitment network built around physical stakes. This repository is a deliberately small, interactive V0: mock data, real domain rules, no production backend.

## Try the 60-second story

The demo follows one complete vertical slice:

`Create → Discover → Challenge → Match → Fail → Default → Cleansing`

Start on **Discover**, enter Jiayu’s Steam Deck pact, simulate the challenger draw, jump to the deadline, choose **Default**, inspect the public mark, then simulate cleansing.

The five product surfaces are:

- **Discover** — seven random pulls; ordinary pacts cannot be searched.
- **Challenge Detail** — stake, deadline, and immutable proof contract.
- **Match** — one challenger is selected before the clock starts.
- **Outcome** — failure creates a direct-shipping window.
- **Profile** — defaults are visible and affect discovery, not participation.

A separate **Build With Us Lab** turns four open system problems into copyable contribution briefs. It is the project’s collaborator funnel, not a fictional team page.

## V0 rules frozen in this demo

- Ordinary pacts are discovered through limited random refreshes, never search.
- Three leaderboards exist: **Highest Stakes**, **Most Watched**, and **Most Interesting**.
- Any unresolved default removes all of a creator’s pacts from leaderboards.
- A default does **not** block creating, discovering, or challenging.
- Defaulting on a pact surfaced through **Highest Stakes** adds 10 marks; ordinary defaults add 1.
- If someone defaults on the person they were matched with, one unresolved mark is cleansed.
- The platform does not hold money or physical items in this concept.

## Architecture

```text
UI routes + components
        ↓
Domain objects
        ↓
Pure rule engines
        ↓
Mock scenario data / local demo state
```

The interface consumes engine results; it does not own ranking, default, discovery, or transition rules. A future API can replace the mock layer without changing product pages.

```text
domain/      Challenge, User, Stake, Default, Leaderboard, Discovery
engine/      state machine, discovery, defaults, leaderboards
mock/        concrete V0 story and fixture data
components/  interactive product experience
app/         five routable pages
mock/        deterministic stage presets for the clickable demo map
docs/        decisions, invariants, scenario, and open questions
```

Read [the architecture notes](docs/ARCHITECTURE.md), [domain spec](docs/DOMAIN.md), and [state machine](docs/STATE_MACHINE.md) before changing rules.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Validation:

```bash
npm test
npm run lint
```

## Intentionally not here

No accounts, payments, database, logistics API, proof verification, recommendation model, or production trust system. Those choices are not “missing features”; they are outside the Concept Demo boundary.

Questions that should not leak into V0 live in [Open Problems](docs/OPEN_PROBLEMS.md).

## Team

**Small human core. AI-augmented by default. Open to people who want to shape it with us.**

This is an independent, AI-native product lab—not a fictional roster. AI-assisted work covers systems exploration, rapid prototyping, research, UX experiments, and adversarial analysis. Human contributors are always represented as themselves.

See [CONTRIBUTING.md](CONTRIBUTING.md) for useful first contributions. The in-product Lab starts with bounded work on cleansing abuse, discovery fairness, interestingness ranking, and proof contracts.
