import {
  countRecentChallengerNotesForOwner,
  countRecentChallengesForOwner,
  ensureVisitorArchive,
  insertVisitorChallengerNote,
  insertVisitorChallenge,
  insertVisitorMessage,
  listVisitorArchive,
  type D1Database,
  type VisitorChallengeRow,
  type VisitorChallengerNoteRow,
  type VisitorMessageRow,
} from "../db/visitorArchive.js";

const durations = new Set([7, 14, 21, 30, 60]);

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const withoutControls = [...value].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("");
  return withoutControls.replace(/\s+/g, " ").trim().slice(0, maximum);
}

function containsLink(value: string) {
  return /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io)\b)/i.test(value);
}

export function normalizeChallengeInput(value: unknown) {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const title = cleanText(input.title, 72);
  const stakeName = cleanText(input.stakeName, 48);
  const firstMessage = cleanText(input.firstMessage, 180);
  const creatorName = cleanText(input.creatorName, 24);
  const durationDays = Number(input.durationDays);
  if (input.archiveConsent !== true || creatorName.length < 2 || title.length < 4 || stakeName.length < 2 || !durations.has(durationDays)) return null;
  if (containsLink(creatorName) || containsLink(title) || containsLink(stakeName) || containsLink(firstMessage)) return null;
  return { creatorName, title, stakeName, firstMessage, durationDays };
}

export function normalizeMessageInput(value: unknown) {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const challengeId = cleanText(input.challengeId, 80);
  const body = cleanText(input.body, 180);
  const day = Number(input.day);
  if (!challengeId.startsWith("visitor-") || body.length < 2 || !Number.isInteger(day) || day < 1 || day > 60) return null;
  if (containsLink(body)) return null;
  return { challengeId, body, day };
}

export function normalizeChallengerNoteInput(value: unknown) {
  const input = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const challengeId = cleanText(input.challengeId, 80);
  const authorName = cleanText(input.authorName, 24);
  const body = cleanText(input.body, 180);
  const day = Number(input.day);
  if (!challengeId || authorName.length < 2 || body.length < 2 || !Number.isInteger(day) || day < 1 || day > 60) return null;
  if (containsLink(authorName) || containsLink(body)) return null;
  return { challengeId, authorName, body, day };
}

async function ownerHash(request: Request) {
  const source = request.headers.get("oai-authenticated-user-id") ?? request.headers.get("x-visitor-session");
  if (!source || source.length < 8 || source.length > 200) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleVisitorArchiveRequest(request: Request, db?: D1Database) {
  if (!db) return json({ error: "Visitor archive is not available." }, 503);
  await ensureVisitorArchive(db);
  const url = new URL(request.url);

  if (url.pathname === "/api/visitor-challenges" && request.method === "GET") {
    const archive = await listVisitorArchive(db, Number(url.searchParams.get("limit") ?? 24));
    const currentOwner = await ownerHash(request);
    return json({
      challenges: archive.challenges.map((challenge) => ({
        id: challenge.id,
        creatorAlias: challenge.creator_alias,
        title: challenge.title,
        durationDays: challenge.duration_days,
        stakeName: challenge.stake_name,
        createdAt: challenge.created_at,
      })),
      messages: archive.messages.map((message) => ({
        id: message.id,
        challengeId: message.challenge_id,
        day: message.day,
        body: message.body,
        createdAt: message.created_at,
      })),
      challengerNotes: archive.challengerNotes.map((note) => ({
        id: note.id,
        challengeId: note.challenge_id,
        authorName: note.author_alias,
        day: note.day,
        body: note.body,
        createdAt: note.created_at,
        isMine: currentOwner === note.owner_hash,
      })),
    });
  }

  const owner = await ownerHash(request);
  if (!owner) return json({ error: "An anonymous visitor session is required." }, 401);

  if (url.pathname === "/api/visitor-challenges" && request.method === "POST") {
    const input = normalizeChallengeInput(await readBody(request));
    if (!input) return json({ error: "Challenge content is incomplete or unsupported." }, 400);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (await countRecentChallengesForOwner(db, owner, since) >= 5) return json({ error: "Daily challenge limit reached." }, 429);

    const id = `visitor-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const challenge: VisitorChallengeRow = {
      id,
      owner_hash: owner,
      creator_alias: input.creatorName,
      title: input.title,
      duration_days: input.durationDays,
      stake_name: input.stakeName,
      created_at: createdAt,
      status: "visible",
    };
    const firstMessage: VisitorMessageRow | undefined = input.firstMessage ? {
      id: `visitor-message-${crypto.randomUUID()}`,
      challenge_id: id,
      owner_hash: owner,
      day: 1,
      body: input.firstMessage,
      created_at: createdAt,
      status: "visible",
    } : undefined;
    await insertVisitorChallenge(db, challenge, firstMessage);
    return json({ challenge: { id, creatorAlias: challenge.creator_alias, title: challenge.title, durationDays: challenge.duration_days, stakeName: challenge.stake_name, createdAt }, message: firstMessage ? { id: firstMessage.id, challengeId: id, day: 1, body: firstMessage.body, createdAt } : null }, 201);
  }

  if (url.pathname === "/api/visitor-messages" && request.method === "POST") {
    const input = normalizeMessageInput(await readBody(request));
    if (!input) return json({ error: "Message content is incomplete or unsupported." }, 400);
    const message: VisitorMessageRow = {
      id: `visitor-message-${crypto.randomUUID()}`,
      challenge_id: input.challengeId,
      owner_hash: owner,
      day: input.day,
      body: input.body,
      created_at: new Date().toISOString(),
      status: "visible",
    };
    try {
      if (!await insertVisitorMessage(db, message)) return json({ error: "This visitor does not own the challenge." }, 403);
    } catch {
      return json({ error: "One update is allowed for this challenge day." }, 409);
    }
    return json({ message: { id: message.id, challengeId: message.challenge_id, day: message.day, body: message.body, createdAt: message.created_at } }, 201);
  }

  if (url.pathname === "/api/visitor-challenger-notes" && request.method === "POST") {
    const input = normalizeChallengerNoteInput(await readBody(request));
    if (!input) return json({ error: "Challenger note is incomplete or unsupported." }, 400);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (await countRecentChallengerNotesForOwner(db, owner, since) >= 10) return json({ error: "Daily challenger note limit reached." }, 429);
    const note: VisitorChallengerNoteRow = {
      id: `visitor-challenger-note-${crypto.randomUUID()}`,
      challenge_id: input.challengeId,
      owner_hash: owner,
      author_alias: input.authorName,
      day: input.day,
      body: input.body,
      created_at: new Date().toISOString(),
      status: "visible",
    };
    try {
      await insertVisitorChallengerNote(db, note);
    } catch {
      return json({ error: "One challenger message is allowed for this challenge." }, 409);
    }
    return json({ note: { id: note.id, challengeId: note.challenge_id, authorName: note.author_alias, day: note.day, body: note.body, createdAt: note.created_at, isMine: true } }, 201);
  }

  return json({ error: "Not found." }, 404);
}
