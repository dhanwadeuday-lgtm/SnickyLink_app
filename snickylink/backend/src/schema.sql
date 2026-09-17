PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  refresh_token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS couples (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | ACTIVE
  tz_offset INTEGER NOT NULL DEFAULT 330, -- minutes from UTC
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS couple_members (
  couple_id TEXT NOT NULL REFERENCES couples(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (couple_id, user_id)
);

CREATE TABLE IF NOT EXISTS couple_invites (
  code TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

-- Snick catalog: the pool the engine picks from
CREATE TABLE IF NOT EXISTS snick_catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL,      -- Fun | Romantic | Communication | Challenge | Memory | Understanding | Teamwork
  difficulty INTEGER NOT NULL DEFAULT 1,  -- 1 easy, 2 medium, 3 hard
  verification TEXT NOT NULL,  -- text | photo | partner
  rarity TEXT NOT NULL DEFAULT 'NORMAL'   -- NORMAL | RARE | LEGENDARY
);

-- One row per snick per couple per day
CREATE TABLE IF NOT EXISTS daily_snicks (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  catalog_id TEXT NOT NULL REFERENCES snick_catalog(id),
  local_date TEXT NOT NULL,        -- YYYY-MM-DD in couple tz
  slot_index INTEGER NOT NULL,     -- 0..4
  is_mystery INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,   -- epoch ms
  window_end INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | SUBMITTED | VERIFIED | FAILED
  UNIQUE (couple_id, local_date, slot_index)
);

CREATE TABLE IF NOT EXISTS snick_submissions (
  id TEXT PRIMARY KEY,
  daily_snick_id TEXT NOT NULL REFERENCES daily_snicks(id),
  couple_id TEXT NOT NULL REFERENCES couples(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,            -- text | photo | partner
  text TEXT,
  media_id TEXT,
  status TEXT NOT NULL,          -- PENDING | AWAITING_PARTNER | VERIFIED | REJECTED
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES snick_submissions(id),
  method TEXT NOT NULL,          -- text | photo_ai | partner
  result TEXT NOT NULL,          -- PASS | FAIL | PENDING
  confidence REAL,
  actor_user_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS xp_transactions (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  user_id TEXT,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS couple_stats (
  couple_id TEXT PRIMARY KEY REFERENCES couples(id),
  total_xp INTEGER NOT NULL DEFAULT 0,
  snicks_completed INTEGER NOT NULL DEFAULT 0,
  snicks_offered INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_date TEXT
);

CREATE TABLE IF NOT EXISTS category_progress (
  couple_id TEXT NOT NULL REFERENCES couples(id),
  category TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (couple_id, category)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL,
  user_id TEXT,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);

-- Audit / event backbone (engine 21)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  couple_id TEXT,
  user_id TEXT,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_couple_date ON daily_snicks(couple_id, local_date);
CREATE INDEX IF NOT EXISTS idx_events_couple ON events(couple_id, created_at);

-- ===========================================================================
-- Phase 4-7 engines
-- ===========================================================================

-- Engine 10 + 11: chat. The server stores ciphertext and lifecycle only.
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  created_at INTEGER NOT NULL,
  UNIQUE (couple_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  couple_id TEXT NOT NULL REFERENCES couples(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  ciphertext TEXT NOT NULL,   -- opaque to the server
  nonce TEXT,
  kind TEXT NOT NULL DEFAULT 'text', -- text | media | emoji
  media_id TEXT,
  emoji_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,         -- NULL = keeps forever
  delivered_at INTEGER,
  read_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_msg_expiry ON messages(expires_at);

-- Engine 13: memories
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  note TEXT,
  happened_on TEXT,           -- YYYY-MM-DD
  source TEXT NOT NULL DEFAULT 'manual', -- manual | chat | snick
  source_ref TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_media (
  memory_id TEXT NOT NULL REFERENCES memories(id),
  media_id TEXT NOT NULL REFERENCES media(id),
  PRIMARY KEY (memory_id, media_id)
);

-- Engine 14: calendar
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  created_by TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'date', -- anniversary | birthday | date | plan
  event_date TEXT NOT NULL,          -- YYYY-MM-DD
  recurs_yearly INTEGER NOT NULL DEFAULT 0,
  memory_id TEXT,
  remind_days_before INTEGER NOT NULL DEFAULT 1,
  last_reminded_for TEXT,
  created_at INTEGER NOT NULL
);

-- Engine 16 + 17: community, moderation
CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  media_id TEXT,
  visibility TEXT NOT NULL,   -- PRIVATE_COUPLE | COMMUNITY
  status TEXT NOT NULL DEFAULT 'VISIBLE', -- VISIBLE | HIDDEN | REMOVED
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON community_posts(visibility, status, created_at);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id TEXT NOT NULL REFERENCES community_posts(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL,  -- post | user
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN | ACTIONED | DISMISSED
  resolved_by TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_couple_id TEXT NOT NULL,
  blocked_couple_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_couple_id, blocked_couple_id)
);

-- Engine 19: custom emoji / stickers
CREATE TABLE IF NOT EXISTS custom_emojis (
  id TEXT PRIMARY KEY,
  pack TEXT NOT NULL,
  name TEXT NOT NULL,
  glyph TEXT,
  media_id TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

-- Engine 20: product analytics (kept apart from the audit log)
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT,
  couple_id TEXT,
  props TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_an_name ON analytics_events(name, created_at);

-- Engine 22: admin
CREATE TABLE IF NOT EXISTS admin_actions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
