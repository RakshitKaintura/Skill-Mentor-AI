-- ════════════════════════════════════════════════════════════
-- SkillMentor AI — Complete Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ════════════════════════════════════════════════════════════

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Auto-update updated_at helper ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════════════════
-- TABLE: profiles
-- Extends Supabase auth.users with learning metadata
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT,
  email                 TEXT,
  avatar_url            TEXT,
  current_skill         TEXT,
  onboarding_completed  BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ════════════════════════════════════════════════════════════
-- TABLE: roadmaps
-- AI-generated personalized learning roadmaps
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS roadmaps (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill                     TEXT NOT NULL,
  level                     TEXT NOT NULL CHECK (level IN ('beginner','some','intermediate')),
  goal                      TEXT NOT NULL,
  hours_per_day             FLOAT NOT NULL CHECK (hours_per_day > 0),
  total_weeks               INTEGER NOT NULL,
  current_week              INTEGER DEFAULT 1,
  current_phase             TEXT,
  current_topic             TEXT,
  phases                    JSONB NOT NULL DEFAULT '[]',
  daily_schedule            TEXT,
  final_project             TEXT,
  job_readiness_checklist   JSONB DEFAULT '[]',
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS roadmaps_user_id_idx ON roadmaps(user_id);
CREATE INDEX IF NOT EXISTS roadmaps_created_at_idx ON roadmaps(created_at DESC);


-- ════════════════════════════════════════════════════════════
-- TABLE: lessons
-- AI-generated lesson content for each topic
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lessons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id     UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic          TEXT NOT NULL,
  week_number    INTEGER,
  phase_number   INTEGER,
  steps          JSONB NOT NULL DEFAULT '[]',
  sources_used   JSONB DEFAULT '[]',
  audio_url      TEXT,
  pdf_notes_url  TEXT,
  completed      BOOLEAN DEFAULT FALSE,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lessons_user_id_idx    ON lessons(user_id);
CREATE INDEX IF NOT EXISTS lessons_roadmap_id_idx ON lessons(roadmap_id);


-- ════════════════════════════════════════════════════════════
-- TABLE: quizzes
-- Auto-generated quizzes linked to lessons or topics
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quizzes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID REFERENCES lessons(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic       TEXT NOT NULL,
  questions   JSONB NOT NULL DEFAULT '[]',
  results     JSONB DEFAULT '[]',
  score       FLOAT,
  completed   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quizzes_user_id_idx ON quizzes(user_id);


-- ════════════════════════════════════════════════════════════
-- TABLE: user_books
-- Student-uploaded PDF textbooks and syllabi
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_books (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name           TEXT NOT NULL,
  file_path           TEXT NOT NULL,
  skill_tag           TEXT NOT NULL,
  processing_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (processing_status IN ('pending','processing','completed','failed')),
  total_chunks        INTEGER,
  topics_detected     JSONB DEFAULT '[]',
  error_message       TEXT,
  file_size_bytes     INTEGER,
  is_curated          BOOLEAN DEFAULT FALSE,  -- TRUE for global admin-uploaded books
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_books_user_id_idx   ON user_books(user_id);
CREATE INDEX IF NOT EXISTS user_books_skill_tag_idx ON user_books(skill_tag);
CREATE INDEX IF NOT EXISTS user_books_curated_idx   ON user_books(is_curated) WHERE is_curated = TRUE;


-- ════════════════════════════════════════════════════════════
-- TABLE: book_chunks
-- Vector embeddings of PDF chunks for RAG retrieval
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS book_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_tag     TEXT NOT NULL,
  chunk_index   INTEGER NOT NULL,
  content       TEXT NOT NULL,
  embedding     vector(768),    -- Gemini text-embedding-004 dimension
  source_label  TEXT,           -- "filename · page N" for citations
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS book_chunks_user_id_idx  ON book_chunks(user_id);
CREATE INDEX IF NOT EXISTS book_chunks_book_id_idx  ON book_chunks(book_id);
CREATE INDEX IF NOT EXISTS book_chunks_skill_idx    ON book_chunks(skill_tag);

-- IVFFlat index for fast approximate nearest-neighbour search
-- lists=100 is good for up to ~1M vectors; increase for more data
CREATE INDEX IF NOT EXISTS book_chunks_embedding_idx
  ON book_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ════════════════════════════════════════════════════════════
-- TABLE: user_progress
-- Single row per user tracking all progress metrics
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_progress (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  xp_points             INTEGER DEFAULT 0,
  streak_days           INTEGER DEFAULT 0,
  last_active_date      DATE,
  lessons_completed     INTEGER DEFAULT 0,
  quizzes_completed     INTEGER DEFAULT 0,
  total_study_minutes   INTEGER DEFAULT 0,
  topic_mastery         JSONB DEFAULT '{}',  -- {"Variables": 85, "Functions": 60}
  badges_earned         JSONB DEFAULT '[]',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER user_progress_updated_at
  BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ════════════════════════════════════════════════════════════
-- FUNCTION: search_book_chunks
-- pgvector semantic search used by rag_service.py
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION search_book_chunks(
  query_embedding   vector(768),
  target_user_id    UUID,
  target_skill      TEXT,
  include_curated   BOOLEAN DEFAULT TRUE,
  match_count       INTEGER DEFAULT 5
)
RETURNS TABLE (
  id           UUID,
  content      TEXT,
  source_label TEXT,
  skill_tag    TEXT,
  similarity   FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    bc.id,
    bc.content,
    bc.source_label,
    bc.skill_tag,
    1 - (bc.embedding <=> query_embedding) AS similarity
  FROM book_chunks bc
  JOIN user_books  ub ON bc.book_id = ub.id
  WHERE
    (bc.user_id = target_user_id OR (include_curated AND ub.is_curated = TRUE))
    AND bc.skill_tag  = target_skill
    AND ub.processing_status = 'completed'
  ORDER BY bc.embedding <=> query_embedding
  LIMIT match_count;
$$;


-- ════════════════════════════════════════════════════════════
-- FUNCTION: increment_xp
-- Safely increments XP for a user
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_xp(p_user_id UUID, p_amount INTEGER)
RETURNS VOID LANGUAGE SQL AS $$
  UPDATE user_progress
  SET xp_points = xp_points + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;
$$;


-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Users can only see and modify their own data
-- ════════════════════════════════════════════════════════════
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons        ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_books     ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_chunks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress  ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- roadmaps
CREATE POLICY "roadmaps_own" ON roadmaps
  FOR ALL USING (auth.uid() = user_id);

-- lessons
CREATE POLICY "lessons_own" ON lessons
  FOR ALL USING (auth.uid() = user_id);

-- quizzes
CREATE POLICY "quizzes_own" ON quizzes
  FOR ALL USING (auth.uid() = user_id);

-- user_books: own books + curated (global) books are readable by all
CREATE POLICY "books_read" ON user_books
  FOR SELECT USING (auth.uid() = user_id OR is_curated = TRUE);

CREATE POLICY "books_write" ON user_books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "books_delete" ON user_books
  FOR DELETE USING (auth.uid() = user_id);

-- book_chunks: same as books
CREATE POLICY "chunks_read" ON book_chunks
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_books ub
      WHERE ub.id = book_chunks.book_id AND ub.is_curated = TRUE
    )
  );

CREATE POLICY "chunks_write" ON book_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_progress
CREATE POLICY "progress_own" ON user_progress
  FOR ALL USING (auth.uid() = user_id);
