/*
  # Create Simulations Table

  1. New Tables
    - `simulations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `input_metrics` (jsonb, current metrics used as baseline)
      - `changes` (jsonb, what-if changes to simulate)
      - `predictions` (jsonb, AI-generated predictions)
      - `recommendations` (text[], actionable recommendations)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only access their own simulations
*/

CREATE TABLE IF NOT EXISTS simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  input_metrics jsonb NOT NULL,
  changes jsonb NOT NULL,
  predictions jsonb NOT NULL,
  recommendations text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_simulations_user ON simulations(user_id, created_at DESC);

ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own simulations"
  ON simulations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create simulations"
  ON simulations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own simulations"
  ON simulations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);