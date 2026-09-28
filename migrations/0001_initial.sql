PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('chatgpt_import','custom_gpt','manual')),
  raw_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('raw','processing','ready','failed')),
  processing_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_captures_recent_hash ON captures(source_type, content_hash, created_at);

CREATE TABLE IF NOT EXISTS ideas (
  id TEXT PRIMARY KEY,
  capture_id TEXT REFERENCES captures(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  original_question TEXT NOT NULL,
  summary TEXT NOT NULL,
  conclusion TEXT NOT NULL,
  unresolved_items TEXT NOT NULL DEFAULT '[]',
  next_actions TEXT NOT NULL DEFAULT '[]',
  ai_suggestions TEXT NOT NULL DEFAULT '[]',
  kind TEXT NOT NULL,
  category TEXT NOT NULL,
  importance TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_excerpt TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_hash ON ideas(content_hash, created_at);

CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS idea_tags (
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, tag_id)
);
