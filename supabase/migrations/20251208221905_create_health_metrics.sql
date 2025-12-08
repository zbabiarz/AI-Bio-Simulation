/*
  # Create Health Metrics Table

  1. New Tables
    - `health_metrics`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `date` (date)
      - `hrv` (numeric, Heart Rate Variability)
      - `resting_heart_rate` (integer)
      - `sleep_duration_minutes` (integer)
      - `sleep_efficiency` (numeric, percentage)
      - `deep_sleep_minutes` (integer)
      - `rem_sleep_minutes` (integer)
      - `light_sleep_minutes` (integer)
      - `steps` (integer)
      - `active_calories` (integer)
      - `total_calories` (integer)
      - `activity_minutes` (integer)
      - `stress_level` (integer, 1-100)
      - `recovery_score` (integer, 1-100)
      - `body_battery` (integer, 1-100)
      - `weight_kg` (numeric)
      - `body_fat_percentage` (numeric)
      - `source` (text, e.g., 'oura', 'apple', 'garmin', 'whoop', 'manual')
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only access their own metrics
*/

CREATE TABLE IF NOT EXISTS health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  hrv numeric,
  resting_heart_rate integer,
  sleep_duration_minutes integer,
  sleep_efficiency numeric,
  deep_sleep_minutes integer,
  rem_sleep_minutes integer,
  light_sleep_minutes integer,
  steps integer,
  active_calories integer,
  total_calories integer,
  activity_minutes integer,
  stress_level integer,
  recovery_score integer,
  body_battery integer,
  weight_kg numeric,
  body_fat_percentage numeric,
  source text DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date, source)
);

CREATE INDEX idx_health_metrics_user_date ON health_metrics(user_id, date DESC);

ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics"
  ON health_metrics
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics"
  ON health_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics"
  ON health_metrics
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own metrics"
  ON health_metrics
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);