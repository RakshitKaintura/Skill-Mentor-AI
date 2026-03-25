-- ============================================================
-- SKILLMENTOR AI — WEEK 3 SCHEMA
-- Run in Supabase SQL Editor after schema_week2.sql
-- ============================================================

-- ─────────────────────────────────────────
-- 1. QUIZZES TABLE (enhanced)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quizzes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       UUID REFERENCES lessons(id) ON DELETE CASCADE,
  roadmap_id      UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic           TEXT NOT NULL,
  skill           TEXT NOT NULL,
  week_number     INT DEFAULT 1,
  difficulty      TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  quiz_type       TEXT DEFAULT 'lesson' CHECK (quiz_type IN ('lesson','weekly','spaced_repetition')),
  questions       JSONB NOT NULL DEFAULT '[]',
  user_answers    JSONB DEFAULT '[]',
  results         JSONB DEFAULT '{}',
  score           INT DEFAULT 0,
  total_questions INT DEFAULT 5,
  time_limit_secs INT DEFAULT 300,
  time_taken_secs INT,
  completed       BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  xp_awarded      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 2. CODE CHALLENGES TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS code_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       UUID REFERENCES lessons(id) ON DELETE CASCADE,
  roadmap_id      UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic           TEXT NOT NULL,
  skill           TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  starter_code    TEXT NOT NULL,
  solution_code   TEXT,
  test_cases      JSONB DEFAULT '[]',
  difficulty      TEXT DEFAULT 'beginner',
  language        TEXT DEFAULT 'javascript',
  hints           JSONB DEFAULT '[]',
  hints_used      INT DEFAULT 0,
  user_code       TEXT,
  passed          BOOLEAN DEFAULT FALSE,
  passed_at       TIMESTAMPTZ,
  attempts        INT DEFAULT 0,
  ai_feedback     TEXT,
  xp_awarded      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. SPACED REPETITION TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spaced_repetition (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic           TEXT NOT NULL,
  skill           TEXT NOT NULL,
  roadmap_id      UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  ease_factor     FLOAT DEFAULT 2.5,
  interval_days   INT DEFAULT 1,
  repetitions     INT DEFAULT 0,
  quality         INT DEFAULT 0,
  next_review_at  TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, topic, skill)
);

-- ─────────────────────────────────────────
-- 4. WEEKLY REPORT CARDS TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  roadmap_id      UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  week_number     INT NOT NULL,
  skill           TEXT NOT NULL,
  summary         TEXT,
  strengths       JSONB DEFAULT '[]',
  weaknesses      JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  lessons_completed INT DEFAULT 0,
  quizzes_completed INT DEFAULT 0,
  challenges_completed INT DEFAULT 0,
  avg_quiz_score  FLOAT DEFAULT 0,
  study_minutes   INT DEFAULT 0,
  xp_earned       INT DEFAULT 0,
  streak_days     INT DEFAULT 0,
  overall_grade   TEXT DEFAULT 'C',
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, roadmap_id, week_number)
);

-- ─────────────────────────────────────────
-- 5. LEADERBOARD VIEW
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.full_name,
  p.current_skill,
  up.xp_points,
  up.streak_days,
  up.lessons_completed,
  up.quizzes_completed,
  RANK() OVER (ORDER BY up.xp_points DESC) AS rank
FROM profiles p
JOIN user_progress up ON p.id = up.user_id
ORDER BY up.xp_points DESC
LIMIT 100;

-- ─────────────────────────────────────────
-- 6. ALTER user_progress — add mastery columns
-- ─────────────────────────────────────────
ALTER TABLE user_progress
  ADD COLUMN IF NOT EXISTS challenges_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weak_topics         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS strong_topics       JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_hints_used    INT DEFAULT 0;

-- ─────────────────────────────────────────
-- 7. INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quizzes_user       ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_roadmap    ON quizzes(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_challenges_user    ON code_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_sr_user_next       ON spaced_repetition(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_report_user        ON report_cards(user_id);

-- ─────────────────────────────────────────
-- 8. RLS POLICIES
-- ─────────────────────────────────────────
ALTER TABLE quizzes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_challenges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaced_repetition  ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_quizzes"      ON quizzes           FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_challenges"   ON code_challenges   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_sr"           ON spaced_repetition FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_reports"      ON report_cards      FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- 9. STORED PROCEDURES
-- ─────────────────────────────────────────

-- SM-2 Spaced Repetition Algorithm
CREATE OR REPLACE FUNCTION update_spaced_repetition(
  p_user_id   UUID,
  p_topic     TEXT,
  p_skill     TEXT,
  p_quality   INT  -- 0-5: 0=complete blackout, 5=perfect
) RETURNS JSONB AS $$
DECLARE
  v_rec spaced_repetition%ROWTYPE;
  v_ef  FLOAT;
  v_interval INT;
  v_reps INT;
BEGIN
  SELECT * INTO v_rec
  FROM spaced_repetition
  WHERE user_id = p_user_id AND topic = p_topic AND skill = p_skill;

  IF NOT FOUND THEN
    INSERT INTO spaced_repetition(user_id, topic, skill, ease_factor, interval_days, repetitions, quality, next_review_at)
    VALUES (p_user_id, p_topic, p_skill, 2.5, 1, 0, p_quality, NOW() + INTERVAL '1 day')
    RETURNING * INTO v_rec;
    RETURN jsonb_build_object('interval_days', 1, 'next_review_at', NOW() + INTERVAL '1 day');
  END IF;

  -- SM-2 algorithm
  v_ef := v_rec.ease_factor + (0.1 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02));
  v_ef := GREATEST(1.3, v_ef);

  IF p_quality < 3 THEN
    v_interval := 1;
    v_reps := 0;
  ELSIF v_rec.repetitions = 0 THEN
    v_interval := 1;
    v_reps := 1;
  ELSIF v_rec.repetitions = 1 THEN
    v_interval := 6;
    v_reps := 2;
  ELSE
    v_interval := ROUND(v_rec.interval_days * v_ef);
    v_reps := v_rec.repetitions + 1;
  END IF;

  UPDATE spaced_repetition SET
    ease_factor      = v_ef,
    interval_days    = v_interval,
    repetitions      = v_reps,
    quality          = p_quality,
    last_reviewed_at = NOW(),
    next_review_at   = NOW() + (v_interval || ' days')::INTERVAL
  WHERE id = v_rec.id;

  RETURN jsonb_build_object('interval_days', v_interval, 'next_review_at', NOW() + (v_interval || ' days')::INTERVAL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get topics due for review
CREATE OR REPLACE FUNCTION get_due_reviews(p_user_id UUID)
RETURNS TABLE(topic TEXT, skill TEXT, interval_days INT, repetitions INT) AS $$
BEGIN
  RETURN QUERY
  SELECT sr.topic, sr.skill, sr.interval_days, sr.repetitions
  FROM spaced_repetition sr
  WHERE sr.user_id = p_user_id
    AND sr.next_review_at <= NOW()
  ORDER BY sr.next_review_at ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award XP for challenge
CREATE OR REPLACE FUNCTION complete_challenge(
  p_challenge_id UUID,
  p_user_id UUID,
  p_user_code TEXT,
  p_hints_used INT,
  p_ai_feedback TEXT
) RETURNS JSONB AS $$
DECLARE
  v_xp INT;
  v_challenge code_challenges%ROWTYPE;
BEGIN
  SELECT * INTO v_challenge FROM code_challenges WHERE id = p_challenge_id AND user_id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not found'); END IF;

  -- XP based on difficulty and hints
  v_xp := CASE v_challenge.difficulty
    WHEN 'beginner'     THEN 50
    WHEN 'intermediate' THEN 100
    WHEN 'advanced'     THEN 150
    ELSE 50
  END;
  v_xp := v_xp - (p_hints_used * 10);
  v_xp := GREATEST(10, v_xp);

  UPDATE code_challenges SET
    user_code    = p_user_code,
    passed       = TRUE,
    passed_at    = NOW(),
    hints_used   = p_hints_used,
    ai_feedback  = p_ai_feedback,
    xp_awarded   = v_xp
  WHERE id = p_challenge_id;

  UPDATE user_progress SET
    xp_points           = xp_points + v_xp,
    challenges_completed = challenges_completed + 1,
    total_hints_used    = total_hints_used + p_hints_used
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('xp_awarded', v_xp, 'passed', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 