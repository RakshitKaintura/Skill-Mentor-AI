-- ============================================================
-- SKILLMENTOR AI — WEEK 4 SCHEMA
-- Run in Supabase SQL Editor after schema_week3.sql
-- ============================================================

-- ─────────────────────────────────────────
-- 1. PROJECTS TABLE (Agent 7)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id       UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  skill            TEXT NOT NULL,
  level            TEXT NOT NULL CHECK (level IN ('beginner','intermediate','advanced','expert')),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  requirements     JSONB DEFAULT '[]',
  tech_stack       JSONB DEFAULT '[]',
  starter_hints    JSONB DEFAULT '[]',
  expected_outcome TEXT,
  estimated_hours  INT DEFAULT 8,
  submitted_code   TEXT,
  github_url       TEXT,
  review           JSONB,
  score            INT,
  grade            TEXT,
  status           TEXT DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','submitted','reviewed')),
  assigned_at      TIMESTAMPTZ DEFAULT NOW(),
  submitted_at     TIMESTAMPTZ,
  reviewed_at      TIMESTAMPTZ,
  xp_awarded       INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 2. INTERVIEW SESSIONS TABLE (Agent 8)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  roadmap_id       UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  skill            TEXT NOT NULL,
  level            TEXT NOT NULL,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  interview_type   TEXT DEFAULT 'technical' CHECK (interview_type IN ('technical','behavioral','mixed','system_design')),
  company_target   TEXT,
  questions        JSONB DEFAULT '[]',
  answers          JSONB DEFAULT '[]',
  evaluations      JSONB DEFAULT '[]',
  overall_score    INT,
  overall_feedback TEXT,
  strengths        JSONB DEFAULT '[]',
  improvements     JSONB DEFAULT '[]',
  job_ready        BOOLEAN DEFAULT FALSE,
  completed        BOOLEAN DEFAULT FALSE,
  completed_at     TIMESTAMPTZ,
  xp_awarded       INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- 3. RESUMES TABLE (Agent 8)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resumes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  roadmap_id       UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  skill            TEXT NOT NULL,
  raw_text         TEXT,
  full_name        TEXT,
  email            TEXT,
  phone            TEXT,
  linkedin         TEXT,
  github           TEXT,
  summary          TEXT,
  skills           JSONB DEFAULT '[]',
  projects         JSONB DEFAULT '[]',
  experience       JSONB DEFAULT '[]',
  education        JSONB DEFAULT '[]',
  ats_score        INT,
  ai_verdict       TEXT,
  critique         JSONB DEFAULT '[]',
  ai_review        TEXT,
  ai_score         INT,
  suggestions      JSONB DEFAULT '[]',
  pdf_url          TEXT,
  version          INT DEFAULT 1,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, roadmap_id)
);

-- ─────────────────────────────────────────
-- 4. CERTIFICATES TABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  roadmap_id       UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  skill            TEXT NOT NULL,
  level            TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  issued_at        TIMESTAMPTZ DEFAULT NOW(),
  verify_code      TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  pdf_url          TEXT,
  xp_at_issue      INT DEFAULT 0,
  lessons_count    INT DEFAULT 0,
  projects_count   INT DEFAULT 0,
  quizzes_count    INT DEFAULT 0
);

-- Ensure required columns exist on already-created tables (idempotent upgrades)
ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'interview_sessions_status_check'
      AND conrelid = 'interview_sessions'::regclass
  ) THEN
    ALTER TABLE interview_sessions
      ADD CONSTRAINT interview_sessions_status_check
      CHECK (status IN ('active','completed','abandoned'));
  END IF;
END $$;

ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS raw_text TEXT,
  ADD COLUMN IF NOT EXISTS ats_score INT,
  ADD COLUMN IF NOT EXISTS ai_verdict TEXT,
  ADD COLUMN IF NOT EXISTS critique JSONB DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_user_roadmap_unique
  ON resumes(user_id, roadmap_id);

-- ─────────────────────────────────────────
-- 5. INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_user     ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_user   ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user      ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_certs_user        ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certs_verify      ON certificates(verify_code);

-- ─────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_projects" ON projects;
DROP POLICY IF EXISTS "users_own_interviews" ON interview_sessions;
DROP POLICY IF EXISTS "users_own_resumes" ON resumes;
DROP POLICY IF EXISTS "users_own_certs" ON certificates;
DROP POLICY IF EXISTS "public_verify_cert" ON certificates;

CREATE POLICY "users_own_projects"    ON projects           FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_interviews"  ON interview_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_resumes"     ON resumes            FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_certs"       ON certificates       FOR ALL USING (auth.uid() = user_id);

-- Allow public certificate verification (read-only by verify code)
CREATE POLICY "public_verify_cert" ON certificates
  FOR SELECT USING (true);

-- ─────────────────────────────────────────
-- 7. XP award for project completion
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_project(
  p_project_id UUID,
  p_user_id    UUID,
  p_score      INT
) RETURNS JSONB AS $$
DECLARE
  v_xp INT;
BEGIN
  v_xp := CASE
    WHEN p_score >= 90 THEN 500
    WHEN p_score >= 75 THEN 350
    WHEN p_score >= 60 THEN 200
    ELSE 100
  END;

  UPDATE projects SET
    score       = p_score,
    grade       = CASE WHEN p_score >= 90 THEN 'A' WHEN p_score >= 75 THEN 'B'
                       WHEN p_score >= 60 THEN 'C' ELSE 'D' END,
    status      = 'reviewed',
    reviewed_at = NOW(),
    xp_awarded  = v_xp
  WHERE id = p_project_id AND user_id = p_user_id;

  UPDATE user_progress SET
    xp_points = xp_points + v_xp
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('xp_awarded', v_xp, 'xp_earned', v_xp, 'grade',
    CASE WHEN p_score >= 90 THEN 'A' WHEN p_score >= 75 THEN 'B'
         WHEN p_score >= 60 THEN 'C' ELSE 'D' END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;