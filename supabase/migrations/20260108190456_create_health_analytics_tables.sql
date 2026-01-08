/*
  # Health Analytics Engine Tables

  1. New Tables
    - `health_scores` - Daily computed health scores with component breakdowns
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `date` (date, unique per user)
      - `overall_score` (integer, 0-100)
      - `hrv_score` (integer, 0-100)
      - `sleep_score` (integer, 0-100)
      - `recovery_score` (integer, 0-100)
      - `activity_score` (integer, 0-100)
      - `hrv_weight` (decimal, AI-determined weight)
      - `sleep_weight` (decimal)
      - `recovery_weight` (decimal)
      - `activity_weight` (decimal)
      - `ai_reasoning` (text, explanation of weighting)
      - `created_at` (timestamptz)

    - `personal_records` - Track personal bests across metrics
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `metric_type` (text, e.g., 'highest_hrv', 'best_sleep_efficiency')
      - `record_value` (decimal)
      - `previous_record` (decimal, nullable)
      - `achieved_date` (date)
      - `record_scope` (text, 'all_time' or 'monthly')
      - `created_at` (timestamptz)

    - `user_baselines` - Personal baseline values for anomaly detection
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `metric_type` (text)
      - `mean_value` (decimal)
      - `std_deviation` (decimal)
      - `sample_count` (integer)
      - `calculated_at` (timestamptz)
      - `next_recalc_at` (timestamptz)

    - `anomaly_alerts` - Detected anomalies in health data
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `metric_type` (text)
      - `detected_value` (decimal)
      - `baseline_value` (decimal)
      - `deviation_amount` (decimal)
      - `severity` (text, 'warning' or 'critical')
      - `insight` (text, AI-generated explanation)
      - `seen` (boolean, default false)
      - `detected_at` (timestamptz)
      - `created_at` (timestamptz)

    - `ai_insights` - AI-generated personalized insights
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `insight_text` (text)
      - `insight_type` (text, 'observation', 'recommendation', 'celebration')
      - `source_metrics` (text array)
      - `why_it_matters` (text)
      - `generated_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `is_weekly` (boolean)
      - `created_at` (timestamptz)

    - `weekly_analytics` - Cached week-over-week comparisons
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `week_start` (date)
      - `week_end` (date)
      - `avg_hrv` (decimal)
      - `avg_deep_sleep` (decimal)
      - `avg_sleep_score` (decimal)
      - `avg_recovery` (decimal)
      - `avg_steps` (decimal)
      - `avg_resting_hr` (decimal)
      - `avg_health_score` (decimal)
      - `hrv_change_pct` (decimal, vs previous week)
      - `sleep_change_pct` (decimal)
      - `recovery_change_pct` (decimal)
      - `steps_change_pct` (decimal)
      - `health_score_change_pct` (decimal)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Health Scores Table
CREATE TABLE IF NOT EXISTS health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  overall_score integer NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  hrv_score integer CHECK (hrv_score >= 0 AND hrv_score <= 100),
  sleep_score integer CHECK (sleep_score >= 0 AND sleep_score <= 100),
  recovery_score integer CHECK (recovery_score >= 0 AND recovery_score <= 100),
  activity_score integer CHECK (activity_score >= 0 AND activity_score <= 100),
  hrv_weight decimal(4,3) DEFAULT 0.25,
  sleep_weight decimal(4,3) DEFAULT 0.25,
  recovery_weight decimal(4,3) DEFAULT 0.25,
  activity_weight decimal(4,3) DEFAULT 0.25,
  ai_reasoning text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own health scores"
  ON health_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health scores"
  ON health_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health scores"
  ON health_scores FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health scores"
  ON health_scores FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Personal Records Table
CREATE TABLE IF NOT EXISTS personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  metric_type text NOT NULL,
  record_value decimal NOT NULL,
  previous_record decimal,
  achieved_date date NOT NULL,
  record_scope text NOT NULL DEFAULT 'all_time' CHECK (record_scope IN ('all_time', 'monthly')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, metric_type, record_scope)
);

ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own personal records"
  ON personal_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personal records"
  ON personal_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personal records"
  ON personal_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personal records"
  ON personal_records FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User Baselines Table
CREATE TABLE IF NOT EXISTS user_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  metric_type text NOT NULL,
  mean_value decimal NOT NULL,
  std_deviation decimal NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  calculated_at timestamptz DEFAULT now(),
  next_recalc_at timestamptz DEFAULT (now() + interval '30 days'),
  UNIQUE(user_id, metric_type)
);

ALTER TABLE user_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own baselines"
  ON user_baselines FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own baselines"
  ON user_baselines FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own baselines"
  ON user_baselines FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own baselines"
  ON user_baselines FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Anomaly Alerts Table
CREATE TABLE IF NOT EXISTS anomaly_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  metric_type text NOT NULL,
  detected_value decimal NOT NULL,
  baseline_value decimal NOT NULL,
  deviation_amount decimal NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  insight text,
  seen boolean DEFAULT false,
  detected_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE anomaly_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own anomaly alerts"
  ON anomaly_alerts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own anomaly alerts"
  ON anomaly_alerts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own anomaly alerts"
  ON anomaly_alerts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own anomaly alerts"
  ON anomaly_alerts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI Insights Table
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  insight_text text NOT NULL,
  insight_type text NOT NULL CHECK (insight_type IN ('observation', 'recommendation', 'celebration')),
  source_metrics text[] DEFAULT '{}',
  why_it_matters text,
  generated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  is_weekly boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai insights"
  ON ai_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai insights"
  ON ai_insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai insights"
  ON ai_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai insights"
  ON ai_insights FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Weekly Analytics Table
CREATE TABLE IF NOT EXISTS weekly_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  avg_hrv decimal,
  avg_deep_sleep decimal,
  avg_sleep_score decimal,
  avg_recovery decimal,
  avg_steps decimal,
  avg_resting_hr decimal,
  avg_health_score decimal,
  hrv_change_pct decimal,
  sleep_change_pct decimal,
  recovery_change_pct decimal,
  steps_change_pct decimal,
  health_score_change_pct decimal,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE weekly_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly analytics"
  ON weekly_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly analytics"
  ON weekly_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly analytics"
  ON weekly_analytics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly analytics"
  ON weekly_analytics FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_scores_user_date ON health_scores(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_personal_records_user ON personal_records(user_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_user_baselines_user ON user_baselines(user_id, metric_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_alerts_user_unseen ON anomaly_alerts(user_id, seen, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_active ON ai_insights(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_analytics_user_week ON weekly_analytics(user_id, week_start DESC);
