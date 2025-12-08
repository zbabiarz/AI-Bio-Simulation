/*
  # Create Badges and Achievements Tables

  1. New Tables
    - `badges`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `icon` (text)
      - `category` (text: 'activity', 'sleep', 'consistency', 'milestone')
      - `requirement_type` (text)
      - `requirement_value` (numeric)
      - `points` (integer)
      - `created_at` (timestamptz)

    - `user_badges`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `badge_id` (uuid, references badges)
      - `earned_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Badges are publicly readable
    - User badges restricted to owners
*/

CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL CHECK (category IN ('activity', 'sleep', 'consistency', 'milestone', 'simulation')),
  requirement_type text NOT NULL,
  requirement_value numeric NOT NULL,
  points integer DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user ON user_badges(user_id);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges"
  ON badges
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view own earned badges"
  ON user_badges
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can earn badges"
  ON user_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

INSERT INTO badges (name, description, icon, category, requirement_type, requirement_value, points) VALUES
  ('First Steps', 'Upload your first wearable data', 'footprints', 'milestone', 'uploads', 1, 10),
  ('Data Explorer', 'Upload data from 3 different days', 'compass', 'milestone', 'days_tracked', 3, 25),
  ('Week Warrior', 'Track 7 consecutive days', 'calendar', 'consistency', 'streak', 7, 50),
  ('Sleep Champion', 'Achieve 8+ hours of sleep for 5 days', 'moon', 'sleep', 'sleep_goal_days', 5, 40),
  ('Step Master', 'Reach 10,000 steps in a day', 'trending-up', 'activity', 'daily_steps', 10000, 30),
  ('HRV Improver', 'Improve your HRV by 5 points', 'heart-pulse', 'milestone', 'hrv_improvement', 5, 50),
  ('Simulation Seeker', 'Run your first bio-simulation', 'brain', 'simulation', 'simulations', 1, 20),
  ('Goal Getter', 'Complete your first health goal', 'target', 'milestone', 'goals_completed', 1, 35),
  ('Recovery Pro', 'Achieve 90%+ recovery score 3 times', 'battery-charging', 'milestone', 'high_recovery', 3, 45),
  ('Month Master', 'Track 30 consecutive days', 'award', 'consistency', 'streak', 30, 100);