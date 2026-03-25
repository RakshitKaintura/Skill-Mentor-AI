-- Align existing Week 3 tables so compatibility fallbacks can be removed safely.
-- Run in Supabase SQL editor before removing fallback logic.

BEGIN;

-- ============================================================
-- QUIZZES: add missing columns found in legacy deployments
-- ============================================================
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS skill TEXT,
  ADD COLUMN IF NOT EXISTS week_number INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'beginner' CHECK (difficulty IN ('beginner','intermediate','advanced')),
  ADD COLUMN IF NOT EXISTS quiz_type TEXT DEFAULT 'lesson' CHECK (quiz_type IN ('lesson','weekly','spaced_repetition')),
  ADD COLUMN IF NOT EXISTS user_answers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS total_questions INT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS time_limit_secs INT DEFAULT 300,
  ADD COLUMN IF NOT EXISTS time_taken_secs INT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS xp_awarded INT DEFAULT 0;

-- Backfill reasonable defaults for required columns.
UPDATE quizzes
SET skill = COALESCE(skill, 'General')
WHERE skill IS NULL;

UPDATE quizzes
SET total_questions = CASE
  WHEN total_questions IS NULL OR total_questions <= 0 THEN
    CASE
      WHEN jsonb_typeof(questions) = 'array' THEN GREATEST(jsonb_array_length(questions), 1)
      ELSE 5
    END
  ELSE total_questions
END;

-- ============================================================
-- REPORT_CARDS: support both xp_earned and xp_earned_total variants
-- ============================================================
ALTER TABLE report_cards
  ADD COLUMN IF NOT EXISTS xp_earned INT DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'report_cards' AND column_name = 'xp_earned_total'
  ) THEN
    EXECUTE 'UPDATE report_cards SET xp_earned = COALESCE(xp_earned, xp_earned_total, 0)';
  END IF;
END $$;

-- ============================================================
-- CODE_CHALLENGES: support both user_code and last_user_code variants
-- ============================================================
ALTER TABLE code_challenges
  ADD COLUMN IF NOT EXISTS user_code TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'code_challenges' AND column_name = 'last_user_code'
  ) THEN
    EXECUTE 'UPDATE code_challenges SET user_code = COALESCE(user_code, last_user_code)';
  END IF;
END $$;

COMMIT;
