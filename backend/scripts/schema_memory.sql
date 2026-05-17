-- ============================================================
-- Schema: Agent Memory (Rolling Summary Buffer)
-- Run this in the Supabase SQL Editor to set up agent memory.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_memory (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_summary text NOT NULL,
    topics      text[] DEFAULT '{}',
    created_at  timestamptz DEFAULT now() NOT NULL
);

-- Index for fast per-user retrieval ordered by date
CREATE INDEX IF NOT EXISTS idx_user_memory_user_created
    ON user_memory (user_id, created_at DESC);

-- Row Level Security: users can only see and write their own memory
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own memory"
    ON user_memory
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role bypass for backend writes
CREATE POLICY "Service role full access"
    ON user_memory
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
