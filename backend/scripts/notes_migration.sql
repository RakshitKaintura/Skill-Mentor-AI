-- ════════════════════════════════════════════════════════════
-- SkillMentor AI — User Notes Migration
-- Run once in Supabase SQL Editor: Dashboard → SQL Editor → New query
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id   UUID        REFERENCES lessons(id) ON DELETE SET NULL,
  roadmap_id  UUID        REFERENCES roadmaps(id) ON DELETE SET NULL,
  skill       TEXT        NOT NULL,
  topic       TEXT        NOT NULL,
  step_index  INTEGER     DEFAULT NULL,  -- NULL = general lesson note
  step_title  TEXT,
  content     TEXT        NOT NULL,      -- user text (markdown supported)
  ai_summary  TEXT        DEFAULT NULL,  -- Gemini bullet-point summary
  tags        TEXT[]      DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS user_notes_user_created_idx ON user_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notes_lesson_idx       ON user_notes(lesson_id);
CREATE INDEX IF NOT EXISTS user_notes_tags_gin_idx     ON user_notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS user_notes_fts_idx          ON user_notes
  USING GIN(to_tsvector('english', coalesce(content, '') || ' ' || coalesce(topic, '')));

-- Row Level Security
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own notes" ON user_notes;
CREATE POLICY "users manage own notes" ON user_notes
  FOR ALL USING (auth.uid() = user_id);

-- Auto-update updated_at (reuses existing trigger function)
DROP TRIGGER IF EXISTS user_notes_updated_at ON user_notes;
CREATE TRIGGER user_notes_updated_at
  BEFORE UPDATE ON user_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
