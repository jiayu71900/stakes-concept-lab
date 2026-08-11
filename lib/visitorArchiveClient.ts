import type { Challenge, ChallengeMessage, User } from "../domain/models";

interface VisitorChallengeDto {
  id: string;
  creatorAlias: string;
  title: string;
  durationDays: number;
  stakeName: string;
  createdAt: string;
  isMine: boolean;
}

interface VisitorMessageDto {
  id: string;
  challengeId: string;
  day: number;
  body: string;
  createdAt: string;
}

interface VisitorChallengerNoteDto extends VisitorMessageDto {
  authorName: string;
  isMine: boolean;
}

interface VisitorArchiveDto {
  challenges: VisitorChallengeDto[];
  messages: VisitorMessageDto[];
  challengerNotes: VisitorChallengerNoteDto[];
}

const SESSION_KEY = "bet-i-do-visitor-session-v1";

function visitorSession() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

function sessionHeaders() {
  return { "content-type": "application/json", "x-visitor-session": visitorSession() };
}

function creatorId(challengeId: string) {
  return `visitor-creator-${challengeId}`;
}

function toCreator(item: VisitorChallengeDto): User {
  const initials = item.creatorAlias.replace("Visitor ", "V").slice(0, 2).toUpperCase();
  return {
    id: creatorId(item.id),
    handle: `@${item.creatorAlias.toLowerCase().replace(/\s+/g, "-")}`,
    displayName: item.creatorAlias,
    avatar: initials,
    bio: "Left a challenge in the visitor archive.",
    unresolvedDefaults: 0,
    historicalDefaults: 0,
    defaultsReceived: 0,
    refreshesRemaining: 7,
  };
}

function toChallenge(item: VisitorChallengeDto): Challenge {
  return {
    id: item.id,
    slug: item.id,
    creatorId: creatorId(item.id),
    title: item.title,
    promise: "A visitor left this promise for the next person to discover.",
    proof: ["Completion evidence is defined inside the full product."],
    deadlineLabel: `${item.durationDays} days after matching`,
    durationDays: item.durationDays,
    daysRemaining: item.durationDays,
    stake: {
      id: `stake-${item.id}`,
      itemName: item.stakeName,
      category: "Visitor stake",
      estimatedValue: 0,
      condition: "Declared by visitor",
      ownershipVerified: false,
      significance: "Something this visitor chose to put behind the promise.",
      accent: "#ff6949",
      glyph: "VI",
    },
    state: "OPEN",
    entrantIds: [],
    entrantCount: 0,
    watchers: 0,
    interestingScore: 0,
    archiveEntry: true,
    ownedByCurrentVisitor: item.isMine,
  };
}

export async function loadVisitorArchive() {
  const response = await fetch("/api/visitor-challenges?limit=24", { cache: "no-store", headers: sessionHeaders() });
  if (!response.ok) throw new Error("Visitor archive unavailable");
  const data = await response.json() as VisitorArchiveDto;
  const creators = data.challenges.map(toCreator);
  const challengeById = new Map(data.challenges.map((challenge) => [challenge.id, challenge]));
  const messages: ChallengeMessage[] = data.messages.flatMap((message) => {
    const challenge = challengeById.get(message.challengeId);
    return challenge ? [{ id: message.id, challengeId: message.challengeId, authorId: creatorId(message.challengeId), day: message.day, body: message.body, kind: "CREATOR_UPDATE" as const }] : [];
  });
  const challengerNotes: ChallengeMessage[] = (data.challengerNotes ?? []).map((note) => ({
    id: note.id,
    challengeId: note.challengeId,
    authorId: `visitor-challenger-${note.id}`,
    authorName: note.authorName,
    day: note.day,
    body: note.body,
    kind: "CHALLENGER_NOTE",
    ownedByCurrentVisitor: note.isMine,
  }));
  return { challenges: data.challenges.map(toChallenge), creators, messages: [...messages, ...challengerNotes] };
}

export async function saveVisitorChallenge(input: { creatorName: string; title: string; durationDays: number; stakeName: string; firstMessage: string }) {
  const response = await fetch("/api/visitor-challenges", { method: "POST", headers: sessionHeaders(), body: JSON.stringify({ ...input, archiveConsent: true }) });
  if (!response.ok) throw new Error("Challenge could not be archived");
  const data = await response.json() as { challenge: VisitorChallengeDto; message: VisitorMessageDto | null };
  const creator = toCreator(data.challenge);
  const challenge = toChallenge(data.challenge);
  const message: ChallengeMessage | null = data.message ? { id: data.message.id, challengeId: data.message.challengeId, authorId: creator.id, day: data.message.day, body: data.message.body, kind: "CREATOR_UPDATE" } : null;
  return { creator, challenge, message };
}

export async function saveVisitorMessage(input: { challengeId: string; day: number; body: string }) {
  const response = await fetch("/api/visitor-messages", { method: "POST", headers: sessionHeaders(), body: JSON.stringify(input) });
  if (!response.ok) throw new Error("Message could not be archived");
}

export async function saveVisitorChallengerNote(input: { challengeId: string; authorName: string; day: number; body: string }) {
  const response = await fetch("/api/visitor-challenger-notes", { method: "POST", headers: sessionHeaders(), body: JSON.stringify(input) });
  if (!response.ok) throw new Error(response.status === 409 ? "A challenger message already exists for this challenge." : "Challenger message could not be archived");
  const data = await response.json() as { note: VisitorChallengerNoteDto };
  return {
    id: data.note.id,
    challengeId: data.note.challengeId,
    authorId: `visitor-challenger-${data.note.id}`,
    authorName: data.note.authorName,
    day: data.note.day,
    body: data.note.body,
    kind: "CHALLENGER_NOTE" as const,
    ownedByCurrentVisitor: true,
  };
}
