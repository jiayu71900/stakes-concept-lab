export const visitorChallengesSchema = `
CREATE TABLE IF NOT EXISTS visitor_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  owner_hash TEXT NOT NULL,
  creator_alias TEXT NOT NULL,
  title TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  stake_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible'
)`;

export const visitorMessagesSchema = `
CREATE TABLE IF NOT EXISTS visitor_messages (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL,
  owner_hash TEXT NOT NULL,
  day INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  FOREIGN KEY (challenge_id) REFERENCES visitor_challenges(id) ON DELETE CASCADE,
  UNIQUE (challenge_id, day)
)`;

export const visitorChallengesVisibleIndex = `
CREATE INDEX IF NOT EXISTS idx_visitor_challenges_status_created
ON visitor_challenges(status, created_at DESC)`;

export const visitorMessagesChallengeIndex = `
CREATE INDEX IF NOT EXISTS idx_visitor_messages_challenge_day
ON visitor_messages(challenge_id, day)`;

export const visitorChallengesOwnerIndex = `
CREATE INDEX IF NOT EXISTS idx_visitor_challenges_owner_created
ON visitor_challenges(owner_hash, created_at DESC)`;
