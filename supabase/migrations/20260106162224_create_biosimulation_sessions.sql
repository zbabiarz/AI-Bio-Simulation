/*
  # Create Biosimulation Sessions Table

  1. New Tables
    - `biosimulation_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `hrv_classification` (text) - low/moderate/favorable
      - `deep_sleep_classification` (text) - inadequate/borderline/adequate
      - `avg_hrv` (numeric) - Average HRV from input data
      - `avg_deep_sleep_minutes` (integer) - Average deep sleep from input data
      - `data_days_analyzed` (integer) - Number of days of data used
      - `dementia_risk` (jsonb) - Risk trajectory data
      - `cardiovascular_risk` (jsonb) - Risk trajectory data
      - `heart_failure_risk` (jsonb) - Risk trajectory data
      - `cognitive_decline_risk` (jsonb) - Risk trajectory data
      - `metabolic_risk` (jsonb) - Risk trajectory data
      - `clinical_narrative` (text) - Generated clinical interpretation
      - `recommendations` (jsonb) - Array of intervention recommendations
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `biosimulation_sessions` table
    - Users can only access their own sessions
*/

CREATE TABLE IF NOT EXISTS biosimulation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  hrv_classification text NOT NULL CHECK (hrv_classification IN ('low', 'moderate', 'favorable')),
  deep_sleep_classification text NOT NULL CHECK (deep_sleep_classification IN ('inadequate', 'borderline', 'adequate')),
  avg_hrv numeric NOT NULL,
  avg_deep_sleep_minutes integer NOT NULL,
  data_days_analyzed integer NOT NULL DEFAULT 0,
  dementia_risk jsonb NOT NULL DEFAULT '{}',
  cardiovascular_risk jsonb NOT NULL DEFAULT '{}',
  heart_failure_risk jsonb NOT NULL DEFAULT '{}',
  cognitive_decline_risk jsonb NOT NULL DEFAULT '{}',
  metabolic_risk jsonb NOT NULL DEFAULT '{}',
  clinical_narrative text,
  recommendations jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biosimulation_sessions_user ON biosimulation_sessions(user_id, created_at DESC);

ALTER TABLE biosimulation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own biosimulation sessions"
  ON biosimulation_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own biosimulation sessions"
  ON biosimulation_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own biosimulation sessions"
  ON biosimulation_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);