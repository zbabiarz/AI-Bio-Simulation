/*
  # Create wearable_data table for normalized health data

  1. New Tables
    - `wearable_data`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `source` (text) - device/file source (oura, fitbit, apple_health, etc.)
      - `normalized` (jsonb) - normalized health metrics
      - `raw_filename` (text) - original uploaded filename
      - `created_at` (timestamptz)

  2. Normalized JSONB structure:
    - hrv (number)
    - resting_hr (number)
    - sleep_hours (number)
    - steps (number)
    - recovery_score (number)

  3. Security
    - Enable RLS
    - Users can only access their own wearable data
*/

CREATE TABLE IF NOT EXISTS wearable_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source text NOT NULL,
  normalized jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_filename text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wearable_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wearable data"
  ON wearable_data
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wearable data"
  ON wearable_data
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wearable data"
  ON wearable_data
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wearable data"
  ON wearable_data
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_wearable_data_user_id ON wearable_data(user_id);
CREATE INDEX idx_wearable_data_created_at ON wearable_data(created_at DESC);
