/*
  # Create Health Goals Table

  1. New Tables
    - `health_goals`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `metric_type` (text, e.g., 'steps', 'sleep', 'hrv')
      - `target_value` (numeric)
      - `current_value` (numeric)
      - `unit` (text, e.g., 'steps', 'minutes', 'ms')
      - `title` (text)
      - `description` (text)
      - `start_date` (date)
      - `end_date` (date)
      - `status` (text: 'active', 'completed', 'paused')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only manage their own goals
*/

CREATE TABLE IF NOT EXISTS health_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  metric_type text NOT NULL,
  target_value numeric NOT NULL,
  current_value numeric DEFAULT 0,
  unit text NOT NULL,
  title text NOT NULL,
  description text,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_health_goals_user ON health_goals(user_id, status);

ALTER TABLE health_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON health_goals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON health_goals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON health_goals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON health_goals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);