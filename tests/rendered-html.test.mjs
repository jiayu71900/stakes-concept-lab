import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the product-specific Discover experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>BET I DO\. — Put something real on your word<\/title>/i);
  assert.match(html, /Put something real/);
  assert.match(html, /BET ON YOURSELF/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("all five core pages, collaboration lab, and public teaser render", async () => {
  for (const pathname of ["/", "/challenge", "/match", "/outcome", "/profile", "/lab", "/preview"]) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
  }
});

test("public teaser stays within three pages and ends with a demo-linked challenge ticket", async () => {
  const response = await render("/preview");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Preview page 1 of 3/);
  assert.match(html, /MAKE A CHALLENGE TICKET/);
  assert.doesNotMatch(html, /cleaning|highest stakes|ranking weight|default \+10/i);
  const source = await readFile(new URL("../components/PublicPreview.tsx", import.meta.url), "utf8");
  assert.match(source, /generated-ticket[\s\S]*?href=\{DEMO_URL\}/);
  assert.match(source, /Open the full playable BET I DO demo/);
});

test("visitor archive is an inviting, explicit choice", async () => {
  const source = await readFile(new URL("../components/DemoApp.tsx", import.meta.url), "utf8");
  assert.match(source, /Would you like future visitors to discover your challenge\?/);
  assert.match(source, /LET MY STORY TRAVEL/);
  assert.match(source, /KEEP THIS SESSION ONLY/);
  assert.match(source, /never your real name, contact details, address, payment, or shipping information/);
  assert.match(source, /ONE NAME · THIS WHOLE STORY/);
  assert.match(source, /You will not be asked to rename yourself after the outcome/);
  assert.match(source, /Only a later default can change that/);
  assert.match(source, /bet-i-do-visitor-identity-v1/);
  assert.doesNotMatch(source, /CHOOSE HOW YOU ENTER|ENTER AS A NEW VISITOR/);
  assert.match(source, /Every challenger may leave one message on one chosen day/);
  assert.match(source, /Future challengers can find it in this room’s history/);
});

test("renders the consequence path and both join affordances without simulation copy", async () => {
  const pages = await Promise.all(["/challenge", "/outcome", "/profile", "/lab"].map(async (pathname) => {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    return response.text();
  }));
  const [challenge, outcome, profile, lab] = pages;
  assert.match(challenge, /BET THEY WON’T/);
  assert.match(outcome, /LET 72H EXPIRE/);
  assert.match(profile, /PUBLISH AS[\s\S]*?A MARKED USER/);
  assert.match(profile, /CHALLENGE AS[\s\S]*?A MARKED USER/);
  const source = await readFile(new URL("../components/DemoApp.tsx", import.meta.url), "utf8");
  assert.match(source, /CONTINUE AS A MARKED USER/);
  assert.match(source, /CONTINUE AS \{markedVisitorAfterShipment \? "A MARKED USER" : "AN UNMARKED USER"\}/);
  assert.match(source, /CONTINUE · 1 MARK CLEANED/);
  assert.match(source, /onProfile\(cleanedVisitorMark \? state\.viewer\.id : state\.creator\.id\)/);
  assert.match(source, /LIVE IN RANDOM DISCOVER NOW/);
  assert.match(source, /YOUR BET · WATCH-ONLY/);
  assert.match(source, /\{ includeOwn: true \}/);
  assert.doesNotMatch(source, /deterministicDiscovery/);
  assert.doesNotMatch(source, /PUBLISH AS \{user\.displayName\.toUpperCase\(\)\}|CHALLENGE AS \{user\.displayName\.toUpperCase\(\)\}/);
  assert.match(profile, /CLEANING RULE/);
  assert.match(profile, /FOUND A LOOPHOLE/);
  assert.match(lab, /HOW TO JOIN/);
  assert.match(lab, /Shape the system/);
  assert.match(lab, /github\.com\/jiayu71900\/stakes-concept-lab\/discussions/);
  assert.doesNotMatch(pages.join("\n"), />[^<]*simulat/i);
});

test("keeps product rules outside the UI", async () => {
  const [stateMachine, defaults, discovery, leaderboard] = await Promise.all([
    readFile(new URL("../engine/challengeStateMachine.ts", import.meta.url), "utf8"),
    readFile(new URL("../engine/defaultEngine.ts", import.meta.url), "utf8"),
    readFile(new URL("../engine/discoveryEngine.ts", import.meta.url), "utf8"),
    readFile(new URL("../engine/leaderboardEngine.ts", import.meta.url), "utf8"),
  ]);
  assert.match(stateMachine, /transitionChallenge/);
  assert.match(defaults, /defaultMarksFor/);
  assert.match(discovery, /discoverNext/);
  assert.match(leaderboard, /rankLeaderboard/);
});
