"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Challenge, DemoState, LeaderboardType } from "@/domain/models";
import { challenges, createInitialDemoState, creators } from "@/mock/demoData";
import { deterministicDiscovery } from "@/engine/discoveryEngine";
import { advanceThrough, transitionChallenge } from "@/engine/challengeStateMachine";
import { cleanseOneDefault, isLeaderboardEligible, recordDefault } from "@/engine/defaultEngine";
import { rankLeaderboard } from "@/engine/leaderboardEngine";

type DemoView = "discover" | "challenge" | "match" | "outcome" | "profile";
const STORAGE_KEY = "stakes-concept-demo-v1";

const routes: Record<DemoView, string> = {
  discover: "/",
  challenge: "/challenge",
  match: "/match",
  outcome: "/outcome",
  profile: "/profile",
};

const boardLabels: Record<LeaderboardType, string> = {
  highest_stakes: "Highest stakes",
  most_watched: "Most watched",
  most_interesting: "Most interesting",
};

const journey = ["Create", "Discover", "Challenge", "Match", "Fail", "Default", "Cleansing"];

function pathToView(pathname: string): DemoView {
  if (pathname.startsWith("/challenge")) return "challenge";
  if (pathname.startsWith("/match")) return "match";
  if (pathname.startsWith("/outcome")) return "outcome";
  if (pathname.startsWith("/profile")) return "profile";
  return "discover";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function creatorFor(challenge: Challenge) {
  return creators.find((creator) => creator.id === challenge.creatorId) ?? creators[0];
}

export function DemoApp({ initialView }: { initialView: DemoView }) {
  const [view, setView] = useState<DemoView>(initialView);
  const [state, setState] = useState<DemoState>(createInitialDemoState);
  const [hydrated, setHydrated] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setState(JSON.parse(saved) as DemoState);
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setView(pathToView(window.location.pathname));
      setHydrated(true);
    });
    const onPopState = () => setView(pathToView(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const navigate = (next: DemoView) => {
    window.history.pushState({}, "", routes[next]);
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const currentDiscovery = challenges[state.discoveryIndex] ?? challenges[0];
  const leaderboards = useMemo(() => {
    const allUsers = creators.map((creator) => creator.id === state.creator.id ? state.creator : creator);
    return (["highest_stakes", "most_watched", "most_interesting"] as const).map((board) => ({
      board,
      entries: rankLeaderboard(challenges, allUsers, board).slice(0, 3),
    }));
  }, [state.creator]);

  const openChallenge = (challenge: Challenge) => {
    setState((current) => ({
      ...current,
      featured: structuredClone(challenge),
      creator: { ...creatorFor(challenge) },
      joined: false,
      lastEvent: current.lastEvent === "CREATED" ? "CREATED" : "READY",
    }));
    navigate("challenge");
  };

  const refreshDiscovery = () => {
    setState((current) => {
      const next = deterministicDiscovery(challenges, current.discoveryIndex, current.viewer.refreshesRemaining);
      return {
        ...current,
        discoveryIndex: next.index,
        viewer: { ...current.viewer, refreshesRemaining: next.refreshesRemaining },
      };
    });
  };

  const createChallenge = () => {
    const draft: Challenge = {
      ...structuredClone(challenges[0]),
      id: "your-first-pact",
      slug: "your-first-pact",
      creatorId: state.viewer.id,
      title: "Publish my first public build",
      state: "DRAFT",
      entrantCount: 0,
      watchers: 0,
    };
    transitionChallenge(draft, "OPEN");
    setState((current) => ({ ...current, createdChallenge: true, lastEvent: "CREATED" }));
    setCreateOpen(false);
  };

  const joinChallenge = () => {
    if (state.featured.state !== "OPEN") return;
    setState((current) => ({
      ...current,
      joined: true,
      featured: {
        ...current.featured,
        entrantCount: current.featured.entrantCount + 1,
        entrantIds: [...current.featured.entrantIds, current.viewer.id],
      },
      lastEvent: "JOINED",
    }));
  };

  const simulateSelection = () => {
    setState((current) => {
      const matched = transitionChallenge(current.featured, "MATCHED");
      return {
        ...current,
        featured: {
          ...matched,
          match: {
            id: `match-${matched.id}`,
            challengeId: matched.id,
            creatorId: current.creator.id,
            challengerId: current.viewer.id,
            selectedAt: new Date().toISOString(),
          },
        },
        lastEvent: "MATCHED",
      };
    });
    navigate("match");
  };

  const fastForward = () => {
    setState((current) => ({
      ...current,
      featured: advanceThrough(current.featured, ["ACTIVE", "AWAITING_RESULT", "FAILED", "AWAITING_SHIPMENT"]),
      lastEvent: "FAILED",
    }));
    navigate("outcome");
  };

  const simulateShipment = () => {
    if (state.featured.state !== "AWAITING_SHIPMENT") return;
    setState((current) => ({
      ...current,
      featured: transitionChallenge(current.featured, "SHIPPED"),
      lastEvent: "SHIPPED",
    }));
  };

  const simulateDefault = () => {
    if (state.featured.state !== "AWAITING_SHIPMENT") return;
    setState((current) => {
      const result = recordDefault(current.creator, current.viewer, current.featured);
      return {
        ...current,
        creator: result.debtor,
        featured: transitionChallenge(current.featured, "DEFAULTED"),
        defaultRecords: [...current.defaultRecords, result.record],
        lastEvent: "DEFAULTED",
      };
    });
  };

  const cleanseDefault = () => {
    if (state.creator.unresolvedDefaults <= 0) return;
    setState((current) => ({
      ...current,
      creator: cleanseOneDefault(current.creator),
      defaultRecords: current.defaultRecords.map((record, index) => index === current.defaultRecords.length - 1 ? { ...record, status: "CLEANSED" as const } : record),
      lastEvent: "CLEANSED",
    }));
  };

  const resetDemo = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(createInitialDemoState());
    navigate("discover");
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => navigate("discover")} aria-label="Go to Discover">STAKES<span>.</span></button>
        <nav className="nav-links" aria-label="Primary navigation">
          <button className={view === "discover" ? "active" : ""} onClick={() => navigate("discover")}>Discover</button>
          <button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}>Profile</button>
          <button className="make-button" onClick={() => setCreateOpen(true)}>+ Make a pact</button>
        </nav>
      </header>

      <section className="story-rail" aria-label="Demo story progress">
        <div className="rail-label">60-sec demo</div>
        <div className="rail-steps">
          {journey.map((step, index) => (
            <div className={`rail-step ${journeyStatus(state, index)}`} key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>{step}
            </div>
          ))}
        </div>
        <button className="reset-button" onClick={resetDemo}>Reset</button>
      </section>

      {state.createdChallenge && view === "discover" && (
        <div className="event-toast" role="status"><span>NEW PACT OPEN</span>“Publish my first public build” is now in the random pool.</div>
      )}

      {view === "discover" && (
        <DiscoverPage challenge={currentDiscovery} refreshes={state.viewer.refreshesRemaining} leaderboards={leaderboards} onRefresh={refreshDiscovery} onOpen={openChallenge} />
      )}
      {view === "challenge" && (
        <ChallengePage challenge={state.featured} creatorName={state.creator.displayName} joined={state.joined} onJoin={joinChallenge} onSelect={simulateSelection} />
      )}
      {view === "match" && <MatchPage state={state} onFastForward={fastForward} />}
      {view === "outcome" && <OutcomePage state={state} onDefault={simulateDefault} onShip={simulateShipment} onProfile={() => navigate("profile")} />}
      {view === "profile" && <ProfilePage state={state} onCleanse={cleanseDefault} onContinue={() => navigate("discover")} />}

      <footer className="footer">
        <div><strong>Small human core. AI-augmented by default.</strong><span>Built in the open with people who enjoy weird systems.</span></div>
        <a href="https://github.com" target="_blank" rel="noreferrer">GitHub ↗</a>
      </footer>

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onCreate={createChallenge} />}
    </main>
  );
}

function journeyStatus(state: DemoState, index: number) {
  const progress: Record<DemoState["lastEvent"], number> = { READY: 1, CREATED: 1, JOINED: 2, MATCHED: 3, FAILED: 4, SHIPPED: 4, DEFAULTED: 5, CLEANSED: 6 };
  if (index < progress[state.lastEvent]) return "done";
  if (index === progress[state.lastEvent]) return "current";
  return "";
}

function StakeObject({ challenge, compact = false }: { challenge: Challenge; compact?: boolean }) {
  return (
    <div className={`stake-object ${compact ? "compact" : ""}`} style={{ "--stake-accent": challenge.stake.accent } as CSSProperties}>
      <div className="stake-glyph">{challenge.stake.glyph}</div>
      <div><span>PHYSICAL STAKE</span><strong>{challenge.stake.itemName}</strong><small>{money(challenge.stake.estimatedValue)} estimated · {challenge.stake.condition}</small></div>
    </div>
  );
}

function DiscoverPage({ challenge, refreshes, leaderboards, onRefresh, onOpen }: {
  challenge: Challenge;
  refreshes: number;
  leaderboards: { board: LeaderboardType; entries: ReturnType<typeof rankLeaderboard> }[];
  onRefresh: () => void;
  onOpen: (challenge: Challenge) => void;
}) {
  const creator = creatorFor(challenge);
  const highStakes = challenge.leaderboardPlacement?.board === "highest_stakes";
  return (
    <div className="page-wrap discover-page">
      <section className="discover-intro">
        <p className="eyebrow">RANDOM DISCOVERY · NO SEARCH</p>
        <h1>What would you risk<br />to finally do it?</h1>
        <p>Ordinary pacts only appear by chance. Seven pulls a day. Make them count.</p>
      </section>
      <section className="discover-grid">
        <article className="challenge-card">
          <div className="card-topline">
            <div className="creator-chip"><span>{creator.avatar}</span>{creator.handle}</div>
            <div className="timer"><i /> {challenge.daysRemaining} days left</div>
          </div>
          <div className="card-copy"><p>I WILL</p><h2>{challenge.title}.</h2><p className="promise">{challenge.promise}</p></div>
          <StakeObject challenge={challenge} />
          {challenge.leaderboardPlacement && (
            <div className={`leaderboard-callout ${highStakes ? "danger" : ""}`}>
              <span>{highStakes ? "×10" : `#${challenge.leaderboardPlacement.rank}`}</span>
              <div><strong>{boardLabels[challenge.leaderboardPlacement.board]}</strong><small>{highStakes ? "Defaulting here costs 10 marks." : "Leaderboard discovery is earned, not searched."}</small></div>
            </div>
          )}
          <div className="card-actions">
            <button className="primary-action" onClick={() => onOpen(challenge)}>Challenge {creator.displayName} <span>↗</span></button>
            <button className="shuffle-button" onClick={onRefresh} disabled={refreshes === 0} aria-label="Show another random pact"><span>↻</span> Next random pact</button>
          </div>
          <div className="card-stats"><span><strong>{challenge.entrantCount}</strong> challengers</span><span><strong>{challenge.watchers}</strong> watching</span><span className="refresh-count"><strong>{refreshes}</strong> pulls left today</span></div>
        </article>
        <aside className="rule-note">
          <span className="note-number">RULE 01</span><h3>You can’t search for an ordinary pact.</h3><p>Discovery stays a little strange on purpose: limited random pulls create attention without turning people’s goals into inventory.</p><div className="scribble">luck &gt; filters</div>
        </aside>
      </section>
      <section className="leaderboard-section">
        <div className="section-heading"><div><p className="eyebrow">EARNED DISCOVERY</p><h2>Three ways to surface.</h2></div><p>One restriction across all three: an unresolved default removes every pact you make from the boards.</p></div>
        <div className="boards-grid">
          {leaderboards.map(({ board, entries }) => (
            <div className="board" key={board}>
              <div className="board-title"><span>{board === "highest_stakes" ? "$$$" : board === "most_watched" ? "EYES" : "ODD"}</span><h3>{boardLabels[board]}</h3></div>
              {entries.map(({ challenge: entry }, index) => (
                <button className="board-row" key={entry.id} onClick={() => onOpen(entry)}><b>0{index + 1}</b><span>{entry.title}<small>{board === "highest_stakes" ? money(entry.stake.estimatedValue) : board === "most_watched" ? `${entry.watchers} watching` : `${entry.interestingScore}/100 weird`}</small></span></button>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChallengePage({ challenge, creatorName, joined, onJoin, onSelect }: { challenge: Challenge; creatorName: string; joined: boolean; onJoin: () => void; onSelect: () => void }) {
  return (
    <div className="page-wrap detail-page">
      <div className="detail-head"><p className="eyebrow">CHALLENGE DETAIL · ENTRY OPEN</p><h1>{creatorName} put<br />something real behind it.</h1></div>
      <div className="detail-grid">
        <section className="contract-card">
          <div className="contract-label">THE PACT</div><p>I, <strong>{creatorName}</strong>, will</p><h2>{challenge.title}</h2>
          <div className="contract-meta"><div><span>DEADLINE</span><strong>{challenge.deadlineLabel}</strong></div><div><span>TIME LEFT</span><strong>{challenge.daysRemaining} days</strong></div></div>
          <div className="proof-list"><span>THE RECEIPTS</span>{challenge.proof.map((proof) => <div key={proof}><i>✓</i>{proof}</div>)}</div>
          <div className="signature">locked after matching</div>
        </section>
        <section className="entry-panel">
          <StakeObject challenge={challenge} /><blockquote>“{challenge.stake.significance}”</blockquote><div className="verified-line"><span>✓</span> Ownership mocked as verified</div>
          {!joined ? <button className="giant-action" onClick={onJoin}>ENTER THE DRAW <span>→</span></button> : (
            <div className="joined-panel"><span className="joined-check">✓</span><h3>You’re in.</h3><p>{challenge.entrantCount} people entered. One challenger will be selected when the window closes.</p><button className="giant-action" onClick={onSelect}>SIMULATE SELECTION <span>→</span></button></div>
          )}
          <p className="fine-print">No money changes hands. If the goal fails, the item ships directly to the selected challenger.</p>
        </section>
      </div>
    </div>
  );
}

function MatchPage({ state, onFastForward }: { state: DemoState; onFastForward: () => void }) {
  return (
    <div className="match-page">
      <div className="match-burst burst-one" /><div className="match-burst burst-two" /><p className="eyebrow">THE DRAW IS CLOSED</p><div className="selected-stamp">YOU WERE SELECTED</div>
      <div className="versus"><div className="fighter"><span>{state.creator.avatar}</span><h2>{state.creator.displayName}</h2><p>MAKER</p></div><div className="vs-mark">VS</div><div className="fighter you"><span>YO</span><h2>YOU</h2><p>CHALLENGER</p></div></div>
      <StakeObject challenge={state.featured} compact /><div className="match-time"><strong>{state.featured.daysRemaining}</strong><span>DAYS<br />ON THE CLOCK</span></div><button className="dark-action" onClick={onFastForward}>FAST-FORWARD {state.featured.daysRemaining} DAYS <span>→</span></button>
    </div>
  );
}

function OutcomePage({ state, onDefault, onShip, onProfile }: { state: DemoState; onDefault: () => void; onShip: () => void; onProfile: () => void }) {
  const resolved = state.featured.state === "DEFAULTED" || state.featured.state === "SHIPPED";
  const defaulted = state.featured.state === "DEFAULTED";
  const marks = state.featured.leaderboardPlacement?.board === "highest_stakes" ? 10 : 1;
  return (
    <div className="page-wrap outcome-page">
      <div className="outcome-title"><p className="eyebrow">GOAL RESULT</p><span className="failed-word">FAILED</span><h1>{state.creator.displayName} missed the deadline.</h1></div>
      {!resolved ? (
        <div className="shipment-card"><div className="shipment-clock"><span>72</span><small>HOURS TO<br />ADD TRACKING</small></div><div className="shipment-copy"><p className="eyebrow">NOW THE STAKE MOVES</p><h2>{state.featured.stake.itemName}<br />→ You</h2><p>The platform doesn’t hold the item. {state.creator.displayName} must ship it directly—or carry the mark.</p><div className="outcome-actions"><button className="primary-action" onClick={onShip}>Simulate shipped <span>✓</span></button><button className="default-button" onClick={onDefault}>Simulate default <span>+{marks}</span></button></div></div></div>
      ) : (
        <div className={`resolution-card ${defaulted ? "is-default" : "is-shipped"}`}><span className="resolution-kicker">{defaulted ? `DEFAULT +${marks}` : "TRACKING ADDED"}</span><h2>{defaulted ? "The pact stays. So does the mark." : "The stake is moving."}</h2><p>{defaulted ? `${state.creator.displayName} can still create, discover, and challenge. Their pacts simply disappear from every leaderboard until the debt is cleansed.` : `The ${state.featured.stake.itemName} is on its way to you. No default was recorded.`}</p><button className="dark-action" onClick={onProfile}>SEE {state.creator.displayName.toUpperCase()}’S PROFILE <span>→</span></button></div>
      )}
      <aside className="rule-strip"><b>RULE 04</b> Default is a visible consequence, not a ban.</aside>
    </div>
  );
}

function ProfilePage({ state, onCleanse, onContinue }: { state: DemoState; onCleanse: () => void; onContinue: () => void }) {
  const eligible = isLeaderboardEligible(state.creator);
  const canCleanse = state.creator.unresolvedDefaults > 0;
  const isCleansed = state.lastEvent === "CLEANSED";
  return (
    <div className="page-wrap profile-page">
      {isCleansed && <div className="cleansed-banner"><div><span>DEFAULT CLEARED</span><strong>Debt doesn’t ban you.<br />It moves through the network.</strong></div><div className="zero-change">1 <span>→</span> 0</div></div>}
      <section className="profile-head"><div className="profile-avatar">{state.creator.avatar}</div><div><p className="eyebrow">PUBLIC PROFILE</p><h1>{state.creator.displayName}</h1><p>{state.creator.handle} · {state.creator.bio}</p></div><div className={`default-counter ${eligible ? "clear" : "marked"}`}><span>{state.creator.unresolvedDefaults}</span><strong>UNRESOLVED<br />DEFAULT{state.creator.unresolvedDefaults === 1 ? "" : "S"}</strong></div></section>
      <section className="profile-grid">
        <div className="profile-panel"><h2>{eligible ? "Clear to surface." : "Marked, not banned."}</h2><div className="permission-row yes"><span>✓</span><p><strong>Create challenges</strong><small>Nothing stops the next pact.</small></p></div><div className="permission-row yes"><span>✓</span><p><strong>Challenge others</strong><small>Participation stays open.</small></p></div><div className="permission-row yes"><span>✓</span><p><strong>Use random Discover</strong><small>Seven pulls still means seven pulls.</small></p></div><div className={`permission-row ${eligible ? "yes" : "no"}`}><span>{eligible ? "✓" : "×"}</span><p><strong>Enter leaderboards</strong><small>{eligible ? "All three boards are available." : "Any unresolved mark hides every created pact."}</small></p></div></div>
        <div className="cleansing-panel"><p className="eyebrow">A FEW WEEKS LATER…</p><h2>{state.creator.displayName} becomes someone else’s challenger.</h2><div className="mini-story"><span>THEY FAIL</span><i>↓</i><span>THEY DON’T SHIP</span><i>↓</i><span>{state.creator.displayName.toUpperCase()} RECEIVES A DEFAULT</span></div><p>When someone defaults on the person they were matched with, one unresolved mark is cleansed.</p><button className="giant-action" onClick={canCleanse ? onCleanse : onContinue}>{canCleanse ? "SIMULATE CLEANSING" : "BACK TO DISCOVER"} <span>→</span></button></div>
      </section>
      <section className="ledger"><div><span>{state.creator.historicalDefaults}</span><small>historical defaults</small></div><div><span>{state.creator.defaultsReceived}</span><small>defaults received</small></div><div><span>{eligible ? "YES" : "NO"}</span><small>leaderboard eligible</small></div></section>
    </div>
  );
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <button className="modal-close" onClick={onClose} aria-label="Close create challenge dialog">×</button><p className="eyebrow">CREATE · MOCK FLOW</p><h2 id="create-title">Put something you love behind something you want.</h2><label>YOUR PROMISE<input defaultValue="Publish my first public build" /></label><div className="form-split"><label>DEADLINE<input defaultValue="30 days" /></label><label>PHYSICAL STAKE<input defaultValue="Nintendo Switch" /></label></div><label>WHAT COUNTS AS DONE?<textarea defaultValue="Public URL, working sign-in, and a timestamped release." /></label><div className="create-rule"><span>01</span> Once matched, the promise and proof contract lock.</div><button className="giant-action" onClick={onCreate}>OPEN THIS PACT <span>→</span></button>
      </div>
    </div>
  );
}
