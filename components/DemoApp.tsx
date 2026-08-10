"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Challenge, DemoState, LeaderboardType, User } from "@/domain/models";
import { challenges, createInitialDemoState, creators } from "@/mock/demoData";
import { deterministicDiscovery } from "@/engine/discoveryEngine";
import { advanceThrough, transitionChallenge } from "@/engine/challengeStateMachine";
import { recordDefault } from "@/engine/defaultEngine";
import { rankLeaderboard } from "@/engine/leaderboardEngine";

type DemoView = "discover" | "challenge" | "match" | "outcome" | "profile" | "lab";
const STORAGE_KEY = "bet-i-do-demo-v3";
const REPOSITORY_URL = "https://github.com/jiayu71900/stakes-concept-lab";
const DISCUSSION_URLS = {
  firstImpressions: `${REPOSITORY_URL}/discussions/new?category=first-impressions`,
  breakRule: `${REPOSITORY_URL}/discussions/new?category=break-a-rule`,
  shapeSystem: `${REPOSITORY_URL}/discussions/new?category=shape-the-system`,
};

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

function createStateForView(view: DemoView): DemoState {
  const base = createInitialDemoState();
  if (view !== "match" && view !== "outcome" && view !== "profile") return base;

  const matched = transitionChallenge(base.featured, "MATCHED");
  const matchState: DemoState = {
    ...base,
    joined: true,
    featured: {
      ...matched,
      match: { id: `match-${matched.id}`, challengeId: matched.id, creatorId: base.creator.id, challengerId: base.viewer.id, selectedAt: "2026-08-09T12:00:00.000Z" },
    },
    lastEvent: "MATCHED",
  };
  if (view === "match") return matchState;

  const failedState: DemoState = {
    ...matchState,
    simulatedDay: matched.durationDays,
    featured: { ...advanceThrough(matchState.featured, ["ACTIVE", "AWAITING_RESULT", "FAILED", "AWAITING_SHIPMENT"]), daysRemaining: 0 },
    lastEvent: "FAILED",
  };
  if (view === "outcome") return failedState;

  const defaulted = recordDefault(failedState.creator, failedState.viewer, failedState.featured);
  return {
    ...failedState,
    creator: defaulted.debtor,
    featured: transitionChallenge(failedState.featured, "DEFAULTED"),
    defaultRecords: [defaulted.record],
    lastEvent: "DEFAULTED",
  };
}

export function DemoApp({ initialView }: { initialView: DemoView }) {
  const [view, setView] = useState<DemoView>(initialView);
  const [state, setState] = useState<DemoState>(() => createStateForView(initialView));
  const [hydrated, setHydrated] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showCreatedToast, setShowCreatedToast] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState<string | null>(null);
  const [createIdentityId, setCreateIdentityId] = useState("you");
  const [publisherMode, setPublisherMode] = useState(false);

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
    setPublisherMode(false);
    setState((current) => ({
      ...current,
      featured: structuredClone(challenge),
      creator: { ...creatorFor(challenge) },
      joined: false,
      simulatedDay: 0,
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

  const createChallenge = (durationDays: number, title: string) => {
    const identity = createIdentityId === state.creator.id ? state.creator : state.viewer;
    const draft: Challenge = {
      ...structuredClone(challenges[0]),
      id: "your-first-bet",
      slug: "your-first-bet",
      creatorId: identity.id,
      title,
      state: "DRAFT",
      durationDays,
      daysRemaining: durationDays,
      entrantCount: 0,
      watchers: 0,
    };
    const opened = transitionChallenge(draft, "OPEN");
    setState((current) => ({ ...current, creator: identity, featured: opened, joined: false, simulatedDay: 0, messages: [], createdChallenge: true, lastEvent: "CREATED" }));
    setPublisherMode(true);
    setShowCreatedToast(true);
    setCreateOpen(false);
    navigate("challenge");
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
        simulatedDay: 0,
        lastEvent: "MATCHED",
      };
    });
    navigate("match");
  };

  const startChallenge = () => {
    if (state.featured.state !== "MATCHED") return;
    setState((current) => ({
      ...current,
      featured: { ...transitionChallenge(current.featured, "ACTIVE"), daysRemaining: current.featured.durationDays },
      simulatedDay: 0,
      lastEvent: "ACTIVE",
    }));
  };

  const advanceDays = (amount: number) => {
    if (state.featured.state !== "ACTIVE") return;
    setState((current) => {
      const nextDay = Math.min(current.featured.durationDays, current.simulatedDay + amount);
      const atDeadline = nextDay === current.featured.durationDays;
      const advanced = { ...current.featured, daysRemaining: current.featured.durationDays - nextDay };
      return {
        ...current,
        featured: atDeadline ? transitionChallenge(advanced, "AWAITING_RESULT") : advanced,
        simulatedDay: nextDay,
        lastEvent: atDeadline ? "AWAITING_RESULT" : "ACTIVE",
      };
    });
  };

  const resolveChallenge = (result: "SUCCESS" | "FAILED") => {
    if (state.featured.state !== "AWAITING_RESULT") return;
    if (result === "SUCCESS") {
      setState((current) => ({ ...current, featured: transitionChallenge(current.featured, "SUCCESS"), lastEvent: "SUCCESS" }));
      return;
    }
    setState((current) => ({
      ...current,
      featured: advanceThrough(current.featured, ["FAILED", "AWAITING_SHIPMENT"]),
      lastEvent: "FAILED",
    }));
    navigate("outcome");
  };

  const postDailyMessage = (body: string) => {
    const text = body.trim();
    if (!text || state.simulatedDay < 1 || state.featured.state !== "ACTIVE") return;
    setState((current) => {
      const alreadyPosted = current.messages.some((message) => message.challengeId === current.featured.id && message.authorId === current.creator.id && message.day === current.simulatedDay);
      if (alreadyPosted) return current;
      return {
        ...current,
        messages: [...current.messages, {
          id: `message-${current.featured.id}-${current.simulatedDay}`,
          challengeId: current.featured.id,
          authorId: current.creator.id,
          day: current.simulatedDay,
          body: text,
          kind: "CREATOR_UPDATE",
        }],
      };
    });
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

  const resetDemo = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(createInitialDemoState());
    setShowCreatedToast(false);
    navigate("discover");
  };

  const copyBrief = async (title: string, brief: string) => {
    await navigator.clipboard.writeText(`BET I DO. contribution brief — ${title}\n\n${brief}`);
    setCopiedBrief(title);
    window.setTimeout(() => setCopiedBrief(null), 2200);
  };


  return (
    <main className="site-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => navigate("discover")} aria-label="Go to Discover">BET I DO<span>.</span></button>
        <nav className="nav-links" aria-label="Primary navigation">
          <button className={view === "discover" ? "active" : ""} onClick={() => navigate("discover")}>Discover</button>
          <button className={view === "lab" ? "active" : ""} onClick={() => navigate("lab")}>Build with us</button>
          <button className="make-button" onClick={() => { setCreateIdentityId(state.viewer.id); setCreateOpen(true); }}>+ Make a bet</button>
        </nav>
      </header>

      {view !== "lab" && <div className="session-bar"><span>PLAYABLE BET</span><p>Pull a stranger’s promise. Decide whether you believe it.</p><button onClick={resetDemo}>Restart story</button></div>}

      {showCreatedToast && (
        <div className="event-toast" role="status">
          <button onClick={() => setShowCreatedToast(false)} aria-label="Dismiss notification">×</button>
          <span>BET IS OPEN</span>Your bet is now waiting in the random pool.
        </div>
      )}

      {view === "discover" && (
        <DiscoverPage challenge={currentDiscovery} refreshes={state.viewer.refreshesRemaining} leaderboards={leaderboards} onRefresh={refreshDiscovery} onOpen={openChallenge} />
      )}
      {view === "challenge" && (
        publisherMode ? <PublisherChallengePage challenge={state.featured} creator={state.creator} onViewPublic={() => setPublisherMode(false)} /> : <ChallengePage challenge={state.featured} creatorName={state.creator.displayName} joined={state.joined} onJoin={joinChallenge} onSelect={simulateSelection} />
      )}
      {view === "match" && <MatchPage state={state} onStart={startChallenge} onAdvance={advanceDays} onResolve={resolveChallenge} onPostMessage={postDailyMessage} />}
      {view === "outcome" && <OutcomePage state={state} onDefault={simulateDefault} onShip={simulateShipment} onProfile={() => navigate("profile")} />}
      {view === "profile" && <ProfilePage state={state} onPublishAs={() => { setCreateIdentityId(state.creator.id); setCreateOpen(true); }} />}
      {view === "lab" && <LabPage copiedBrief={copiedBrief} onCopy={copyBrief} />}

      <footer className="footer">
        <div><strong>Small human core. AI-augmented by default.</strong><span>Building a stranger kind of bet in the open.</span></div>
        <button onClick={() => navigate("lab")}>Build with us →</button>
      </footer>

      {createOpen && <CreateModal identity={createIdentityId === state.creator.id ? state.creator : state.viewer} onClose={() => setCreateOpen(false)} onCreate={createChallenge} />}
    </main>
  );
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
  const [boardsOpen, setBoardsOpen] = useState(false);
  return (
    <div className="page-wrap discover-page">
      <section className="discover-intro">
        <p className="eyebrow">BET ON YOURSELF · LET SOMEONE BET AGAINST YOU</p>
        <h1>Put something real<br />on your word.</h1>
        <div className="discover-mode"><strong>ONE ORDINARY BET PER PULL</strong><span>“Next” replaces this card. Ranked bets are the only browseable exception.</span></div>
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
            <button className="primary-action" onClick={() => onOpen(challenge)}>Bet {creator.displayName} won’t <span>↗</span></button>
            <button className="shuffle-button" onClick={onRefresh} disabled={refreshes === 0} aria-label="Show another random bet"><span>↻</span> Next random bet</button>
          </div>
          <div className="card-stats"><span><strong>{challenge.entrantCount}</strong> challengers</span><span><strong>{challenge.watchers}</strong> watching</span><span className="refresh-count"><strong>{refreshes}</strong> pulls left today</span></div>
        </article>
        <aside className="rule-note">
          <span className="note-number">RULE 01</span><h3>You can’t search for an ordinary bet.</h3><p>Discovery stays a little strange on purpose: limited random pulls create attention without turning people’s promises into inventory.</p><div className="scribble">luck &gt; filters</div>
        </aside>
      </section>
      <section className="boards-teaser">
        <div><p className="eyebrow">A SIDE DOOR</p><h2>Some bets surface<br />without a random pull.</h2><span>The rules are easier to notice than to explain.</span></div>
        <button onClick={() => setBoardsOpen((open) => !open)}>{boardsOpen ? "CLOSE THE BOARDS" : "PEEK AT THE BOARDS →"}</button>
      </section>
      {boardsOpen && (
        <section className="leaderboard-section revealed">
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
      )}
    </div>
  );
}

function PublisherChallengePage({ challenge, creator, onViewPublic }: { challenge: Challenge; creator: User; onViewPublic: () => void }) {
  const marked = creator.unresolvedDefaults > 0;
  return (
    <div className="page-wrap publisher-page">
      <section className="publisher-receipt">
        <div className="publisher-status"><span>BET OPEN</span><i /></div>
        <p className="eyebrow">PUBLISHED AS {creator.displayName.toUpperCase()}</p>
        <h1>{challenge.title}</h1>
        <div className="publisher-meta"><span><b>{challenge.durationDays}</b> DAYS</span><span><b>{challenge.entrantCount}</b> ENTRANTS</span><span><b>{challenge.watchers}</b> WATCHING</span></div>
        <StakeObject challenge={challenge} />
        {marked && <div className="marked-publisher"><span>{creator.unresolvedDefaults}</span><div><strong>PUBLIC MARK ATTACHED</strong><p>The bet is live. What happens to its reach is left for the system to reveal.</p></div></div>}
        <div className="publisher-next"><div><small>NEXT</small><strong>Updates open after a challenger is drawn.</strong><p>The maker may post at most one note per day. Silence is allowed.</p></div><button className="giant-action" onClick={onViewPublic}>VIEW PUBLIC BET <span>→</span></button></div>
      </section>
    </div>
  );
}

function ChallengePage({ challenge, creatorName, joined, onJoin, onSelect }: { challenge: Challenge; creatorName: string; joined: boolean; onJoin: () => void; onSelect: () => void }) {
  return (
    <div className="page-wrap detail-page">
      <div className="detail-head"><p className="eyebrow">THE BET · ENTRY OPEN</p><h1>{creatorName} put<br />something real on it.</h1></div>
      <div className="detail-grid">
        <section className="contract-card">
          <div className="contract-label">I BET I CAN</div><p>I, <strong>{creatorName}</strong>, will</p><h2>{challenge.title}</h2>
          <div className="contract-meta"><div><span>DEADLINE</span><strong>{challenge.deadlineLabel}</strong></div><div><span>BET LENGTH</span><strong>{challenge.durationDays} days</strong></div></div>
          <div className="proof-list"><span>THE RECEIPTS</span>{challenge.proof.map((proof) => <div key={proof}><i>✓</i>{proof}</div>)}</div>
          <div className="signature">locked after matching</div>
        </section>
        <section className="entry-panel">
          <StakeObject challenge={challenge} /><blockquote>“{challenge.stake.significance}”</blockquote><div className="verified-line"><span>✓</span> Ownership mocked as verified</div>
          <div className="room-preview"><b>INSIDE THE ROOM</b><p>The clock can move one day or one week at a time. The maker may leave at most one update per day.</p></div>
          <div className="entry-how"><b>BET THEY WON’T</b><span>Enter before the window closes. One challenger is drawn from everyone inside.</span></div>
          {!joined ? <button className="giant-action" onClick={onJoin}>TAKE THE OTHER SIDE <span>→</span></button> : (
            <div className="joined-panel"><span className="joined-check">✓</span><h3>You’re in.</h3><p>{challenge.entrantCount} people entered. One challenger will be selected when the window closes.</p><button className="giant-action" onClick={onSelect}>CLOSE ENTRY &amp; DRAW <span>→</span></button></div>
          )}
          <p className="fine-print">No money changes hands. What the system does at the deadline is revealed only after the match begins.</p>
        </section>
      </div>
    </div>
  );
}

function MatchPage({ state, onStart, onAdvance, onResolve, onPostMessage }: {
  state: DemoState;
  onStart: () => void;
  onAdvance: (days: number) => void;
  onResolve: (result: "SUCCESS" | "FAILED") => void;
  onPostMessage: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const challenge = state.featured;
  const visibleMessages = state.messages
    .filter((message) => message.challengeId === challenge.id && message.day <= state.simulatedDay)
    .toSorted((a, b) => b.day - a.day);
  const postedToday = state.messages.some((message) => message.challengeId === challenge.id && message.authorId === state.creator.id && message.day === state.simulatedDay);
  const progress = Math.round((state.simulatedDay / challenge.durationDays) * 100);
  const roomStarted = challenge.state !== "MATCHED";

  if (!roomStarted) {
    return (
      <div className="match-page">
        <div className="match-burst burst-one" /><div className="match-burst burst-two" /><p className="eyebrow">BET ACCEPTED</p><div className="selected-stamp">YOU WERE SELECTED</div>
        <div className="versus"><div className="fighter"><span>{state.creator.avatar}</span><h2>{state.creator.displayName}</h2><p>MAKER</p></div><div className="vs-mark">VS</div><div className="fighter you"><span>YO</span><h2>YOU</h2><p>CHALLENGER</p></div></div>
        <StakeObject challenge={challenge} compact /><div className="match-time"><strong>{challenge.durationDays}</strong><span>DAYS<br />ON THE CLOCK</span></div><button className="dark-action" onClick={onStart}>ENTER THE CHALLENGE ROOM <span>→</span></button>
      </div>
    );
  }

  return (
    <div className="page-wrap room-page">
      <header className="room-head">
        <div><p className="eyebrow">LIVE CHALLENGE ROOM</p><h1>{challenge.title}</h1></div>
        <div className={`room-status status-${challenge.state.toLowerCase()}`}><i />{challenge.state.replaceAll("_", " ")}</div>
      </header>

      <div className="room-grid">
        <section className="simulation-panel">
          <div className="day-display"><span>DAY</span><strong>{state.simulatedDay}</strong><small>OF {challenge.durationDays}</small></div>
          <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
          <div className="room-stats"><span><b>{challenge.durationDays - state.simulatedDay}</b> days left</span><span><b>{progress}%</b> elapsed</span><span><b>{visibleMessages.length}</b> maker updates</span></div>

          {challenge.state === "ACTIVE" && (
            <div className="time-controls">
              <p>Move the clock. New updates appear on the days they were posted.</p>
              <div><button onClick={() => onAdvance(1)}>+ 1 DAY</button><button onClick={() => onAdvance(7)}>+ 7 DAYS</button><button className="deadline-jump" onClick={() => onAdvance(challenge.durationDays - state.simulatedDay)}>JUMP TO DEADLINE →</button></div>
            </div>
          )}

          {challenge.state === "AWAITING_RESULT" && (
            <div className="result-gate"><span>THE CLOCK STOPPED</span><h2>What happened?</h2><p>The rest of the system stays hidden until an outcome is chosen.</p><div><button onClick={() => onResolve("SUCCESS")}>MARK COMPLETED ✓</button><button onClick={() => onResolve("FAILED")}>MISS THE DEADLINE →</button></div></div>
          )}

          {challenge.state === "SUCCESS" && (
            <div className="success-reveal"><span>I DID.</span><h2>The stake stays home.</h2><p>{state.creator.displayName} posted enough proof before day {challenge.durationDays}. The bet closes without revealing the failure path.</p></div>
          )}

          <div className="room-stake"><StakeObject challenge={challenge} compact /><p>The item remains with the maker while the clock runs.</p></div>
        </section>

        <aside className="message-panel">
          <div className="message-title"><span>MAKER LOG</span><strong>Updates, not a streak.</strong><small>At most one note per day. Silence is allowed.</small></div>
          <div className="message-feed">
            {visibleMessages.length === 0 && <p className="empty-feed">No updates yet. Move to day one.</p>}
            {visibleMessages.map((message) => <article key={message.id}><div><span>{state.creator.avatar}</span><strong>{state.creator.displayName}</strong><small>DAY {message.day}</small></div><p>{message.body}</p></article>)}
          </div>
          {challenge.state === "ACTIVE" && (
            <form className="message-composer" onSubmit={(event) => { event.preventDefault(); onPostMessage(draft); setDraft(""); }}>
              <label htmlFor="daily-note">PLAY AS {state.creator.displayName.toUpperCase()} · DAY {state.simulatedDay}</label>
              <textarea id="daily-note" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={state.simulatedDay < 1 || postedToday} maxLength={180} placeholder={state.simulatedDay < 1 ? "Start the clock first." : postedToday ? "Today’s note has already been posted." : "Leave today’s update…"} />
              <div><small>{draft.length}/180</small><button disabled={!draft.trim() || state.simulatedDay < 1 || postedToday}>POST TODAY’S NOTE</button></div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

function OutcomePage({ state, onDefault, onShip, onProfile }: { state: DemoState; onDefault: () => void; onShip: () => void; onProfile: () => void }) {
  const resolved = state.featured.state === "DEFAULTED" || state.featured.state === "SHIPPED";
  const defaulted = state.featured.state === "DEFAULTED";
  const marks = state.featured.leaderboardPlacement?.board === "highest_stakes" ? 10 : 1;
  return (
    <div className="page-wrap outcome-page">
      <div className="outcome-title"><p className="eyebrow">LOST THE BET</p><span className="failed-word">FAILED</span><h1>{state.creator.displayName} missed the deadline.</h1></div>
      {!resolved ? (
        <div className="shipment-card"><div className="shipment-clock"><span>72</span><small>HOURS TO<br />ADD TRACKING</small></div><div className="shipment-copy"><p className="eyebrow">NOW THE STAKE MOVES</p><h2>{state.featured.stake.itemName}<br />→ You</h2><p>The platform doesn’t hold the item. {state.creator.displayName} must ship it directly—or carry the mark.</p><div className="outcome-actions"><button className="primary-action" onClick={onShip}>ADD TRACKING <span>✓</span></button><button className="default-button" onClick={onDefault}>LET 72H EXPIRE <span>+{marks}</span></button></div></div></div>
      ) : (
        <div className={`resolution-card ${defaulted ? "is-default" : "is-shipped"}`}><span className="resolution-kicker">{defaulted ? `UNPAID BET +${marks}` : "PAID UP · TRACKING ADDED"}</span><h2>{defaulted ? "The bet stays. So does the mark." : "The stake is moving."}</h2><p>{defaulted ? `${state.creator.displayName} keeps their identity and history. The next thing they do will carry this mark with it.` : `The ${state.featured.stake.itemName} is on its way to you. No default was recorded.`}</p><button className="dark-action" onClick={onProfile}>SEE {state.creator.displayName.toUpperCase()}’S PROFILE <span>→</span></button></div>
      )}
      <aside className="rule-strip"><b>RULE 04</b> Default is a visible consequence, not a ban.</aside>
    </div>
  );
}

function ProfilePage({ state, onPublishAs }: { state: DemoState; onPublishAs: () => void }) {
  const marked = state.creator.unresolvedDefaults > 0;
  return (
    <div className="page-wrap profile-page">
      <section className="profile-head"><div className="profile-avatar">{state.creator.avatar}</div><div><p className="eyebrow">PUBLIC PROFILE</p><h1>{state.creator.displayName}</h1><p>{state.creator.handle} · {state.creator.bio}</p></div><div className={`default-counter ${marked ? "marked" : "clear"}`}><span>{state.creator.unresolvedDefaults}</span><strong>UNRESOLVED<br />DEFAULT{state.creator.unresolvedDefaults === 1 ? "" : "S"}</strong></div></section>
      <section className="profile-grid">
        <div className="profile-panel aftermath-panel"><p className="eyebrow">WHAT HAPPENS NEXT</p><h2>{marked ? "The identity remains." : "No unresolved marks."}</h2><p>The ledger is public, but the profile is not frozen. Continue as this person and notice where the mark quietly follows.</p><button className="giant-action" onClick={onPublishAs}>PUBLISH AS {state.creator.displayName.toUpperCase()} <span>→</span></button><a className="discussion-link" href={DISCUSSION_URLS.breakRule} target="_blank" rel="noreferrer">FOUND A LOOPHOLE? OPEN THE RULE ↗</a></div>
        <div className="cleansing-panel rules-only"><p className="eyebrow">CLEANING RULE</p><h2>Repayment happens from the other side.</h2><ol><li><b>01</b><span>This user must later be drawn as someone else’s challenger.</span></li><li><b>02</b><span>That maker must fail and default on this user.</span></li><li><b>03</b><span>One unresolved mark is then cleared. A +10 mark takes ten qualifying defaults.</span></li></ol><p>Marks never fall below zero. Historical defaults remain visible after cleaning.</p></div>
      </section>
      <section className="ledger"><div><span>{state.creator.historicalDefaults}</span><small>historical defaults</small></div><div><span>{state.creator.defaultsReceived}</span><small>defaults received</small></div><div><span>{state.creator.unresolvedDefaults}</span><small>unresolved marks now</small></div></section>
    </div>
  );
}

const contributionBriefs = [
  {
    tag: "SYSTEMS",
    title: "Break default cleansing",
    question: "How would two friends manufacture defaults to erase each other’s marks?",
    brief: "Map the smallest collusion loop in V0 default cleaning. Propose one countermeasure and one test that would prove it works without turning a default into a ban.",
    deliverable: "Threat scenario + playable test",
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
    question: "Can a bet be interesting without rewarding rage bait or expensive objects?",
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
        <p>We are not looking for people to “help build a website.” We are looking for people who want to argue with a strange system, break a rule, and carry a promising direction into something durable.</p>
        <a className="join-jump" href="#join">HOW TO JOIN ↓</a>
      </section>

      <section className="lab-principle">
        <span>THE COLLABORATION LOOP</span>
        <div><b>01</b><strong>Pick one uncomfortable rule</strong></div>
        <i>→</i>
        <div><b>02</b><strong>Make the failure concrete</strong></div>
        <i>→</i>
        <div><b>03</b><strong>Shape what should endure</strong></div>
      </section>

      <section className="briefs-section">
        <div className="section-heading"><div><p className="eyebrow">FOUR REAL STARTING POINTS</p><h2>Choose a problem,<br />not a job title.</h2></div><p>Every card is an entry point, not a ceiling. Copy one as a first proposal, then follow the direction as far as useful ownership takes it.</p></div>
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

      <section className="join-section" id="join">
        <div className="join-heading"><p className="eyebrow">HOW TO JOIN</p><h2>Bring one sharp thing.</h2><p>No application form and no invented job title. Start with evidence that you noticed something worth changing.</p></div>
        <div className="join-steps">
          <div><b>01</b><strong>Play one full path</strong><span>Run the clock, choose an outcome, and follow the consequence.</span></div>
          <div><b>02</b><strong>Pick one open edge</strong><span>Use a starter brief above, or name a failure the demo missed.</span></div>
          <div><b>03</b><strong>Make it concrete</strong><span>Bring a proposal, adversarial case, working change, architecture direction, or operating model.</span></div>
          <div><b>04</b><strong>Follow ownership</strong><span>Start a public conversation. If the direction holds, take it beyond the first contribution.</span></div>
        </div>
        <div className="join-actions"><a href={DISCUSSION_URLS.firstImpressions} target="_blank" rel="noreferrer"><small>I NOTICED SOMETHING</small><strong>First impressions</strong><span>Share the moment that changed your mind. ↗</span></a><a href={DISCUSSION_URLS.breakRule} target="_blank" rel="noreferrer"><small>I FOUND A LOOPHOLE</small><strong>Break a rule</strong><span>Make the abuse path concrete. ↗</span></a><a href={DISCUSSION_URLS.shapeSystem} target="_blank" rel="noreferrer"><small>I WANT TO TAKE THIS FURTHER</small><strong>Shape the system</strong><span>Move an open edge toward something durable. ↗</span></a></div>
        <a className="join-channel" href={REPOSITORY_URL} target="_blank" rel="noreferrer"><span>HOME</span><strong>Public GitHub repository + Discussions</strong><small>Open source · no private inbox required ↗</small></a>
      </section>

      <section className="lab-close">
        <span>COME FOR THE DEMO.</span>
        <h2>Stay because the rules are harder than they look.</h2>
        <p>The public repository is open now. Enter through a real question, leave evidence, and stay with the direction if it deserves deeper ownership.</p>
      </section>
    </div>
  );
}

function CreateModal({ identity, onClose, onCreate }: { identity: User; onClose: () => void; onCreate: (durationDays: number, title: string) => void }) {
  const [duration, setDuration] = useState(21);
  const [title, setTitle] = useState("Publish my first public build");
  return (
    <div className="modal-backdrop">
      <div className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <button className="modal-close" onClick={onClose} aria-label="Close create challenge dialog">×</button><p className="eyebrow">MAKE A BET</p><div className="identity-banner"><span>{identity.avatar}</span><div><small>PUBLISHING AS</small><strong>{identity.displayName}</strong></div>{identity.unresolvedDefaults > 0 && <b>{identity.unresolvedDefaults} MARK{identity.unresolvedDefaults === 1 ? "" : "S"}</b>}</div><h2 id="create-title">Put something you love behind something you mean.</h2><label>I BET I CAN<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><fieldset className="duration-picker"><legend>HOW LONG DOES THIS BET RUN?</legend><div>{[7, 14, 21, 30, 60].map((days) => <button type="button" className={duration === days ? "selected" : ""} key={days} onClick={() => setDuration(days)}>{days}<small>DAYS</small></button>)}</div></fieldset><div className="form-split"><label>I’M PUTTING UP<input defaultValue="Nintendo Switch" /></label><label>FIRST ROOM NOTE<input defaultValue="Day one. Scope locked." /></label></div><label>WHAT COUNTS AS DONE?<textarea defaultValue="Public URL, working sign-in, and a timestamped release." /></label><div className="create-rule"><span>01</span> Once matched, the promise, duration, and proof contract lock.</div><button className="giant-action" disabled={!title.trim()} onClick={() => onCreate(duration, title.trim())}>OPEN {duration}-DAY BET <span>→</span></button>
      </div>
    </div>
  );
}
