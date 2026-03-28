-- ============================================================
-- SKILLMENTOR AI — ANALYTICS SCHEMA
-- ============================================================

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  event_data  JSONB DEFAULT '{}'::jsonb,
  session_id  TEXT,
  page        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_events(created_at DESC);

-- ─────────────────────────────────────────
-- PLATFORM STATS VIEW
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW platform_stats AS
SELECT
  (SELECT COUNT(*)                              FROM profiles)                                         AS total_users,
  (SELECT COUNT(*)                              FROM profiles   WHERE created_at > NOW() - INTERVAL '7 days') AS new_users_week,
  (SELECT COALESCE(SUM(lessons_completed),  0)  FROM user_progress)                                   AS total_lessons,
  (SELECT COALESCE(SUM(quizzes_completed),  0)  FROM user_progress)                                   AS total_quizzes,
  (SELECT COALESCE(SUM(xp_points),          0)  FROM user_progress)                                   AS total_xp,
  (SELECT COALESCE(AVG(streak_days),        0)  FROM user_progress)                                   AS avg_streak,
  (SELECT COUNT(*)                              FROM certificates)                                     AS certs_issued,
  (SELECT COUNT(*)                              FROM interview_sessions WHERE completed = TRUE)        AS interviews_done,
  (SELECT COUNT(*)                              FROM projects           WHERE status    = 'reviewed')  AS projects_reviewed,
  (SELECT COUNT(*)                              FROM code_challenges    WHERE passed    = TRUE)        AS challenges_passed;

-- ─────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_insert_analytics" ON analytics_events;
CREATE POLICY "users_insert_analytics" ON analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "service_read_analytics" ON analytics_events;
CREATE POLICY "service_read_analytics" ON analytics_events
  FOR SELECT USING (auth.role() = 'service_role');