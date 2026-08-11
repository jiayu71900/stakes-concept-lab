import {
  visitorChallengesOwnerIndex,
  visitorChallengesSchema,
  visitorChallengesVisibleIndex,
  visitorMessagesChallengeIndex,
  visitorMessagesSchema,
} from "./schema.js";

export interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success?: boolean;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}

export interface VisitorChallengeRow {
  id: string;
  owner_hash: string;
  creator_alias: string;
  title: string;
  duration_days: number;
  stake_name: string;
  created_at: string;
  status: string;
}

export interface VisitorMessageRow {
  id: string;
  challenge_id: string;
  owner_hash: string;
  day: number;
  body: string;
  created_at: string;
  status: string;
}

export async function ensureVisitorArchive(db: D1Database) {
  await db.batch([
    db.prepare(visitorChallengesSchema),
    db.prepare(visitorMessagesSchema),
    db.prepare(visitorChallengesVisibleIndex),
    db.prepare(visitorMessagesChallengeIndex),
    db.prepare(visitorChallengesOwnerIndex),
  ]);
}

export async function listVisitorArchive(db: D1Database, limit = 24) {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const challengeResult = await db.prepare(`
    SELECT id, creator_alias, title, duration_days, stake_name, created_at
    FROM visitor_challenges
    WHERE status = 'visible'
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(safeLimit).all<Omit<VisitorChallengeRow, "owner_hash" | "status">>();
  const challenges = challengeResult.results ?? [];
  if (challenges.length === 0) return { challenges: [], messages: [] };

  const placeholders = challenges.map(() => "?").join(", ");
  const messageResult = await db.prepare(`
    SELECT id, challenge_id, day, body, created_at
    FROM visitor_messages
    WHERE status = 'visible' AND challenge_id IN (${placeholders})
    ORDER BY challenge_id, day
  `).bind(...challenges.map((challenge) => challenge.id)).all<Omit<VisitorMessageRow, "owner_hash" | "status">>();

  return { challenges, messages: messageResult.results ?? [] };
}

export async function countRecentChallengesForOwner(db: D1Database, ownerHash: string, since: string) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM visitor_challenges
    WHERE owner_hash = ? AND created_at >= ?
  `).bind(ownerHash, since).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function insertVisitorChallenge(db: D1Database, challenge: VisitorChallengeRow, firstMessage?: VisitorMessageRow) {
  const statements = [db.prepare(`
    INSERT INTO visitor_challenges (id, owner_hash, creator_alias, title, duration_days, stake_name, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(challenge.id, challenge.owner_hash, challenge.creator_alias, challenge.title, challenge.duration_days, challenge.stake_name, challenge.created_at, challenge.status)];
  if (firstMessage) {
    statements.push(db.prepare(`
      INSERT INTO visitor_messages (id, challenge_id, owner_hash, day, body, created_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(firstMessage.id, firstMessage.challenge_id, firstMessage.owner_hash, firstMessage.day, firstMessage.body, firstMessage.created_at, firstMessage.status));
  }
  await db.batch(statements);
}

export async function insertVisitorMessage(db: D1Database, message: VisitorMessageRow) {
  const challenge = await db.prepare(`
    SELECT id FROM visitor_challenges WHERE id = ? AND owner_hash = ? AND status = 'visible'
  `).bind(message.challenge_id, message.owner_hash).first<{ id: string }>();
  if (!challenge) return false;
  await db.prepare(`
    INSERT INTO visitor_messages (id, challenge_id, owner_hash, day, body, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(message.id, message.challenge_id, message.owner_hash, message.day, message.body, message.created_at, message.status).run();
  return true;
}
