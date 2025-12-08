/*
  # Create Enhanced Audit Logs for HIPAA Compliance

  1. New Tables
    - `phi_access_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, who accessed the data)
      - `target_user_id` (uuid, whose data was accessed, nullable for own data)
      - `access_type` (text: 'view', 'create', 'update', 'delete', 'export')
      - `resource_type` (text: 'health_metrics', 'simulations', 'goals', etc.)
      - `resource_id` (uuid, nullable)
      - `ip_address` (text, nullable)
      - `user_agent` (text, nullable)
      - `reason` (text, nullable - for admin access)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)

    - `security_events`
      - `id` (uuid, primary key)
      - `event_type` (text: 'login', 'logout', 'failed_login', 'password_change', 'data_export', 'account_deletion', 'suspicious_activity')
      - `user_id` (uuid, nullable)
      - `ip_address` (text)
      - `user_agent` (text)
      - `details` (jsonb)
      - `severity` (text: 'info', 'warning', 'critical')
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Only admins can view all logs
    - Users can view their own access logs
*/

CREATE TABLE IF NOT EXISTS phi_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  access_type text NOT NULL CHECK (access_type IN ('view', 'create', 'update', 'delete', 'export')),
  resource_type text NOT NULL,
  resource_id uuid,
  ip_address text,
  user_agent text,
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_phi_access_logs_user ON phi_access_logs(user_id, created_at DESC);
CREATE INDEX idx_phi_access_logs_target ON phi_access_logs(target_user_id, created_at DESC);
CREATE INDEX idx_phi_access_logs_resource ON phi_access_logs(resource_type, created_at DESC);

ALTER TABLE phi_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access logs"
  ON phi_access_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = target_user_id);

CREATE POLICY "Users can insert own access logs"
  ON phi_access_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all access logs"
  ON phi_access_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('login', 'logout', 'failed_login', 'password_change', 'data_export', 'account_deletion', 'suspicious_activity', 'mfa_enabled', 'mfa_disabled', 'session_timeout')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}',
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_security_events_type ON security_events(event_type, created_at DESC);
CREATE INDEX idx_security_events_user ON security_events(user_id, created_at DESC);
CREATE INDEX idx_security_events_severity ON security_events(severity, created_at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view security events"
  ON security_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "System can insert security events"
  ON security_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);