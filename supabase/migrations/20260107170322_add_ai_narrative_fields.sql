/*
  # Add AI Narrative Fields and Cache Table

  1. Changes to `biosimulation_sessions`
    - `ai_narrative` (text) - AI-generated personalized clinical narrative
    - `ai_narrative_tokens_used` (integer) - Token count for cost tracking

  2. New Tables
    - `ai_explanation_cache`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `explanation_type` (text) - 'narrative' or 'whatif'
      - `input_hash` (text) - Hash of input parameters for cache lookup
      - `prompt` (text) - The prompt sent to AI
      - `response` (text) - The AI response
      - `tokens_used` (integer) - Token count for cost tracking
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `ai_explanation_cache` table
    - Users can only access their own cached explanations

  4. Indexes
    - Index on `input_hash` for fast cache lookups
    - Index on `user_id` for user-specific queries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'biosimulation_sessions' AND column_name = 'ai_narrative'
  ) THEN
    ALTER TABLE biosimulation_sessions ADD COLUMN ai_narrative text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'biosimulation_sessions' AND column_name = 'ai_narrative_tokens_used'
  ) THEN
    ALTER TABLE biosimulation_sessions ADD COLUMN ai_narrative_tokens_used integer DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_explanation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  explanation_type text NOT NULL CHECK (explanation_type IN ('narrative', 'whatif')),
  input_hash text NOT NULL,
  prompt text NOT NULL,
  response text NOT NULL,
  tokens_used integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_explanation_cache_hash ON ai_explanation_cache(input_hash);
CREATE INDEX IF NOT EXISTS idx_ai_explanation_cache_user ON ai_explanation_cache(user_id, created_at DESC);

ALTER TABLE ai_explanation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cached explanations"
  ON ai_explanation_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cached explanations"
  ON ai_explanation_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cached explanations"
  ON ai_explanation_cache
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
