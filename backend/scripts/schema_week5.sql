-- ============================================================
-- SKILLMENTOR AI — WEEK 5 SCHEMA
-- Run after schema_week4.sql
-- ============================================================

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────
-- 1. DAILY CHALLENGES TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  roadmap_id      UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  skill           TEXT NOT NULL,
  challenge_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  type            TEXT DEFAULT 'quiz' CHECK (type IN ('quiz','code','theory','review')),
  content         JSONB DEFAULT '{}',
  completed       BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  xp_awarded      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, challenge_date)
);

-- ─────────────────────────────────────────
-- 2. STUDY BUDDY SESSIONS TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_buddy_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  guest_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  skill           TEXT NOT NULL,
  session_code    TEXT UNIQUE NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 6)),
  status          TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','active','completed')),
  shared_quiz_id  UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  host_score      INT,
  guest_score     INT,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. NOTIFICATIONS TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('streak','reminder','achievement','report','challenge','buddy')),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  read        BOOLEAN DEFAULT FALSE,
  action_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 4. USER LANGUAGE PREFERENCES
-- ─────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language  TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS ui_language         TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS timezone            TEXT DEFAULT 'Asia/Kolkata';

-- ─────────────────────────────────────────
-- 5. INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_user_date ON daily_challenges(user_id, challenge_date);
CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_buddy_code      ON study_buddy_sessions(session_code);

-- ─────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────
ALTER TABLE daily_challenges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_buddy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_daily" ON daily_challenges;
CREATE POLICY "users_own_daily" ON daily_challenges
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_own_notifs" ON notifications;
CREATE POLICY "users_own_notifs" ON notifications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "buddy_access" ON study_buddy_sessions;
CREATE POLICY "buddy_access" ON study_buddy_sessions
  FOR ALL
  USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id)
  WITH CHECK (auth.uid() = host_user_id OR auth.uid() = guest_user_id);

-- ─────────────────────────────────────────
-- 7. STREAK GUARD — create notification on streak milestone
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_streak_milestone()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.streak_days IS DISTINCT FROM OLD.streak_days
     AND NEW.streak_days IN (3, 7, 14, 30, 60, 100) THEN
    INSERT INTO notifications(user_id, type, title, message, action_url)
    VALUES (
      NEW.user_id,
      'streak',
      NEW.streak_days || ' Day Streak! 🔥',
      'Amazing! You''ve maintained a ' || NEW.streak_days || ' day learning streak. Keep going!',
      '/dashboard'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS streak_milestone_trigger ON user_progress;
CREATE TRIGGER streak_milestone_trigger
  AFTER UPDATE OF streak_days ON user_progress
  FOR EACH ROW EXECUTE FUNCTION notify_streak_milestone();

-- Generate daily challenge for user
CREATE OR REPLACE FUNCTION get_or_create_daily_challenge(
  p_user_id   UUID,
  p_skill     TEXT,
  p_roadmap_id UUID
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM daily_challenges
  WHERE user_id = p_user_id AND challenge_date = CURRENT_DATE;
  IF FOUND THEN RETURN v_id; END IF;
  -- Will be populated by the agent
  INSERT INTO daily_challenges(user_id, roadmap_id, skill, title, description, type)
  VALUES (p_user_id, p_roadmap_id, p_skill, 'Daily Challenge', 'Generating...', 'quiz')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;