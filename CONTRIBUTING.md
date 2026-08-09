# Contributing

STAKES. is an open, AI-native product experiment. Useful contributions make one rule clearer, one engine safer, or one interaction easier to understand.

Good first areas:

- focused tests for invalid state transitions;
- deterministic discovery simulations;
- leaderboard eligibility edge cases;
- adversarial scenarios for default cleansing;
- accessibility and small-screen interaction reviews;
- concise write-ups for an item, trust, or verification open problem.

Before changing behavior, read `docs/DOMAIN.md` and `docs/STATE_MACHINE.md`. Keep rules inside `engine/`; do not duplicate them in components.

Open an issue before adding production infrastructure. The current project boundary deliberately excludes authentication, payments, databases, logistics, and verification services.

AI assistance is welcome. Please describe material AI-assisted work honestly; do not invent collaborators, user evidence, test results, or operational capabilities.
