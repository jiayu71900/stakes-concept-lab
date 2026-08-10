# Contributing

STAKES. is an open, AI-native product lab for a social commitment system built around physical stakes. The demo is deliberately small; the system we are trying to understand is not.

## Start where you are

You do not need to apply for a role. Choose the conversation that matches what you noticed:

- [First impressions](https://github.com/jiayu71900/stakes-concept-lab/discussions/new?category=first-impressions) — identify the moment that changed your understanding of the product.
- [Break a rule](https://github.com/jiayu71900/stakes-concept-lab/discussions/new?category=break-a-rule) — describe a concrete abuse, collusion, or incentive failure.
- [Shape the system](https://github.com/jiayu71900/stakes-concept-lab/discussions/new?category=shape-the-system) — take an open edge toward durable product behavior, architecture, trust, operations, or community mechanics.

Start with something concrete. Continue where ownership makes sense. A useful first contribution can grow into stewardship of an entire product or system direction.

## Working boundaries

Before changing behavior, read `docs/DOMAIN.md` and `docs/STATE_MACHINE.md`.

- Keep transitions, ranking, discovery, and default rules inside `engine/`; do not duplicate them in components.
- Use the UI to reveal consequences, not to become a second rule engine.
- Pair rule changes with focused behavior tests and update the relevant domain note.
- Discuss production infrastructure before adding authentication, payments, persistence, logistics, or verification services.
- Use [the open-core boundary](docs/OPEN_CORE_BOUNDARY.md) to keep public contracts separate from private production authority.
- Preserve the Concept Demo as a playable vertical slice even when exploring a longer-lived architecture.

## Proposing and building

Use Discussions while the direction is still being shaped. Move to an issue when the outcome is concrete enough to scope. Open a pull request when there is reviewable evidence: a working change, architecture decision, adversarial model, product contract, or operating design.

Pull requests should explain the product consequence, the responsibility boundary, and how the risky behavior was verified.

## AI-native, without fictional people

AI assistance is welcome across research, architecture, implementation, design exploration, and red-team work. Describe material AI-assisted work honestly. Do not invent collaborators, user evidence, test results, or operational capabilities.
