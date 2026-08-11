"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@/domain/models";
import { saveVisitorChallenge } from "@/lib/visitorArchiveClient";

const DEMO_URL = "https://stakes-concept-lab.jiayu71900.chatgpt.site/";
const REPOSITORY_URL = "https://github.com/jiayu71900/stakes-concept-lab";
const VISITOR_IDENTITY_KEY = "bet-i-do-visitor-identity-v1";
const durations = [7, 14, 21, 30, 60];

function ticketNumber(promise: string, stake: string, duration: number) {
  const seed = `${promise}:${stake}:${duration}`;
  const value = [...seed].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 1000000, 719);
  return value.toString().padStart(6, "0");
}

function visitorIdentity(displayName: string): User {
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

export function PublicPreview() {
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [nameLocked, setNameLocked] = useState(false);
  const [promise, setPromise] = useState("Ship my first public build");
  const [stake, setStake] = useState("Nintendo Switch");
  const [duration, setDuration] = useState(30);
  const [archiveState, setArchiveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [shareStatus, setShareStatus] = useState("");
  const number = useMemo(() => ticketNumber(promise, stake, duration), [promise, stake, duration]);
  const initials = name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "YOU";
  const ticketText = `BET I DO.\n\n${name.trim()} bets they can ${promise.trim()} in ${duration} days.\nPhysical stake: ${stake.trim()}\n\nThis challenge is now part of the playable Demo: ${DEMO_URL}`;

  useEffect(() => {
    queueMicrotask(() => {
      const saved = window.localStorage.getItem(VISITOR_IDENTITY_KEY);
      if (!saved) return;
      try {
        const identity = JSON.parse(saved) as User;
        if (identity.displayName) {
          setName(identity.displayName);
          setNameLocked(true);
        }
      } catch {
        window.localStorage.removeItem(VISITOR_IDENTITY_KEY);
      }
    });
  }, []);

  const createTicket = async () => {
    if (name.trim().length < 2 || !promise.trim() || !stake.trim() || archiveState === "saving") return;
    setArchiveState("saving");
    let identity: User;
    const savedIdentity = window.localStorage.getItem(VISITOR_IDENTITY_KEY);
    try {
      identity = savedIdentity ? JSON.parse(savedIdentity) as User : visitorIdentity(name);
    } catch {
      identity = visitorIdentity(name);
    }
    if (!savedIdentity) window.localStorage.setItem(VISITOR_IDENTITY_KEY, JSON.stringify(identity));
    setName(identity.displayName);
    setNameLocked(true);
    try {
      await saveVisitorChallenge({ creatorName: identity.displayName, title: promise.trim(), durationDays: duration, stakeName: stake.trim(), firstMessage: "" });
      setArchiveState("saved");
      setPage(2);
    } catch {
      setArchiveState("error");
    }
  };

  const copyTicket = async () => {
    await navigator.clipboard.writeText(ticketText);
    setShareStatus("CHALLENGE COPIED — SEND IT TO SOMEONE WHO DOUBTS YOU");
  };

  const shareTicket = async () => {
    if (!navigator.share) {
      await copyTicket();
      return;
    }
    try {
      await navigator.share({ title: `${name.trim()} bets they can ${promise.trim()}`, text: ticketText, url: DEMO_URL });
      setShareStatus("TICKET SHARED — NOW SEE WHO TAKES THE OTHER SIDE");
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "AbortError") setShareStatus("SHARING PAUSED — COPY THE CHALLENGE INSTEAD");
    }
  };

  return (
    <main className={`teaser-shell teaser-page-${page + 1}`}>
      <div className="teaser-ambient" aria-hidden="true"><i /><i /><i /></div>
      <header className="teaser-nav">
        <button className="teaser-wordmark" onClick={() => setPage(0)} aria-label="Return to the first preview page">BET I DO<span>.</span></button>
        <div className="teaser-progress" aria-label={`Preview page ${page + 1} of 3`}>
          {[0, 1, 2].map((item) => <button aria-label={`Go to preview page ${item + 1}`} disabled={item === 2 && archiveState !== "saved"} className={item === page ? "active" : item < page ? "complete" : ""} key={item} onClick={() => setPage(item)}><span>0{item + 1}</span></button>)}
        </div>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">OPEN PRODUCT LAB <span>↗</span></a>
      </header>

      <section className="teaser-stage" aria-live="polite">
        {page === 0 && (
          <div className="teaser-intro">
            <div className="teaser-intro-copy">
              <p className="teaser-eyebrow"><span>PLAYABLE PREVIEW</span> A SOCIAL BET ON YOUR OWN PROMISE</p>
              <h1>You say you will.<br /><em>Someone bets<br />you won’t.</em></h1>
              <p className="teaser-lede">Name the thing you will do. Put something real behind it. Let a stranger take the other side.</p>
              {nameLocked && <p className="teaser-saved-identity"><span>WELCOME BACK</span> Your saved Demo name is <strong>{name}</strong>. It is not a preset name.</p>}
              <div className="teaser-intro-actions">
                <button className="teaser-next" onClick={() => setPage(1)}>CREATE YOUR CHALLENGE <span>→</span></button>
                <small>3 short screens · about 30 seconds</small>
              </div>
            </div>
            <div className="teaser-scene" aria-label="A glimpse of how a challenge travels">
              <span className="scene-tag scene-tag-one">NO SEARCH</span>
              <span className="scene-tag scene-tag-two">7 RANDOM PULLS</span>
              <div className="scene-halo" aria-hidden="true" />
              <div className="scene-card scene-card-back" aria-hidden="true"><span>NEW PACT</span><b>07</b></div>
              <div className="scene-card">
                <div className="scene-card-top"><span>OPEN CHALLENGE</span><b>30 DAYS</b></div>
                <small>I BET I CAN</small>
                <strong>SHIP MY FIRST<br />PUBLIC BUILD</strong>
                <div className="scene-stake"><span>IF I DON’T</span><b>NINTENDO SWITCH</b></div>
                <div className="scene-people"><i>J</i><i>M</i><i>R</i><span>243 PEOPLE WANT TO SEE</span></div>
              </div>
              <div className="scene-result"><span>FINISH</span><b>KEEP IT</b><i>or</i><span>FAIL</span><b>SHIP IT</b></div>
            </div>
          </div>
        )}

        {page === 1 && (
          <div className="teaser-builder">
            <div className="teaser-builder-copy">
              <p className="teaser-eyebrow"><span>02</span> MAKE IT YOURS</p>
              <h1>Put your name<br /><em>behind the promise.</em></h1>
              <p>Choose your name once for the whole Demo. If you already played before, this page reuses that saved name. Future visitors may discover your challenge in a random pull.</p>
              <div className="archive-preview-note"><span>✦</span><div><b>YOUR CHALLENGE WILL ENTER THE DEMO</b><small>Your display name, promise, duration and stake become part of the public visitor archive.</small></div></div>
            </div>
            <div className="teaser-form">
              <div className="teaser-form-head"><div className="preview-avatar">{initials}</div><div><small>CHALLENGE MAKER</small><strong>{name.trim() || "What should we call you?"}</strong></div><span>{nameLocked ? "ALREADY CHOSEN" : "01 / IDENTITY"}</span></div>
              <label className={nameLocked ? "locked-name" : ""}><span>{nameLocked ? "YOUR SAVED DEMO NAME" : "CHOOSE YOUR DEMO NAME"}</span><input value={name} disabled={nameLocked} maxLength={24} placeholder="For example: River" onChange={(event) => setName(event.target.value)} />{nameLocked && <small>You chose this name earlier in this browser. BET I DO. never assigns “Lemon” or any other default name.</small>}</label>
              <label><span>I BET I CAN</span><input value={promise} maxLength={72} onChange={(event) => { setPromise(event.target.value); setArchiveState("idle"); }} /></label>
              <div className="teaser-form-row">
                <fieldset><legend>TIME</legend><div>{durations.map((days) => <button type="button" aria-label={`${days} days`} className={duration === days ? "selected" : ""} key={days} onClick={() => { setDuration(days); setArchiveState("idle"); }}>{days}<small>D</small></button>)}</div></fieldset>
                <label><span>PHYSICAL STAKE</span><input value={stake} maxLength={48} onChange={(event) => { setStake(event.target.value); setArchiveState("idle"); }} /></label>
              </div>
              <div className="teaser-form-actions"><button onClick={() => setPage(0)}>← BACK</button><div><small>By creating, you agree to add these public details to the playable Demo. Do not use private information.</small><button className="teaser-next" disabled={name.trim().length < 2 || !promise.trim() || !stake.trim() || archiveState === "saving"} onClick={createTicket}>{archiveState === "saving" ? "ADDING TO THE DEMO…" : "CREATE MY CHALLENGE"} <span>→</span></button></div></div>
              {archiveState === "error" && <p className="archive-error" role="alert">The visitor archive did not answer. Your details have not been published — please try once more.</p>}
            </div>
          </div>
        )}

        {page === 2 && (
          <div className="teaser-result">
            <div className="teaser-result-heading"><p className="teaser-eyebrow"><span>03</span> CHALLENGE CREATED</p><h1>It’s in<br /><em>the world.</em></h1><p>Your challenge can now appear in the Demo’s random discovery pool. Open the Demo to see what happens next.</p><div className="demo-live-pill"><i /> LIVE IN THE PLAYABLE DEMO</div></div>
            <a className="generated-ticket" href={DEMO_URL} aria-label="Open the full playable BET I DO demo">
              <div className="generated-ticket-main">
                <div className="ticket-brandline"><strong>BET I DO<span>.</span></strong><small>PERSONAL CHALLENGE</small></div>
                <div className="generated-ticket-meta"><span>NO. {number}</span><span>OPEN · RANDOM DISCOVERY</span></div>
                <div className="ticket-owner"><small>CHALLENGE MAKER</small><strong>{name.trim()}</strong><i>{initials}</i></div>
                <div className="generated-ticket-promise"><small>I BET I CAN</small><strong>{promise.trim()}.</strong></div>
                <div className="generated-ticket-details"><span><small>TIME</small><b>{duration} DAYS</b></span><span><small>PHYSICAL STAKE</small><b>{stake.trim()}</b></span></div>
                <div className="ticket-bottomline"><div className="ticket-barcode" aria-hidden="true" /><span>FINISH · KEEP IT<br />FAIL · SHIP IT</span><small>CLICK TO ENTER<br />THE PLAYABLE DEMO</small></div>
              </div>
              <div className="generated-ticket-stub"><small>ADMIT ONE<br />CHALLENGER</small><span>TAKE<br />THE<br />OTHER<br />SIDE</span><i>OPEN THE<br />STORY<b>→</b></i><div className="stub-number">BET / {number}</div></div>
            </a>
            <div className="teaser-result-actions"><button onClick={() => { setShareStatus(""); setPage(1); }}>← VIEW DETAILS</button><div className="ticket-share-actions"><button onClick={copyTicket}>COPY</button><button onClick={shareTicket}>SHARE ↗</button><a href={DEMO_URL}>ENTER DEMO →</a></div>{shareStatus && <p role="status">{shareStatus}</p>}</div>
          </div>
        )}
      </section>

      <footer className="teaser-footer"><span>ONE PROMISE</span><i /><span>ONE REAL STAKE</span><i /><span>ONE STRANGER ON THE OTHER SIDE</span></footer>
    </main>
  );
}
