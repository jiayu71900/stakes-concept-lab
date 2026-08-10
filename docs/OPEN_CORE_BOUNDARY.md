# Open-core boundary

BET I DO. uses two repository boundaries so the public project can remain useful
without turning production trust infrastructure into demo code.

## This public repository owns

- the playable Concept Demo and its mock story;
- shared product language and basic domain objects;
- visible state transitions and public V0 rules;
- mock discovery, leaderboard, default, and cleansing engines;
- documentation, adversarial questions, and community contribution paths.

Everything here should be understandable, runnable without private credentials,
and safe to discuss in public.

## The private production repository owns

- real accounts, authoritative data, and operational tooling;
- identity, evidence, proof, logistics, and dispute services;
- production ranking signals, abuse controls, and collusion detection;
- payments, fulfillment, commercial operations, and private system data.

Public Discussions may explore these problems. Their production implementation,
thresholds, data, and operating controls do not belong in this repository.

## The interface between them

The public UI may eventually consume a documented API or event contract. The
contract can be discussed openly; authority remains server-side in the private
system. Replacing mock data with that contract must not move production rules
back into UI components.

## Placement test for future work

Before adding a change, ask:

1. Does it help people experience, understand, test, or discuss a public rule?
   It probably belongs here.
2. Does it depend on real identities, money, evidence, private data, secret
   weights, enforcement, or operations? It belongs in the private repository.
3. Does it connect both sides? Keep the contract public and the authority
   private.

The public repository remains MIT licensed. Production services and private
repositories are not automatically covered by that license.
