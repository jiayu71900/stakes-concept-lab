# BET I DO.

> **Put something real on your word.**

Say what you will do. Put up something you care about. Let someone take the
other side.

Finish — keep it.

Fail — ship it to your challenger.

Refuse to pay up — keep playing, but carry the mark.

**BET I DO.** is a playable public foundation for a social betting game about
promises people make about themselves. The current repository contains the
interactive product surface, durable domain language, real rule engines, mock
scenario data, and the community layer. Production authority can replace the
mock layer later without rewriting the experience.

**[Play BET I DO.](https://stakes-concept-lab.jiayu71900.chatgpt.site)** · **[Join the Discussions](https://github.com/jiayu71900/stakes-concept-lab/discussions)**

## Play the whole bet

The experience follows one complete path:

`Create → Discover → Take the other side → Match → Run the clock → Fail → Pay up or default → Continue marked`

Start on **Discover**, meet Jiayu’s Steam Deck bet through a random pull, enter
the draw, and open the live Challenge Room. Move the clock one day or one week
at a time, reveal realistically spaced maker updates, leave one update for the
current day, and choose an outcome when the deadline arrives.

The five core surfaces are:

- **Discover** — seven random, non-sequential pulls; ordinary bets cannot be searched.
- **Bet Detail** — physical stake, deadline, and immutable proof contract.
- **Match / Challenge Room** — one challenger is selected, then the visitor controls a variable-length clock and daily maker log.
- **Outcome** — failure opens a direct-shipping window.
- **Profile** — defaults remain visible without banning the person; the visitor can publish again as the marked identity.

Visitors can also choose to let a challenge travel beyond their session. With
explicit opt-in, its promise, duration, stake label, and room updates enter an
anonymous visitor archive and may appear in future visitors’ random Discover
pulls immediately. A visitor may rediscover their own archived bet and read its
room history, but cannot challenge it. Declining keeps the challenge in the
current browser session only. The archive does not collect real names, contact
details, addresses, payment, or shipping information.

A visitor chooses one display name the first time they publish or challenge.
That name remains attached to every later action. After an outcome, publishing
and challenging continue under that visitor's own name, with actions labelled
as a marked or unmarked user. A default carries its unresolved marks forward;
paying up leaves the visitor unmarked. The interface never asks the visitor to
roleplay another creator, choose a second identity, or rename themselves. If a
marked visitor later receives a default as the selected challenger, one
unresolved mark is removed and the updated count continues with that identity.

The separate **Build With Us Lab** turns unresolved system questions into
contribution paths. It is the collaborator funnel, not a fictional team page.

## Enter through a real question

This is not a job board, and contributions are not limited to isolated starter
tasks.

- **[First impressions](https://github.com/jiayu71900/stakes-concept-lab/discussions/new?category=first-impressions)** — tell us which moment changed your understanding of the product.
- **[Break a rule](https://github.com/jiayu71900/stakes-concept-lab/discussions/new?category=break-a-rule)** — expose a concrete abuse, collusion, or incentive failure.
- **[Shape the system](https://github.com/jiayu71900/stakes-concept-lab/discussions/new?category=shape-the-system)** — take an open edge toward durable product behavior, architecture, trust, operations, or community mechanics.

Start with something concrete. Continue where ownership makes sense. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the working boundaries.

## Public rules in this experience

- Ordinary bets are discovered through limited random pulls, never search.
- Bet duration is chosen at creation time: 7, 14, 21, 30, or 60 days.
- A maker may post throughout the full challenge, with at most one Challenge Room update per day and no overall message limit. Silence is allowed.
- Each challenger may leave one named message on any chosen challenge day. It becomes part of the shared room history for future challengers.
- Three leaderboards exist: **Highest Stakes**, **Most Watched**, and **Most Interesting**.
- Any unresolved default removes all of a creator’s bets from leaderboards.
- A default does **not** block creating, discovering, or challenging.
- Defaulting on a bet surfaced through **Highest Stakes** adds 10 marks; ordinary defaults add 1.
- If a later maker defaults on this user while this user is the selected challenger, one unresolved mark is cleaned. Historical defaults remain visible.
- The platform does not hold money or physical items in this public experience.

## Architecture

```text
UI routes + components
        → Domain objects
        → Pure rule engines
        → Mock scenarios / local state / opt-in visitor archive
```

The interface consumes engine results; it does not own ranking, default,
discovery, or transition rules. A future API can replace the mock layer without
changing product pages.

```text
domain/      Challenge, User, Stake, Default, Leaderboard, Discovery
engine/      state machine, discovery, defaults, leaderboards
mock/        concrete story and fixture data
db/          anonymous visitor archive schema and repository
worker/      bounded archive endpoints beside the rendered experience
components/  interactive product experience
app/         five routable pages plus the collaboration lab
docs/        decisions, invariants, scenario, and open questions
```

Read [the architecture notes](docs/ARCHITECTURE.md),
[domain spec](docs/DOMAIN.md), and [state machine](docs/STATE_MACHINE.md) before
changing rules.

## Open product surface, private production core

This repository stays public as the playable product surface: the experience,
basic domain language, visible rules, mock engines, documentation, and
community collaboration.

Real accounts and data, production ranking and abuse controls, verification,
payments, fulfillment, disputes, and commercial operations belong in a
separate private production repository. Public conversations may shape those
boundaries; their operational implementation does not live here.

Read [the open-core boundary](docs/OPEN_CORE_BOUNDARY.md) before proposing work
that touches identity, trust, ranking, payments, or operations.

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

## Intentionally outside the public repository

Accounts, payments, production data, logistics integrations, proof authority,
recommendation weights, and operational trust controls remain outside this
repository. Questions at that boundary live in
[Open Problems](docs/OPEN_PROBLEMS.md).

## Team

**Small human core. AI-augmented by default. Open to people who want to shape it with us.**

BET I DO. is an independent, AI-native product lab—not a fictional roster.
AI-assisted work covers systems exploration, rapid prototyping, research, UX
experiments, and adversarial analysis. Human contributors are always
represented as themselves.

See [CONTRIBUTING.md](CONTRIBUTING.md) for useful entry points. The in-product
Lab starts with cleansing abuse, discovery fairness, interestingness ranking,
and proof contracts.
