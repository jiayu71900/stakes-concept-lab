CREATE TABLE IF NOT EXISTS visitor_challenger_notes (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL,
  owner_hash TEXT NOT NULL,
  author_alias TEXT NOT NULL,
  day INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  UNIQUE (challenge_id, owner_hash)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_visitor_challenger_notes_challenge_day
ON visitor_challenger_notes(challenge_id, day, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_visitor_challenger_notes_owner_created
ON visitor_challenger_notes(owner_hash, created_at DESC);
--> statement-breakpoint
PRAGMA optimize;
