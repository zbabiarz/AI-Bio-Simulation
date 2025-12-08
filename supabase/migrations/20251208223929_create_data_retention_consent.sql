/*
  # Create Data Retention and User Consent Tables

  1. New Tables
    - `data_retention_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `retention_days` (integer, default 365)
      - `auto_delete_enabled` (boolean, default false)
      - `last_activity_at` (timestamptz)
      - `scheduled_deletion_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `user_consents`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `consent_type` (text: 'privacy_policy', 'terms_of_service', 'data_processing', 'marketing')
      - `consented` (boolean)
      - `version` (text, version of the document consented to)
      - `ip_address` (text)
      - `created_at` (timestamptz)
      - `revoked_at` (timestamptz, nullable)

    - `data_access_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid)
      - `request_type` (text: 'export', 'deletion', 'amendment')
      - `status` (text: 'pending', 'processing', 'completed', 'denied')
      - `requested_at` (timestamptz)
      - `completed_at` (timestamptz, nullable)
      - `notes` (text, nullable)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own records
*/

CREATE TABLE IF NOT EXISTS data_retention_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  retention_days integer DEFAULT 365 CHECK (retention_days >= 30 AND retention_days <= 2555),
  auto_delete_enabled boolean DEFAULT false,
  last_activity_at timestamptz DEFAULT now(),
  scheduled_deletion_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE data_retention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own retention settings"
  ON data_retention_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own retention settings"
  ON data_retention_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own retention settings"
  ON data_retention_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('privacy_policy', 'terms_of_service', 'data_processing', 'hipaa_authorization', 'marketing')),
  consented boolean NOT NULL,
  version text NOT NULL,
  ip_address text,
  created_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(user_id, consent_type, version)
);

CREATE INDEX idx_user_consents_user ON user_consents(user_id, consent_type);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consents"
  ON user_consents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consents"
  ON user_consents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consents"
  ON user_consents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS data_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('export', 'deletion', 'amendment', 'access')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'denied')),
  description text,
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  processed_by uuid REFERENCES user_profiles(id),
  notes text
);

CREATE INDEX idx_data_access_requests_user ON data_access_requests(user_id, status);

ALTER TABLE data_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON data_access_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own requests"
  ON data_access_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
  ON data_access_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update requests"
  ON data_access_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );