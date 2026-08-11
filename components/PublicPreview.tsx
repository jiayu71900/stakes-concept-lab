"use client";

import { useMemo, useState } from "react";

const DEMO_URL = "https://stakes-concept-lab.jiayu71900.chatgpt.site/";
const REPOSITORY_URL = "https://github.com/jiayu71900/stakes-concept-lab";
const durations = [7, 14, 21, 30, 60];

function ticketNumber(promise: string, stake: string, duration: number) {
  const seed = `${promise}:${stake}:${duration}`;
  const value = [...seed].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 1000000, 719);
  return value.toString().padStart(6, "0");
}

export function PublicPreview() {
  const [page, setPage] = useState(0);
  const [promise, setPromise] = useState("Ship my first public build");
  const [stake, setStake] = useState("Nintendo Switch");
  const [duration, setDuration] = useState(30);
  const number = useMemo(() => ticketNumber(promise, stake, duration), [promise, stake, duration]);

  return (
    <main className={`teaser-shell teaser-page-${page + 1}`}>
      <header className="teaser-nav">
        <button className="teaser-wordmark" onClick={() => setPage(0)} aria-label="Return to the first preview page">BET I DO<span>.</span></button>
        <div className="teaser-progress" aria-label={`Preview page ${page + 1} of 3`}>
          {[0, 1, 2].map((item) => <button aria-label={`Go to preview page ${item + 1}`} className={item <= page ? "active" : ""} key={item} onClick={() => setPage(item)} />)}
          <span>0{page + 1} / 03</span>
        </div>
        <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">PUBLIC LAB ↗</a>
      </header>

      <section className="teaser-stage" aria-live="polite">
        {page === 0 && (
          <div className="teaser-intro">
            <div>
              <p className="teaser-eyebrow">A SOCIAL BETTING GAME FOR PROMISES YOU MAKE ABOUT YOURSELF</p>
              <h1>Say it.<br />Stake it.<br /><em>See who doubts you.</em></h1>
            </div>
            <div className="teaser-intro-side">
              <p>Make a promise about yourself. Put up something you care about. Let a stranger take the other side.</p>
              <div className="teaser-three-lines"><span>FINISH · KEEP IT</span><span>FAIL · SHIP IT</span><span>REFUSE · CARRY THE MARK</span></div>
              <button className="teaser-next" onClick={() => setPage(1)}>MAKE A CHALLENGE TICKET <span>→</span></button>
            </div>
          </div>
        )}

        {page === 1 && (
          <div className="teaser-builder">
            <div className="teaser-builder-copy">
              <p className="teaser-eyebrow">PAGE 02 · PUT SOMETHING REAL BEHIND IT</p>
              <h1>What will you<br /><em>bet you can do?</em></h1>
              <p>Three answers are enough. The deeper rules stay inside the playable Demo.</p>
            </div>
            <div className="teaser-form">
              <label><span>I BET I CAN</span><input value={promise} maxLength={72} onChange={(event) => setPromise(event.target.value)} /></label>
              <fieldset><legend>BEFORE THE CLOCK HITS</legend><div>{durations.map((days) => <button type="button" className={duration === days ? "selected" : ""} key={days} onClick={() => setDuration(days)}>{days}<small>DAYS</small></button>)}</div></fieldset>
              <label><span>I’M PUTTING UP</span><input value={stake} maxLength={48} onChange={(event) => setStake(event.target.value)} /></label>
              <div className="teaser-form-actions"><button onClick={() => setPage(0)}>← BACK</button><button className="teaser-next" disabled={!promise.trim() || !stake.trim()} onClick={() => setPage(2)}>PRINT MY TICKET <span>→</span></button></div>
            </div>
          </div>
        )}

        {page === 2 && (
          <div className="teaser-result">
            <div className="teaser-result-heading"><p className="teaser-eyebrow">PAGE 03 · YOUR CHALLENGE TICKET</p><h1>Now make it<br /><em>feel real.</em></h1><p>Click anywhere on the ticket to enter the playable Demo.</p></div>
            <a className="generated-ticket" href={DEMO_URL} aria-label="Open the full playable BET I DO demo">
              <div className="generated-ticket-main">
                <div className="generated-ticket-meta"><span>BET / {number}</span><b>OPEN</b></div>
                <div className="generated-ticket-promise"><small>I BET I CAN</small><strong>{promise.trim()}.</strong></div>
                <div className="generated-ticket-details"><span><small>TIME</small><b>{duration} DAYS</b></span><span><small>PHYSICAL STAKE</small><b>{stake.trim()}</b></span></div>
                <div className="generated-ticket-rule">FINISH · KEEP IT&nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp;FAIL · SHIP IT</div>
              </div>
              <div className="generated-ticket-stub"><span>BET<br />AGAINST<br />ME</span><i>OPEN THE<br />PLAYABLE DEMO<b>↗</b></i><small>0{page + 1} / 03</small></div>
            </a>
            <div className="teaser-result-actions"><button onClick={() => setPage(1)}>← EDIT TICKET</button><a href={DEMO_URL}>ENTER DEMO →</a></div>
          </div>
        )}
      </section>

      <footer className="teaser-footer"><span>SMALL HUMAN CORE.</span><span>AI-AUGMENTED BY DEFAULT.</span><span>OPEN EDGES.</span></footer>
    </main>
  );
}
