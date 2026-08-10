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
  assert.match(html, /<title>STAKES\. — Risk something real<\/title>/i);
  assert.match(html, /What would you risk/);
  assert.match(html, /RANDOM DISCOVERY/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("all five core pages and the collaboration lab render", async () => {
  for (const pathname of ["/", "/challenge", "/match", "/outcome", "/profile", "/lab"]) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
  }
});

test("renders the consequence path and both join affordances without simulation copy", async () => {
  const pages = await Promise.all(["/challenge", "/outcome", "/profile", "/lab"].map(async (pathname) => {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    return response.text();
  }));
  const [challenge, outcome, profile, lab] = pages;
  assert.match(challenge, /HOW TO JOIN THIS PACT/);
  assert.match(outcome, /LET 72H EXPIRE/);
  assert.match(profile, /PUBLISH AS[\s\S]*?JIAYU/);
  assert.match(profile, /CLEANING RULE/);
  assert.match(lab, /HOW TO JOIN/);
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
