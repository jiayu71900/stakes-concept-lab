"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Challenge, DemoState, LeaderboardType } from "@/domain/models";
import { challenges, createInitialDemoState, creators } from "@/mock/demoData";
import { deterministicDiscovery } from "@/engine/discoveryEngine";
import { advanceThrough, transitionChallenge } from "@/engine/challengeStateMachine";
import { cleanseOneDefault, isLeaderboardEligible, recordDefault } from "@/engine/defaultEngine";
import { rankLeaderboard } from "@/engine/leaderboardEngine";
import { scenarioAt } from "@/mock/scenarioPresets";

type DemoView = "discover" | "challenge" | "match" | "outcome" | "profile" | "lab";
const STORAGE_KEY = "stakes-concept-demo-v1";

const routes: Record<DemoView, string> = {
  discover: "/",
  challenge: "/challenge",
  match: "/match",
  outcome: "/outcome",
  profile: "/profile",
  lab: "/lab",
};

const boardLabels: Record<LeaderboardType, string> = {
  highest_stakes: "Highest stakes",
  most_watched: "Most watched",
  most_interesting: "Most interesting",
};

const journey = ["Create", "Discover", "Challenge", "Match", "Fail", "Default", "Cleansing"];

const journeyDetails = [
  "Write a goal, lock the proof contract, and put a physical item behind it.",
  "See one ordinary pact at a time. Next replaces it; leaderboards are the only browseable exception.",
  "Inspect the promise and stake, then enter the random challenger draw.",
  "One entrant is selected before the clock starts: maker versus challenger.",
  "Missed proof moves the pact into a 72-hour direct-shipping window.",
  "No shipment means a public mark—not a ban. Leaderboard access is the consequence.",
  "If someone later defaults on this user, one unresolved mark is cleared.",
];

function pathToView(pathname: string): DemoView {
  if (pathname.startsWith("/challenge")) return "challenge";
  if (pathname.startsWith("/match")) return "match";
  if (pathname.startsWith("/outcome")) return "outcome";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/lab")) return "lab";
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
  const [showCreatedToast, setShowCreatedToast] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState<string | null>(null);

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

  useEffect(() => {
    if (!showCreatedToast) return;
    const timeout = window.setTimeout(() => setShowCreatedToast(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [showCreatedToast]);

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
    setShowCreatedToast(true);
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
    setShowCreatedToast(false);
    navigate("discover");
  };

  const jumpToStage = (index: number) => {
    if (index === 0) {
      setCreateOpen(true);
      return;
    }
    setState(scenarioAt(index));
    const destination: DemoView = index === 1 ? "discover" : index === 2 ? "challenge" : index === 3 ? "match" : index <= 5 ? "outcome" : "profile";
    navigate(destination);
  };

  const copyBrief = async (title: string, brief: string) => {
    await navigator.clipboard.writeText(`STAKES. contribution brief — ${title}\n\n${brief}`);
    setCopiedBrief(title);
    window.setTimeout(() => setCopiedBrief(null), 2200);
  };

  const activeStage = activeJourneyStage(view, state, createOpen);

  return (
    <main className="site-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => navigate("discover")} aria-label="Go to Discover">STAKES<span>.</span></button>
        <nav className="nav-links" aria-label="Primary navigation">
          <button className={view === "discover" ? "active" : ""} onClick={() => navigate("discover")}>Discover</button>
          <button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}>Profile</button>
          <button className={view === "lab" ? "active" : ""} onClick={() => navigate("lab")}>Build with us</button>
          <button className="make-button" onClick={() => setCreateOpen(true)}>+ Make a pact</button>
        </nav>
      </header>

      <section className="story-rail" aria-label="Demo story progress">
        <div className="rail-label">60-sec demo</div>
        <div className="rail-steps">
          {journey.map((step, index) => (
            <button className={`rail-step ${journeyStatus(state, index, activeStage)}`} key={step} onClick={() => jumpToStage(index)}>
              <span>{String(index + 1).padStart(2, "0")}</span>{step}
            </button>
          ))}
        </div>
        <button className="reset-button" onClick={resetDemo}>Reset</button>
      </section>

      {view !== "lab" && (
        <section className="journey-guide" aria-live="polite">
          <span>{String(activeStage + 1).padStart(2, "0")}</span>
          <strong>{journey[activeStage]}</strong>
          <p>{journeyDetails[activeStage]}</p>
          <small>Click any stage above to preview it directly.</small>
        </section>
      )}

      {showCreatedToast && view === "discover" && (
        <div className="event-toast" role="status">
          <button onClick={() => setShowCreatedToast(false)} aria-label="Dismiss notification">×</button>
          <span>NEW PACT OPEN</span>“Publish my first public build” is now in the random pool.
        </div>
      )}

      {view === "discover" && (
        <DiscoverPage challenge={currentDiscovery} refreshes={state.viewer.refreshesRemaining} leaderboards={leaderboards} onRefresh={refreshDiscovery} onOpen={openChallenge} onPreviewDefault={() => jumpToStage(5)} />
      )}
      {view === "challenge" && (
        <ChallengePage challenge={state.featured} creatorName={state.creator.displayName} joined={state.joined} onJoin={joinChallenge} onSelect={simulateSelection} />
      )}
      {view === "match" && <MatchPage state={state} onFastForward={fastForward} />}
      {view === "outcome" && <OutcomePage state={state} onDefault={simulateDefault} onShip={simulateShipment} onProfile={() => navigate("profile")} />}
      {view === "profile" && <ProfilePage state={state} onCleanse={cleanseDefault} onContinue={() => navigate("discover")} />}
      {view === "lab" && <LabPage copiedBrief={copiedBrief} onCopy={copyBrief} />}

      <footer className="footer">
        <div><strong>Small human core. AI-augmented by default.</strong><span>Built in the open with people who enjoy weird systems.</span></div>
        <button onClick={() => navigate("lab")}>Build with us →</button>
      </footer>

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onCreate={createChallenge} />}
    </main>
  );
}

function activeJourneyStage(view: DemoView, state: DemoState, createOpen: boolean) {
  if (createOpen) return 0;
  if (view === "challenge") return 2;
  if (view === "match") return 3;
  if (view === "outcome") return state.lastEvent === "DEFAULTED" ? 5 : 4;
  if (view === "profile") return 6;
  return 1;
}

function journeyStatus(state: DemoState, index: number, activeStage: number) {
  const progress: Record<DemoState["lastEvent"], number> = { READY: 1, CREATED: 1, JOINED: 2, MATCHED: 3, FAILED: 4, SHIPPED: 4, DEFAULTED: 5, CLEANSED: 6 };
  if (index === activeStage) return "current";
  if (index < Math.max(progress[state.lastEvent], activeStage)) return "done";
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

function DiscoverPage({ challenge, refreshes, leaderboards, onRefresh, onOpen, onPreviewDefault }: {
  challenge: Challenge;
  refreshes: number;
  leaderboards: { board: LeaderboardType; entries: ReturnType<typeof rankLeaderboard> }[];
  onRefresh: () => void;
  onOpen: (challenge: Challenge) => void;
  onPreviewDefault: () => void;
}) {
  const creator = creatorFor(challenge);
  const highStakes = challenge.leaderboardPlacement?.board === "highest_stakes";
  return (
    <div className="page-wrap discover-page">
      <section className="discover-intro">
        <p className="eyebrow">RANDOM DISCOVERY · NO SEARCH</p>
        <h1>What would you risk<br />to finally do it?</h1>
        <div className="discover-mode"><strong>ONE ORDINARY PACT PER PULL</strong><span>“Next” replaces this card. The ranked lists below are the only browseable exception.</span></div>
      </section>
      <section className="discover-grid">
        <article className="challenge-card">
          <div className="stack-label">RANDOM PULL {8 - refreshes} OF 7</div>
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
      <section className="trust-section">
        <div className="trust-heading"><p className="eyebrow">WHAT A DEFAULT ACTUALLY DOES</p><h2>A mark changes reach.<br />It does not lock the door.</h2></div>
        <div className="trust-rules">
          <div className="trust-rule mark"><span>01</span><strong>PUBLIC MARK</strong><p>Ordinary default +1. Highest Stakes default +10.</p></div>
          <div className="trust-rule"><span>02</span><strong>KEEP PARTICIPATING</strong><p>Create, challenge others, and use Discover as normal.</p></div>
          <div className="trust-rule blocked"><span>03</span><strong>LOSE LEADERBOARDS</strong><p>Every pact stays off all three boards while a mark is unresolved.</p></div>
          <div className="trust-rule cleanse"><span>04</span><strong>GET CLEANSED</strong><p>If someone later defaults on you, one unresolved mark clears.</p></div>
        </div>
        <button className="trust-preview" onClick={onPreviewDefault}>Preview a marked profile <span>→</span></button>
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
          <div className="challenge-consequence"><b>IF THEY DEFAULT</b><span>+{challenge.leaderboardPlacement?.board === "highest_stakes" ? 10 : 1} public mark</span><span>Still allowed to play</span><span>Removed from leaderboards</span></div>
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

const contributionBriefs = [
  {
    tag: "SYSTEMS",
    title: "Break default cleansing",
    question: "How would two friends manufacture defaults to erase each other’s marks?",
    brief: "Map the smallest collusion loop in V0 default cleansing. Propose one countermeasure and one simulation that would prove it works without turning a default into a ban.",
    deliverable: "Threat scenario + executable simulation",
  },
  {
    tag: "DISCOVERY",
    title: "Make randomness fair",
    question: "How do seven pulls feel surprising without starving new makers of attention?",
    brief: "Design a controlled-randomness experiment for seven daily pulls. Define an exposure budget, one anti-repeat rule, and the metric that would reveal unfair distribution.",
    deliverable: "Small engine experiment + fairness metric",
  },
  {
    tag: "RANKING",
    title: "Define interesting",
    question: "Can a pact be interesting without rewarding rage bait or expensive objects?",
    brief: "Propose a transparent V0 interestingness score using at most three signals. Include one gaming attack and a test case that prevents price from dominating the score.",
    deliverable: "Scoring proposal + adversarial cases",
  },
  {
    tag: "TRUST",
    title: "Prove the promise",
    question: "What evidence is strong enough when the challenger cannot be the judge?",
    brief: "Choose one goal category and design its completion contract. Separate automatic evidence, review, and appeal while keeping the selected challenger out of the final decision.",
    deliverable: "Completion contract + review boundary",
  },
];

function LabPage({ copiedBrief, onCopy }: { copiedBrief: string | null; onCopy: (title: string, brief: string) => void }) {
  return (
    <div className="page-wrap lab-page">
      <section className="lab-hero">
        <p className="eyebrow">OPEN PRODUCT LAB · NO FICTIONAL TEAM</p>
        <h1>The demo is the invitation.</h1>
        <p>We are not looking for people to “help build a website.” We are looking for people who want to argue with a strange system, break a rule, and leave behind a better experiment.</p>
      </section>

      <section className="lab-principle">
        <span>THE COLLABORATION LOOP</span>
        <div><b>01</b><strong>Pick one uncomfortable rule</strong></div>
        <i>→</i>
        <div><b>02</b><strong>Make the failure concrete</strong></div>
        <i>→</i>
        <div><b>03</b><strong>Ship the smallest proof</strong></div>
      </section>

      <section className="briefs-section">
        <div className="section-heading"><div><p className="eyebrow">FOUR REAL STARTING POINTS</p><h2>Choose a problem,<br />not a job title.</h2></div><p>Every card contains a bounded contribution that can be challenged, tested, or replaced. Copy one and use it as a first proposal.</p></div>
        <div className="briefs-grid">
          {contributionBriefs.map((item, index) => (
            <article className="brief-card" key={item.title}>
              <div className="brief-top"><span>{item.tag}</span><b>0{index + 1}</b></div>
              <h3>{item.title}</h3>
              <p>{item.question}</p>
              <small>USEFUL FIRST OUTPUT</small>
              <strong>{item.deliverable}</strong>
              <button onClick={() => onCopy(item.title, item.brief)}>{copiedBrief === item.title ? "COPIED ✓" : "COPY STARTER BRIEF →"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="team-model">
        <div className="team-title"><p className="eyebrow">HOW THIS TEAM ACTUALLY WORKS</p><h2>Small human core.<br />AI workbench.<br />Open edges.</h2></div>
        <div className="team-layers">
          <div><span>HUMAN CORE</span><strong>Product direction<br />& final judgment</strong><small>Real people are always named as themselves.</small></div>
          <div><span>AI WORKBENCH</span><strong>Architecture · prototypes<br />research · red-team</strong><small>Working roles, never fictional employees.</small></div>
          <div className="open-layer"><span>COMMUNITY</span><strong>Engineers · designers<br />researchers · operators</strong><small>Join through a concrete contribution, not a ceremonial title.</small></div>
        </div>
      </section>

      <section className="lab-close">
        <span>COME FOR THE DEMO.</span>
        <h2>Stay because the rules are harder than they look.</h2>
        <p>The public repository and discussion channel are the next distribution step. Until then, these contribution briefs make the project’s open edges explicit and honest.</p>
      </section>
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
