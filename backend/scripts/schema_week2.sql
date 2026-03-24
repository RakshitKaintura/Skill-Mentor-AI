-- ════════════════════════════════════════════════════════════
-- SkillMentor AI — Week 2 Schema Additions
-- Run this AFTER schema.sql in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- Add new columns to lessons
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS pdf_notes_url  TEXT,
  ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS key_takeaway   TEXT,
  ADD COLUMN IF NOT EXISTS next_topic     TEXT;


-- ════════════════════════════════════════════════════════════
-- TABLE: voice_sessions
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS voice_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id        UUID REFERENCES lessons(id) ON DELETE SET NULL,
  roadmap_id       UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
  topic            TEXT NOT NULL,
  skill            TEXT NOT NULL,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  transcript       TEXT,
  interruptions    INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'active'
                     CHECK (status IN ('active','completed','abandoned'))
);

CREATE INDEX IF NOT EXISTS voice_sessions_user_id_idx   ON voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS voice_sessions_lesson_id_idx ON voice_sessions(lesson_id);

ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_sessions_own" ON voice_sessions
  FOR ALL USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- TABLE: doubts
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS doubts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id    UUID REFERENCES lessons(id) ON DELETE SET NULL,
  topic        TEXT NOT NULL,
  skill        TEXT NOT NULL,
  question     TEXT NOT NULL,
  answer       TEXT,
  analogy      TEXT,
  code_example TEXT,
  helpful      BOOLEAN,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS doubts_user_id_idx ON doubts(user_id);

ALTER TABLE doubts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doubts_own" ON doubts
  FOR ALL USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- FUNCTION: update_streak
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_last_active DATE;
  v_today       DATE := CURRENT_DATE;
BEGIN
  SELECT last_active_date INTO v_last_active
  FROM user_progress WHERE user_id = p_user_id;

  IF v_last_active IS NULL OR v_last_active < v_today - INTERVAL '1 day' THEN
    UPDATE user_progress
    SET streak_days = 1, last_active_date = v_today, updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF v_last_active = v_today - INTERVAL '1 day' THEN
    UPDATE user_progress
    SET streak_days = streak_days + 1, last_active_date = v_today, updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- FUNCTION: get_user_lesson_stats
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_user_lesson_stats(p_user_id UUID)
RETURNS TABLE(
  total_lessons     BIGINT,
  completed_lessons BIGINT,
  completion_rate   FLOAT
) LANGUAGE SQL STABLE AS $$
  SELECT
    COUNT(*)                                        AS total_lessons,
    COUNT(*) FILTER (WHERE completed = TRUE)        AS completed_lessons,
    CASE WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(COUNT(*) FILTER (WHERE completed = TRUE)::FLOAT / COUNT(*) * 100, 1)
    END                                             AS completion_rate
  FROM lessons
  WHERE user_id = p_user_id;
$$;
