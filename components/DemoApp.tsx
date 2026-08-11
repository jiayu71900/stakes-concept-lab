"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { Challenge, DemoState, LeaderboardType, User } from "@/domain/models";
import { challenges, createInitialDemoState, creators } from "@/mock/demoData";
import { canChallenge, discoverNext } from "@/engine/discoveryEngine";
import { advanceThrough, transitionChallenge } from "@/engine/challengeStateMachine";
import { recordDefault } from "@/engine/defaultEngine";
import { rankLeaderboard } from "@/engine/leaderboardEngine";
import { loadVisitorArchive, saveVisitorChallenge, saveVisitorChallengerNote, saveVisitorMessage } from "@/lib/visitorArchiveClient";

type DemoView = "discover" | "challenge" | "match" | "outcome" | "profile" | "lab";
type IdentityIntent = "publish" | "join";
const STORAGE_KEY = "bet-i-do-demo-v5";
const VISITOR_IDENTITY_KEY = "bet-i-do-visitor-identity-v1";
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

function creatorFor(challenge: Challenge, pool: User[] = creators) {
  return pool.find((creator) => creator.id === challenge.creatorId) ?? creators[0];
}

function namedVisitor(displayName: string): User {
  const cleanName = displayName.trim().slice(0, 24);
  const initials = cleanName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "VI";
  return {
    id: `visitor-player-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    handle: `@${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "visitor"}`,
    displayName: cleanName,
    avatar: initials,
    bio: "A visitor playing this story.",
    unresolvedDefaults: 0,
    historicalDefaults: 0,
    defaultsReceived: 0,
    refreshesRemaining: 7,
  };
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
    viewer: defaulted.creditor,
    featured: transitionChallenge(failedState.featured, "DEFAULTED"),
    defaultRecords: [defaulted.record],
    lastDefaultSettlement: {
      debtorId: defaulted.debtor.id,
      creditorId: defaulted.creditor.id,
      debtorMarksAdded: defaulted.record.marks,
      creditorMarksBefore: failedState.viewer.unresolvedDefaults,
      creditorMarksAfter: defaulted.creditor.unresolvedDefaults,
      cleanedMarks: defaulted.cleanedMarks,
    },
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
  const [createIdentity, setCreateIdentity] = useState<User | null>(null);
  const [visitorIdentity, setVisitorIdentity] = useState<User | null>(null);
  const [nameRequest, setNameRequest] = useState<{ intent: IdentityIntent } | null>(null);
  const [publisherMode, setPublisherMode] = useState(false);
  const [profileIdentityId, setProfileIdentityId] = useState<string | null>(null);
  const [visitorChallenges, setVisitorChallenges] = useState<Challenge[]>([]);
  const [visitorCreators, setVisitorCreators] = useState<User[]>([]);
  const [archiveSaved, setArchiveSaved] = useState(false);
  const [seenDiscoveryIds, setSeenDiscoveryIds] = useState<string[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const savedVisitorIdentity = window.localStorage.getItem(VISITOR_IDENTITY_KEY);
      let knownVisitor: User | null = null;
      if (savedVisitorIdentity) {
        try {
          knownVisitor = JSON.parse(savedVisitorIdentity) as User;
          setVisitorIdentity(knownVisitor);
        } catch {
          window.localStorage.removeItem(VISITOR_IDENTITY_KEY);
        }
      }
      if (saved) {
        try {
          const restored = JSON.parse(saved) as DemoState;
          setState(restored);
          if (!knownVisitor && restored.viewer.id.startsWith("visitor-player-")) {
            knownVisitor = restored.viewer;
            setVisitorIdentity(restored.viewer);
            window.localStorage.setItem(VISITOR_IDENTITY_KEY, JSON.stringify(restored.viewer));
          }
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } else if (knownVisitor) {
        setState((current) => ({ ...current, viewer: { ...knownVisitor, refreshesRemaining: current.viewer.refreshesRemaining } }));
      }
      setView(pathToView(window.location.pathname));
      setHydrated(true);
    });
    const onPopState = () => setView(pathToView(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadVisitorArchive().then((archive) => {
      if (cancelled) return;
      setVisitorChallenges(archive.challenges);
      setVisitorCreators(archive.creators);
      setState((current) => {
        const messageIds = new Set(current.messages.map((message) => message.id));
        return { ...current, messages: [...current.messages, ...archive.messages.filter((message) => !messageIds.has(message.id))] };
      });
    }).catch(() => undefined);
    return () => { cancelled = true; };
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

  const availableChallenges = useMemo(() => [...challenges, ...visitorChallenges], [visitorChallenges]);
  const availableCreators = useMemo(() => [...creators, ...visitorCreators], [visitorCreators]);
  const currentDiscovery = availableChallenges[state.discoveryIndex] ?? availableChallenges[0];
  const findCreator = (challenge: Challenge) => creatorFor(challenge, availableCreators);
  const leaderboards = useMemo(() => {
    const allUsers = availableCreators.map((creator) => creator.id === state.creator.id ? state.creator : creator);
    return (["highest_stakes", "most_watched", "most_interesting"] as const).map((board) => ({
      board,
      entries: rankLeaderboard(availableChallenges, allUsers, board).slice(0, 3),
    }));
  }, [availableChallenges, availableCreators, state.creator]);

  const openChallenge = (challenge: Challenge) => {
    setPublisherMode(false);
    setState((current) => ({
      ...current,
      featured: structuredClone(challenge),
      creator: { ...findCreator(challenge) },
      joined: false,
      simulatedDay: 0,
      lastEvent: current.lastEvent === "CREATED" ? "CREATED" : "READY",
    }));
    navigate("challenge");
  };

  const refreshDiscovery = () => {
    if (state.viewer.refreshesRemaining <= 0) return;
    const currentSeen = [...new Set([...seenDiscoveryIds, currentDiscovery.id])];
    let next = discoverNext(
      availableChallenges,
      state.viewer,
      { seenChallengeIds: currentSeen, refreshesRemaining: state.viewer.refreshesRemaining },
      Math.random,
      { includeOwn: true },
    );
    if (!next.challenge) {
      next = discoverNext(
        availableChallenges,
        state.viewer,
        { seenChallengeIds: [currentDiscovery.id], refreshesRemaining: state.viewer.refreshesRemaining },
        Math.random,
        { includeOwn: true },
      );
    }
    if (!next.challenge) return;
    const nextIndex = availableChallenges.findIndex((challenge) => challenge.id === next.challenge?.id);
    setSeenDiscoveryIds(next.session.seenChallengeIds);
    setState((current) => ({
      ...current,
      discoveryIndex: nextIndex,
      viewer: { ...current.viewer, refreshesRemaining: next.session.refreshesRemaining },
    }));
  };

  const createChallenge = async (durationDays: number, title: string, stakeName: string, firstMessage: string, shareWithFutureVisitors: boolean) => {
    const identity = createIdentity ?? state.viewer;
    const localDraft: Challenge = {
      ...structuredClone(challenges[0]),
      id: `local-${Date.now()}`,
      slug: "visitor-bet",
      creatorId: identity.id,
      title,
      state: "DRAFT",
      durationDays,
      daysRemaining: durationDays,
      stake: {
        ...structuredClone(challenges[0].stake),
        id: `local-stake-${Date.now()}`,
        itemName: stakeName,
        estimatedValue: 0,
        condition: "Declared by visitor",
        ownershipVerified: false,
        glyph: "VI",
      },
      entrantCount: 0,
      watchers: 0,
      ownedByCurrentVisitor: true,
    };
    let opened = transitionChallenge(localDraft, "OPEN");
    let publishedCreator = identity;
    let archivedMessage = firstMessage.trim() ? { id: `local-message-${Date.now()}`, challengeId: opened.id, authorId: identity.id, day: 1, body: firstMessage.trim(), kind: "CREATOR_UPDATE" as const } : null;
    setArchiveSaved(false);
    if (shareWithFutureVisitors) {
      try {
        const archived = await saveVisitorChallenge({ creatorName: identity.displayName, title, durationDays, stakeName, firstMessage });
        opened = archived.challenge;
        publishedCreator = {
          ...archived.creator,
          avatar: identity.avatar,
          bio: identity.bio,
          unresolvedDefaults: identity.unresolvedDefaults,
          historicalDefaults: identity.historicalDefaults,
          defaultsReceived: identity.defaultsReceived,
        };
        archivedMessage = archived.message;
        setVisitorChallenges((current) => [archived.challenge, ...current.filter((challenge) => challenge.id !== archived.challenge.id)]);
        setVisitorCreators((current) => [publishedCreator, ...current.filter((creator) => creator.id !== publishedCreator.id)]);
        setArchiveSaved(true);
      } catch {
        // The playable local path remains available when the archive is temporarily unavailable.
      }
    }
    setState((current) => ({
      ...current,
      creator: publishedCreator,
      viewer: { ...publishedCreator },
      featured: opened,
      joined: false,
      simulatedDay: 0,
      messages: archivedMessage ? [...current.messages.filter((message) => message.id !== archivedMessage?.id), archivedMessage] : current.messages,
      createdChallenge: true,
      lastEvent: "CREATED",
    }));
    setPublisherMode(true);
    setShowCreatedToast(true);
    setCreateOpen(false);
    navigate("challenge");
  };

  const joinChallenge = (identity: User) => {
    if (state.featured.state !== "OPEN") return;
    setState((current) => ({
      ...current,
      viewer: { ...identity, refreshesRemaining: current.viewer.refreshesRemaining },
      joined: true,
      featured: {
        ...current.featured,
        entrantCount: current.featured.entrantCount + 1,
        entrantIds: [...current.featured.entrantIds, identity.id],
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
    if (state.featured.id.startsWith("visitor-")) {
      void saveVisitorMessage({ challengeId: state.featured.id, day: state.simulatedDay, body: text }).catch(() => undefined);
    }
  };

  const postChallengerNote = async (day: number, body: string) => {
    const text = body.trim();
    const alreadyPosted = state.messages.some((message) => message.challengeId === state.featured.id && message.kind === "CHALLENGER_NOTE" && message.ownedByCurrentVisitor);
    if (!text || alreadyPosted || day < 1 || day > state.featured.durationDays) return { ok: false, message: "One challenger message is allowed for this challenge." };
    let note = {
      id: `local-challenger-note-${Date.now()}`,
      challengeId: state.featured.id,
      authorId: state.viewer.id,
      authorName: state.viewer.displayName,
      day,
      body: text,
      kind: "CHALLENGER_NOTE" as const,
      ownedByCurrentVisitor: true,
    };
    if (!state.featured.id.startsWith("local-")) {
      try {
        note = await saveVisitorChallengerNote({ challengeId: state.featured.id, authorName: state.viewer.displayName, day, body: text });
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "This message could not be saved." };
      }
    }
    setState((current) => ({ ...current, messages: [...current.messages, note] }));
    return { ok: true, message: state.featured.id.startsWith("local-") ? `Your message now lives on day ${day} in this session.` : `Your message now lives on day ${day} for future challengers.` };
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
        viewer: result.creditor,
        featured: transitionChallenge(current.featured, "DEFAULTED"),
        defaultRecords: [...current.defaultRecords, result.record],
        lastDefaultSettlement: {
          debtorId: result.debtor.id,
          creditorId: result.creditor.id,
          debtorMarksAdded: result.record.marks,
          creditorMarksBefore: current.viewer.unresolvedDefaults,
          creditorMarksAfter: result.creditor.unresolvedDefaults,
          cleanedMarks: result.cleanedMarks,
        },
        lastEvent: "DEFAULTED",
      };
    });
  };

  const resetDemo = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    const reset = createInitialDemoState();
    setState(visitorIdentity ? { ...reset, viewer: { ...visitorIdentity, refreshesRemaining: reset.viewer.refreshesRemaining } } : reset);
    setCreateIdentity(null);
    setSeenDiscoveryIds([]);
    setShowCreatedToast(false);
    navigate("discover");
  };

  const challengeAsProfile = (identity: User) => {
    if (identity.id.startsWith("visitor-player-")) {
      window.localStorage.setItem(VISITOR_IDENTITY_KEY, JSON.stringify(identity));
      setVisitorIdentity(identity);
    }
    setState((current) => {
      const base = createInitialDemoState();
      const nextIndex = availableChallenges.findIndex((challenge) => challenge.creatorId !== identity.id);
      const discoveryIndex = nextIndex >= 0 ? nextIndex : 0;
      const nextChallenge = structuredClone(availableChallenges[discoveryIndex]);
      const seededMessageIds = new Set(base.messages.map((message) => message.id));
      return {
        ...base,
        viewer: { ...identity },
        creator: { ...findCreator(nextChallenge) },
        featured: nextChallenge,
        discoveryIndex,
        defaultRecords: current.defaultRecords,
        messages: [...base.messages, ...current.messages.filter((message) => !seededMessageIds.has(message.id))],
        lastEvent: "READY",
      };
    });
    setProfileIdentityId(null);
    navigate("discover");
  };

  const continueWithIdentity = (identity: User, intent: IdentityIntent) => {
    setNameRequest(null);
    if (intent === "publish") {
      setCreateIdentity(identity);
      setCreateOpen(true);
      return;
    }
    joinChallenge(identity);
  };

  const requestVisitorIdentity = (intent: IdentityIntent) => {
    const identity = state.viewer.id === "you" ? visitorIdentity : state.viewer;
    if (identity) {
      continueWithIdentity(identity, intent);
      return;
    }
    setNameRequest({ intent });
  };

  const saveFirstVisitorName = (displayName: string) => {
    const identity = namedVisitor(displayName);
    window.localStorage.setItem(VISITOR_IDENTITY_KEY, JSON.stringify(identity));
    setVisitorIdentity(identity);
    continueWithIdentity(identity, nameRequest?.intent ?? "join");
  };

  const openProfile = (identityId: string) => {
    setProfileIdentityId(identityId);
    navigate("profile");
  };

  const profileStatusIdentity = profileIdentityId === state.viewer.id ? state.viewer : state.creator;
  const knownVisitorIdentity = visitorIdentity ?? (state.viewer.id.startsWith("visitor-player-") ? state.viewer : null);
  const profileIdentity = knownVisitorIdentity ? {
    ...knownVisitorIdentity,
    unresolvedDefaults: profileStatusIdentity.unresolvedDefaults,
    historicalDefaults: profileStatusIdentity.historicalDefaults,
    defaultsReceived: profileStatusIdentity.defaultsReceived,
  } : profileStatusIdentity;

  const publishAsProfile = (identity: User) => {
    if (identity.id.startsWith("visitor-player-")) {
      window.localStorage.setItem(VISITOR_IDENTITY_KEY, JSON.stringify(identity));
      setVisitorIdentity(identity);
    }
    setCreateIdentity(identity);
    setCreateOpen(true);
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
          <button className="make-button" onClick={() => requestVisitorIdentity("publish")}>+ Make a bet</button>
        </nav>
      </header>

      {view !== "lab" && <div className="session-bar"><span>PLAYABLE BET</span><p>Pull a stranger’s promise. Decide whether you believe it.</p><button onClick={resetDemo}>Restart story</button></div>}

      {showCreatedToast && (
        <div className="event-toast" role="status">
          <button onClick={() => setShowCreatedToast(false)} aria-label="Dismiss notification">×</button>
          <span>{archiveSaved ? "SAVED TO THE VISITOR ARCHIVE" : "BET IS OPEN"}</span>{archiveSaved ? "Future visitors can now discover this bet and its updates." : "Your bet is open in this local story."}
        </div>
      )}

      {view === "discover" && (
        <DiscoverPage challenge={currentDiscovery} creator={findCreator(currentDiscovery)} refreshes={state.viewer.refreshesRemaining} leaderboards={leaderboards} onRefresh={refreshDiscovery} onOpen={openChallenge} />
      )}
      {view === "challenge" && (
        publisherMode ? <PublisherChallengePage challenge={state.featured} creator={state.creator} archiveSaved={archiveSaved} onViewPublic={() => setPublisherMode(false)} onDiscover={() => navigate("discover")} /> : <ChallengePage challenge={state.featured} creatorName={state.creator.displayName} joined={state.joined} canJoin={canChallenge(state.featured, state.viewer)} messages={state.messages} onJoin={() => requestVisitorIdentity("join")} onSelect={simulateSelection} />
      )}
      {view === "match" && <MatchPage state={state} onStart={startChallenge} onAdvance={advanceDays} onResolve={resolveChallenge} onPostMessage={postDailyMessage} onPostChallengerNote={postChallengerNote} />}
      {view === "outcome" && <OutcomePage state={state} onDefault={simulateDefault} onShip={simulateShipment} onProfile={openProfile} />}
      {view === "profile" && <ProfilePage state={state} user={profileIdentity} statusIdentityId={profileStatusIdentity.id} onPublishAs={publishAsProfile} onChallengeAs={challengeAsProfile} />}
      {view === "lab" && <LabPage copiedBrief={copiedBrief} onCopy={copyBrief} />}

      <footer className="footer">
        <div><strong>Small human core. AI-augmented by default.</strong><span>Building a stranger kind of bet in the open.</span></div>
        <button onClick={() => navigate("lab")}>Build with us →</button>
      </footer>

      {nameRequest && <NameEntryModal intent={nameRequest.intent} onClose={() => setNameRequest(null)} onChoose={saveFirstVisitorName} />}
      {createOpen && <CreateModal identity={createIdentity ?? state.viewer} onClose={() => setCreateOpen(false)} onCreate={createChallenge} />}
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

function DiscoverPage({ challenge, creator, refreshes, leaderboards, onRefresh, onOpen }: {
  challenge: Challenge;
  creator: User;
  refreshes: number;
  leaderboards: { board: LeaderboardType; entries: ReturnType<typeof rankLeaderboard> }[];
  onRefresh: () => void;
  onOpen: (challenge: Challenge) => void;
}) {
  const highStakes = challenge.leaderboardPlacement?.board === "highest_stakes";
  const ownBet = challenge.ownedByCurrentVisitor === true;
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
          <div className="card-topline">
            <div className="stack-label"><span>RANDOM BET</span><b>{8 - refreshes} / 7</b></div>
            <div className="creator-chip"><span>{creator.avatar}</span><div>{ownBet ? "YOUR BET" : creator.handle}{challenge.archiveEntry && <small>VISITOR ARCHIVE</small>}</div></div>
            <div className="timer"><i /> {challenge.daysRemaining} days left</div>
          </div>
          <div className="bet-card-main">
            <div className="card-copy"><p>I BET I CAN</p><h2>{challenge.title}.</h2><p className="promise">{challenge.promise}</p></div>
            <div className="card-stake-panel">
              <small>WHAT’S ON THE LINE</small>
              <StakeObject challenge={challenge} />
              {challenge.leaderboardPlacement && (
                <div className={`leaderboard-callout ${highStakes ? "danger" : ""}`}>
                  <span>{highStakes ? "×10" : `#${challenge.leaderboardPlacement.rank}`}</span>
                  <div><strong>{boardLabels[challenge.leaderboardPlacement.board]}</strong><small>{highStakes ? "Defaulting here costs 10 marks." : "Leaderboard discovery is earned, not searched."}</small></div>
                </div>
              )}
              <div className="card-social-proof"><span><strong>{challenge.entrantCount}</strong> challengers</span><span><strong>{challenge.watchers}</strong> watching</span></div>
            </div>
          </div>
          <div className="card-footer"><div className="card-actions"><button className="primary-action" onClick={() => onOpen(challenge)}>{ownBet ? "Open your bet" : `Bet ${creator.displayName} won’t`} <span>↗</span></button><button className="shuffle-button" onClick={onRefresh} disabled={refreshes === 0} aria-label="Show another random bet"><span>↻</span> Pass</button></div><span className="refresh-count"><strong>{refreshes}</strong> pulls left today</span></div>
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

function PublisherChallengePage({ challenge, creator, archiveSaved, onViewPublic, onDiscover }: { challenge: Challenge; creator: User; archiveSaved: boolean; onViewPublic: () => void; onDiscover: () => void }) {
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
        <div className="publisher-next"><div><small>{archiveSaved ? "LIVE IN RANDOM DISCOVER NOW" : "THIS SESSION ONLY"}</small><strong>{archiveSaved ? "Your bet has joined the random pool." : "This bet was not added to the visitor archive."}</strong><p>{archiveSaved ? "It may appear on any visitor’s next pull—including yours. You can inspect its messages, but you cannot challenge yourself." : "Updates open after a challenger is drawn. The maker may post at most one note per day."}</p></div><div className="publisher-actions"><button className="giant-action" onClick={onViewPublic}>VIEW PUBLIC BET <span>→</span></button>{archiveSaved && <button className="giant-action secondary-publisher-action" onClick={onDiscover}>TRY RANDOM DISCOVER <span>↻</span></button>}</div></div>
      </section>
    </div>
  );
}

function ChallengePage({ challenge, creatorName, joined, canJoin, messages, onJoin, onSelect }: { challenge: Challenge; creatorName: string; joined: boolean; canJoin: boolean; messages: DemoState["messages"]; onJoin: () => void; onSelect: () => void }) {
  const roomMessages = messages
    .filter((message) => message.challengeId === challenge.id)
    .toSorted((a, b) => a.day - b.day);
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
          <div className="public-room-history">
            <div><b>{challenge.ownedByCurrentVisitor ? "YOUR BET · WATCH-ONLY" : "ROOM HISTORY"}</b><span>{roomMessages.length} MESSAGE{roomMessages.length === 1 ? "" : "S"}</span></div>
            {roomMessages.length === 0 ? <p>No messages have been left in this room yet.</p> : roomMessages.map((message) => {
              const challengerMessage = message.kind === "CHALLENGER_NOTE";
              const authorName = challengerMessage ? message.authorName ?? "Past challenger" : creatorName;
              return <article key={message.id} className={challengerMessage ? "challenger-history-note" : "maker-history-note"}><small>{challengerMessage ? "CHALLENGER" : "MAKER"} · DAY {message.day}</small><strong>{authorName}</strong><p>{message.body}</p></article>;
            })}
          </div>
          <div className="entry-how"><b>BET THEY WON’T</b><span>Enter before the window closes. One challenger is drawn from everyone inside.</span></div>
          {!joined ? <button className="giant-action" disabled={!canJoin} onClick={onJoin}>{canJoin ? "TAKE THE OTHER SIDE" : "YOU MADE THIS BET"} <span>{canJoin ? "→" : "·"}</span></button> : (
            <div className="joined-panel"><span className="joined-check">✓</span><h3>You’re in.</h3><p>{challenge.entrantCount} people entered. One challenger will be selected when the window closes.</p><button className="giant-action" onClick={onSelect}>CLOSE ENTRY &amp; DRAW <span>→</span></button></div>
          )}
          {!canJoin && !joined && <p className="fine-print self-entry-note">This is your bet. You can read its room history, but one identity cannot make and challenge the same bet.</p>}
          <p className="fine-print">No money changes hands. What the system does at the deadline is revealed only after the match begins.</p>
        </section>
      </div>
    </div>
  );
}

function MatchPage({ state, onStart, onAdvance, onResolve, onPostMessage, onPostChallengerNote }: {
  state: DemoState;
  onStart: () => void;
  onAdvance: (days: number) => void;
  onResolve: (result: "SUCCESS" | "FAILED") => void;
  onPostMessage: (body: string) => void;
  onPostChallengerNote: (day: number, body: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const [draft, setDraft] = useState("");
  const [challengerDraft, setChallengerDraft] = useState("");
  const [challengerDay, setChallengerDay] = useState(() => Math.max(1, Math.round(state.featured.durationDays / 2)));
  const [challengerStatus, setChallengerStatus] = useState("");
  const [postingChallengerNote, setPostingChallengerNote] = useState(false);
  const challenge = state.featured;
  const visibleMessages = state.messages
    .filter((message) => message.challengeId === challenge.id && message.day <= state.simulatedDay)
    .toSorted((a, b) => a.day - b.day);
  const postedToday = state.messages.some((message) => message.challengeId === challenge.id && message.kind === "CREATOR_UPDATE" && message.authorId === state.creator.id && message.day === state.simulatedDay);
  const myChallengerNote = state.messages.find((message) => message.challengeId === challenge.id && message.kind === "CHALLENGER_NOTE" && message.ownedByCurrentVisitor);
  const playingAsMaker = state.viewer.id === state.creator.id;
  const progress = Math.round((state.simulatedDay / challenge.durationDays) * 100);
  const roomStarted = challenge.state !== "MATCHED";

  if (!roomStarted) {
    return (
      <div className="match-page">
        <div className="match-burst burst-one" /><div className="match-burst burst-two" /><p className="eyebrow">BET ACCEPTED</p><div className="selected-stamp">YOU WERE SELECTED</div>
        <div className="versus"><div className="fighter"><span>{state.creator.avatar}</span><h2>{state.creator.displayName}</h2><p>MAKER</p></div><div className="vs-mark">VS</div><div className="fighter you"><span>{state.viewer.avatar}</span><h2>{state.viewer.displayName}</h2><p>CHALLENGER</p></div></div>
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
          <div className="room-stats"><span><b>{challenge.durationDays - state.simulatedDay}</b> days left</span><span><b>{progress}%</b> elapsed</span><span><b>{visibleMessages.length}</b> room messages</span></div>

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
          <div className="message-title"><span>ROOM HISTORY</span><strong>The conversation travels.</strong><small>Makers may post once each day. Every challenger may leave one message on one chosen day.</small></div>
          <div className="message-feed">
            {visibleMessages.length === 0 && <p className="empty-feed">No updates yet. Move to day one.</p>}
            {visibleMessages.map((message) => {
              const challengerMessage = message.kind === "CHALLENGER_NOTE";
              const authorName = challengerMessage ? message.authorName ?? "Past challenger" : state.creator.displayName;
              const avatar = challengerMessage ? authorName.slice(0, 2).toUpperCase() : state.creator.avatar;
              return <article className={challengerMessage ? "challenger-bubble" : "maker-bubble"} key={message.id}><div><span>{avatar}</span><strong>{authorName}</strong><small>{challengerMessage ? "CHALLENGER · " : "MAKER · "}DAY {message.day}</small></div><p>{message.body}</p></article>;
            })}
          </div>
          {challenge.state === "ACTIVE" && playingAsMaker && (
            <form className="message-composer" onSubmit={(event) => { event.preventDefault(); onPostMessage(draft); setDraft(""); }}>
              <label htmlFor="daily-note">MAKER · {state.creator.displayName.toUpperCase()} · DAY {state.simulatedDay}</label>
              {challenge.id.startsWith("visitor-") && <p className="archive-message-notice">YOUR STORY CAN TRAVEL · This note may appear with your challenge when future visitors discover it.</p>}
              <textarea id="daily-note" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={state.simulatedDay < 1 || postedToday} maxLength={180} placeholder={state.simulatedDay < 1 ? "Start the clock first." : postedToday ? "Today’s note has already been posted." : "Leave today’s update…"} />
              <div><small>{draft.length}/180</small><button disabled={!draft.trim() || state.simulatedDay < 1 || postedToday}>POST TODAY’S NOTE</button></div>
            </form>
          )}
          {!playingAsMaker && (
            <form className="challenger-composer" onSubmit={async (event) => {
              event.preventDefault();
              setPostingChallengerNote(true);
              const result = await onPostChallengerNote(challengerDay, challengerDraft);
              setPostingChallengerNote(false);
              setChallengerStatus(result.message);
              if (result.ok) setChallengerDraft("");
            }}>
              <span className="challenger-composer-tag">ONE MESSAGE · YOUR CHOSEN DAY</span>
              <h3>{myChallengerNote ? "Your voice is now part of this room." : `What would ${state.viewer.displayName} leave behind?`}</h3>
              {myChallengerNote ? (
                <div className="saved-challenger-note"><b>DAY {myChallengerNote.day}</b><p>“{myChallengerNote.body}”</p><small>Future challengers can find it in this room’s history.</small></div>
              ) : (
                <>
                  <label htmlFor="challenger-day">PLACE IT ON DAY <b>{challengerDay}</b></label>
                  <input id="challenger-day" type="range" min="1" max={challenge.durationDays} value={challengerDay} onChange={(event) => setChallengerDay(Number(event.target.value))} />
                  <div className="day-range-labels"><span>DAY 1</span><span>DAY {challenge.durationDays}</span></div>
                  <textarea value={challengerDraft} onChange={(event) => setChallengerDraft(event.target.value)} maxLength={180} placeholder="Leave one line for the maker—and for whoever challenges them next…" />
                  <p>Your chosen name and this message will appear in the room’s shared history.</p>
                  <button disabled={postingChallengerNote || challengerDraft.trim().length < 2}>{postingChallengerNote ? "ADDING YOUR VOICE…" : "LEAVE IT IN THE ROOM →"}</button>
                </>
              )}
              {challengerStatus && <small className="challenger-status" role="status">{challengerStatus}</small>}
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

function OutcomePage({ state, onDefault, onShip, onProfile }: { state: DemoState; onDefault: () => void; onShip: () => void; onProfile: (identityId: string) => void }) {
  const resolved = state.featured.state === "DEFAULTED" || state.featured.state === "SHIPPED";
  const defaulted = state.featured.state === "DEFAULTED";
  const marks = state.featured.leaderboardPlacement?.board === "highest_stakes" ? 10 : 1;
  const settlement = state.lastDefaultSettlement;
  const cleanedVisitorMark = (settlement?.cleanedMarks ?? 0) > 0;
  const markedVisitorAfterShipment = state.viewer.unresolvedDefaults > 0;
  return (
    <div className="page-wrap outcome-page">
      <div className="outcome-title"><p className="eyebrow">LOST THE BET</p><span className="failed-word">FAILED</span><h1>{state.creator.displayName} missed the deadline.</h1></div>
      {!resolved ? (
        <div className="shipment-card"><div className="shipment-clock"><span>72</span><small>HOURS TO<br />ADD TRACKING</small></div><div className="shipment-copy"><p className="eyebrow">NOW THE STAKE MOVES</p><h2>{state.featured.stake.itemName}<br />→ You</h2><p>The platform doesn’t hold the item. {state.creator.displayName} must ship it directly—or carry the mark.</p><div className="outcome-actions"><button className="primary-action" onClick={onShip}>ADD TRACKING <span>✓</span></button><button className="default-button" onClick={onDefault}>LET 72H EXPIRE <span>+{marks}</span></button></div></div></div>
      ) : defaulted ? (
        <div className="resolution-card is-default">
          <span className="resolution-kicker">UNPAID BET +{settlement?.debtorMarksAdded ?? marks}</span>
          <h2>One default. Two different consequences.</h2>
          <p>{cleanedVisitorMark ? `${state.viewer.displayName} was already marked. Receiving this default cleans one unresolved mark.` : `${state.creator.displayName} receives the new mark. Continue the story under your own name with that marked state.`}</p>
          <div className="settlement-ledger">
            <div><small>MAKER · DEFAULTED</small><strong>{state.creator.displayName}</strong><span>+{settlement?.debtorMarksAdded ?? marks} unresolved</span></div>
            <div className={settlement?.cleanedMarks ? "is-cleaned" : ""}><small>SELECTED CHALLENGER · RECEIVED DEFAULT</small><strong>{state.viewer.displayName}</strong><span>{settlement?.creditorMarksBefore ?? state.viewer.unresolvedDefaults} → {settlement?.creditorMarksAfter ?? state.viewer.unresolvedDefaults} unresolved</span></div>
          </div>
          <div className="resolution-profile-actions">
            <button className="dark-action" onClick={() => onProfile(cleanedVisitorMark ? state.viewer.id : state.creator.id)}>{cleanedVisitorMark ? "CONTINUE · 1 MARK CLEANED" : "CONTINUE AS A MARKED USER"} <span>→</span></button>
          </div>
        </div>
      ) : (
        <div className="resolution-card is-shipped"><span className="resolution-kicker">PAID UP · TRACKING ADDED</span><h2>The stake is moving.</h2><p>The {state.featured.stake.itemName} is on its way to {state.viewer.displayName}. No default was recorded, so the challenger’s existing mark count does not change.</p><button className="dark-action" onClick={() => onProfile(state.viewer.id)}>CONTINUE AS {markedVisitorAfterShipment ? "A MARKED USER" : "AN UNMARKED USER"} <span>→</span></button></div>
      )}
      <aside className="rule-strip"><b>RULE 04</b> Default is a visible consequence, not a ban.</aside>
    </div>
  );
}

function ProfilePage({ state, user, statusIdentityId, onPublishAs, onChallengeAs }: { state: DemoState; user: User; statusIdentityId: string; onPublishAs: (identity: User) => void; onChallengeAs: (identity: User) => void }) {
  const marked = user.unresolvedDefaults > 0;
  const settlement = state.lastDefaultSettlement;
  const justCleaned = settlement?.creditorId === statusIdentityId && settlement.cleanedMarks > 0;
  const statusLabel = marked ? "A MARKED USER" : "AN UNMARKED USER";
  return (
    <div className="page-wrap profile-page">
      {justCleaned && <section className="cleansed-banner"><div><span>DEFAULT RECEIVED</span><strong>One unresolved mark was cleaned.</strong></div><div className="zero-change"><span>{settlement.creditorMarksBefore}</span> → {settlement.creditorMarksAfter}</div></section>}
      <section className="profile-head"><div className="profile-avatar">{user.avatar}</div><div><p className="eyebrow">PUBLIC PROFILE</p><h1>{user.displayName}</h1><p>{user.handle} · {user.bio}</p></div><div className={`default-counter ${marked ? "marked" : "clear"}`}><span>{user.unresolvedDefaults}</span><strong>UNRESOLVED<br />DEFAULT{user.unresolvedDefaults === 1 ? "" : "S"}</strong></div></section>
      <section className="profile-grid">
        <div className="profile-panel aftermath-panel"><p className="eyebrow">WHAT HAPPENS NEXT</p><h2>{marked ? "Your name stays. The mark travels with it." : justCleaned ? "The history remains. The mark does not." : "Your name stays. No mark follows."}</h2><p>You remain {user.displayName}. The outcome changes the visible mark count, not the person behind it.</p><div className="identity-actions"><button className="giant-action" onClick={() => onPublishAs(user)}>PUBLISH AS {statusLabel} <span>→</span></button><button className="giant-action secondary-identity-action" onClick={() => onChallengeAs(user)}>CHALLENGE AS {statusLabel} <span>→</span></button></div><small className="identity-action-note">Your chosen name stays fixed. Only choosing to default creates a mark.</small><a className="discussion-link" href={DISCUSSION_URLS.breakRule} target="_blank" rel="noreferrer">FOUND A LOOPHOLE? OPEN THE RULE ↗</a></div>
        <div className="cleansing-panel rules-only"><p className="eyebrow">CLEANING RULE</p><h2>Repayment happens from the other side.</h2><ol><li><b>01</b><span>This user must later be drawn as someone else’s challenger.</span></li><li><b>02</b><span>That maker must fail and default on this user.</span></li><li><b>03</b><span>One unresolved mark is then cleared. A +10 mark takes ten qualifying defaults.</span></li></ol><p>Marks never fall below zero. Historical defaults remain visible after cleaning.</p></div>
      </section>
      <section className="ledger"><div><span>{user.historicalDefaults}</span><small>historical defaults</small></div><div><span>{user.defaultsReceived}</span><small>defaults received</small></div><div><span>{user.unresolvedDefaults}</span><small>unresolved marks now</small></div></section>
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

function NameEntryModal({ intent, onClose, onChoose }: { intent: IdentityIntent; onClose: () => void; onChoose: (displayName: string) => void }) {
  const [visitorName, setVisitorName] = useState("");
  const actionLabel = intent === "publish" ? "PUBLISH MY BET" : "TAKE THE OTHER SIDE";
  return (
    <div className="modal-backdrop">
      <div className="name-entry-modal" role="dialog" aria-modal="true" aria-labelledby="name-entry-title">
        <button className="modal-close" onClick={onClose} aria-label="Close name entry">×</button>
        <span className="name-entry-tag">ONE NAME · THIS WHOLE STORY</span>
        <p className="eyebrow">ENTER THE WORLD</p>
        <h2 id="name-entry-title">What should this room call you?</h2>
        <p>Choose once. This is the name that will appear when you challenge, publish, and leave a message later. You will not be asked to rename yourself after the outcome.</p>
        <label htmlFor="visitor-name">YOUR DISPLAY NAME</label>
        <input id="visitor-name" value={visitorName} maxLength={24} onChange={(event) => setVisitorName(event.target.value)} placeholder="For example: River" />
        <button disabled={visitorName.trim().length < 2} onClick={() => onChoose(visitorName)}>{actionLabel} AS {visitorName.trim().toUpperCase() || "…"} →</button>
        <small>New visitors begin with 0 unresolved marks. Only a later default can change that.</small>
      </div>
    </div>
  );
}

function CreateModal({ identity, onClose, onCreate }: { identity: User; onClose: () => void; onCreate: (durationDays: number, title: string, stakeName: string, firstMessage: string, shareWithFutureVisitors: boolean) => Promise<void> }) {
  const [duration, setDuration] = useState(21);
  const [title, setTitle] = useState("Publish my first public build");
  const [stakeName, setStakeName] = useState("Nintendo Switch");
  const [firstMessage, setFirstMessage] = useState("Day one. Scope locked.");
  const [archiveChoice, setArchiveChoice] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const handleCreate = async () => {
    if (saving || archiveChoice === null || !title.trim() || !stakeName.trim()) return;
    setSaving(true);
    await onCreate(duration, title.trim(), stakeName.trim(), firstMessage.trim(), archiveChoice);
  };
  return (
    <div className="modal-backdrop">
      <div className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <button className="modal-close" onClick={onClose} aria-label="Close create challenge dialog">×</button><p className="eyebrow">MAKE A BET</p><div className="identity-banner"><span>{identity.avatar}</span><div><small>PUBLISHING AS</small><strong>{identity.displayName}</strong></div>{identity.unresolvedDefaults > 0 && <b>{identity.unresolvedDefaults} MARK{identity.unresolvedDefaults === 1 ? "" : "S"}</b>}</div><h2 id="create-title">Put something you love behind something you mean.</h2><label>I BET I CAN<input value={title} maxLength={72} onChange={(event) => setTitle(event.target.value)} /></label><fieldset className="duration-picker"><legend>HOW LONG DOES THIS BET RUN?</legend><div>{[7, 14, 21, 30, 60].map((days) => <button type="button" className={duration === days ? "selected" : ""} key={days} onClick={() => setDuration(days)}>{days}<small>DAYS</small></button>)}</div></fieldset><div className="form-split"><label>I’M PUTTING UP<input value={stakeName} maxLength={48} onChange={(event) => setStakeName(event.target.value)} /></label><label>FIRST ROOM NOTE<input value={firstMessage} maxLength={180} onChange={(event) => setFirstMessage(event.target.value)} /></label></div><label>WHAT COUNTS AS DONE?<textarea defaultValue="Public URL, working sign-in, and a timestamped release." /></label><div className="create-rule"><span>01</span><div>Once matched, the promise, duration, and proof contract lock.</div></div>
        <section className="archive-invitation" aria-labelledby="archive-invitation-title">
          <span className="archive-spark">PASS IT ON</span>
          <h3 id="archive-invitation-title">Would you like future visitors to discover your challenge?</h3>
          <p>Let your promise become part of the world: people may pull it from Discover, follow your updates, and decide whether they would take you on.</p>
          <small>Only the challenge and room notes are saved anonymously—never your real name, contact details, address, payment, or shipping information.</small>
          <div className="archive-choice">
            <button type="button" className={archiveChoice === true ? "selected" : ""} onClick={() => setArchiveChoice(true)}><b>YES</b><span>LET MY STORY TRAVEL</span></button>
            <button type="button" className={archiveChoice === false ? "selected" : ""} onClick={() => setArchiveChoice(false)}><b>NOT YET</b><span>KEEP THIS SESSION ONLY</span></button>
          </div>
        </section>
        <button className="giant-action" disabled={saving || archiveChoice === null || !title.trim() || !stakeName.trim()} onClick={handleCreate}>{saving ? archiveChoice ? "ADDING IT TO THE WORLD…" : "OPENING YOUR BET…" : `OPEN ${duration}-DAY BET`} <span>→</span></button>
      </div>
    </div>
  );
}
