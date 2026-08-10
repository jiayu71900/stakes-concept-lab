# V0 Domain Spec

This is the smallest rule set required by the Concept Demo. It is descriptive, not a production data schema.

## Objects

### User

Owns identity and public trust counters: `unresolvedDefaults`, `historicalDefaults`, `defaultsReceived`, and daily discovery refreshes.

Invariant: `unresolvedDefaults > 0` changes leaderboard eligibility only. It never disables creating, challenging, or discovering.

### Stake

A physical item with an estimated value, condition, category, verification flag, and personal significance. Highest Stakes ranks from `estimatedValue`; the UI never calculates stake rank.

### Challenge

The maker’s goal contract: promise, chosen duration, deadline, proof checklist, stake, creator, entrants, watchers, interesting score, state, and optional leaderboard placement or match.

Invariant: leaderboard placement is an attribute, not a challenge state.

### Match

Connects one maker and one selected challenger before the active period starts.

### Default

An immutable ledger event linking debtor, creditor, challenge, mark count, and resolution status. Ordinary default: `+1`. Highest Stakes default: `+10`.

### Leaderboard

One of `highest_stakes`, `most_watched`, or `most_interesting`. All boards share the same eligibility gate: the creator must have zero unresolved defaults.

### Discovery

A session-level record of seen challenges and remaining pulls. Ordinary discovery filters open, non-owned, unseen challenges and returns one at random. Search is intentionally absent.

### Challenge Message

A maker-authored room update tied to a challenge and simulated day.

Invariant: a maker may create at most one message for a challenge on a given day. Advancing the simulation reveals messages whose day has arrived; future updates remain hidden.

## V0 cleansing

When another maker defaults on a user who is their selected challenger:

```text
unresolvedDefaults = max(0, unresolvedDefaults - 1)
defaultsReceived += 1
```

Value matching, collusion resistance, and multi-mark cleansing are open questions—not hidden rules.
