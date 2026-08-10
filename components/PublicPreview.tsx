"use client";

import { useState } from "react";

const REPOSITORY_URL = "https://github.com/jiayu71900/stakes-concept-lab";
const REQUEST_URL = `${REPOSITORY_URL}/discussions/new?category=first-impressions`;
const SHAPE_URL = `${REPOSITORY_URL}/discussions/new?category=shape-the-system`;

const beats = [
  {
    label: "SEALED",
    kicker: "A RANDOM PROMISE IS WAITING",
    title: "Pull one bet from the pile.",
    detail: "Ordinary bets do not sit in a searchable catalogue.",
    action: "PULL THE TICKET",
  },
  {
    label: "OPEN",
    kicker: "I BET I CAN",
    title: "Ship my indie game in 30 days.",
    detail: "Jiayu puts a Steam Deck OLED behind the promise.",
    action: "BET AGAINST JIAYU",
  },
  {
    label: "MATCHED",
    kicker: "ONE STRANGER TOOK THE OTHER SIDE",
    title: "Jiayu vs. You",
    detail: "The promise locks. The clock starts. Someone is now watching for real.",
    action: "JUMP TO DAY 30",
  },
  {
    label: "DEADLINE",
    kicker: "THE GOAL WAS NOT COMPLETED",
    title: "The stake is now owed.",
    detail: "What happens next is where the product stops behaving like a habit tracker.",
    action: "SEE WHAT FOLLOWS",
  },
  {
    label: "MARKED",
    kicker: "THE PERSON DID NOT PAY UP",
    title: "The mark stays. The person keeps playing.",
    detail: "A visible consequence without a simple ban. The harder rules stay inside the full experience.",
    action: "PULL AGAIN",
  },
];

export function PublicPreview() {
  const [beat, setBeat] = useState(0);
  const current = beats[beat];
  const advance = () => setBeat((value) => (value + 1) % beats.length);

  return (
    <main className="preview-shell">
      <header className="preview-nav">
        <a className="preview-wordmark" href="/preview">BET I DO<span>.</span></a>
        <div><span>CONCEPT 0.1</span><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">PUBLIC LAB ↗</a></div>
      </header>

      <section className="preview-hero">
        <div className="preview-copy">
          <p className="preview-eyebrow">A SOCIAL BETTING GAME FOR PROMISES YOU MAKE ABOUT YOURSELF</p>
          <h1>Say it.<br />Stake it.<br /><em>See who doubts you.</em></h1>
          <p className="preview-lede">Put up something you care about. Let a stranger take the other side. Then live with what happens when the clock runs out.</p>
          <div className="preview-hero-actions">
            <button onClick={advance}>PLAY THE 30-SECOND TICKET <span>→</span></button>
            <a href="#join">BUILD WITH US</a>
          </div>
        </div>

        <div className={`preview-ticket beat-${beat}`} aria-live="polite">
          <div className="preview-ticket-main">
            <div className="preview-ticket-meta"><span>BET / 000719</span><b>{current.label}</b></div>
            <div className="preview-ticket-copy">
              <small>{current.kicker}</small>
              <h2>{current.title}</h2>
              <p>{current.detail}</p>
            </div>
            <div className="preview-ticket-progress" aria-label={`Story step ${beat + 1} of ${beats.length}`}>
              {beats.map((item, index) => <i className={index <= beat ? "active" : ""} key={item.label} />)}
            </div>
          </div>
          <div className="preview-ticket-stub">
            <span>TAKE<br />THE<br />OTHER<br />SIDE</span>
            <button onClick={advance}>{current.action}<b>→</b></button>
            <small>{beat + 1} / {beats.length}</small>
          </div>
        </div>
      </section>

      <section className="preview-reveal">
        <p className="preview-eyebrow">ENOUGH TO FEEL IT. NOT ENOUGH TO COPY IT.</p>
        <div className="preview-reveal-grid">
          <h2>The full experience has more edges than this ticket shows.</h2>
          <div>
            <p>The public layer reveals the premise, emotional arc, and open questions. Exact trust controls, ranking behavior, verification authority, and operating rules are deliberately not presented here.</p>
            <a href={REQUEST_URL} target="_blank" rel="noreferrer">REQUEST A WALKTHROUGH <span>↗</span></a>
          </div>
        </div>
      </section>

      <section className="preview-questions" id="join">
        <div className="preview-section-head"><p className="preview-eyebrow">DON’T APPLY FOR A TITLE</p><h2>Bring one sharp question.</h2><p>BET I DO. is an AI-native product lab with a small human core. Join by noticing something worth testing, breaking, or carrying further.</p></div>
        <div className="preview-question-grid">
          <a href={SHAPE_URL} target="_blank" rel="noreferrer"><b>01 / PROOF</b><strong>What would make a promise verifiably complete?</strong><span>OPEN THE QUESTION ↗</span></a>
          <a href={SHAPE_URL} target="_blank" rel="noreferrer"><b>02 / TRUST</b><strong>What consequence works when a person refuses to pay up?</strong><span>OPEN THE QUESTION ↗</span></a>
          <a href={SHAPE_URL} target="_blank" rel="noreferrer"><b>03 / DISCOVERY</b><strong>How do strangers find a bet without turning people into inventory?</strong><span>OPEN THE QUESTION ↗</span></a>
        </div>
      </section>

      <section className="preview-join">
        <div><span>SMALL HUMAN CORE.</span><span>AI-AUGMENTED BY DEFAULT.</span><span>OPEN EDGES.</span></div>
        <h2>You do not need permission to notice a better rule.</h2>
        <a href={REQUEST_URL} target="_blank" rel="noreferrer">ASK FOR THE FULL WALKTHROUGH <span>↗</span></a>
      </section>

      <footer className="preview-footer"><strong>BET I DO.</strong><span>Put something real on your word.</span><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">GitHub ↗</a></footer>
    </main>
  );
}
