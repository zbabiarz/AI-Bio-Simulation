/*
  # Create Device Connections Table

  1. New Tables
    - `device_connections`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `provider` (text: 'apple', 'oura', 'garmin', 'whoop', 'fitbit', 'samsung', 'polar', 'amazfit', 'xiaomi')
      - `connection_type` (text: 'oauth', 'manual')
      - `access_token` (text, encrypted, nullable - for OAuth)
      - `refresh_token` (text, encrypted, nullable - for OAuth)
      - `token_expires_at` (timestamptz, nullable)
      - `external_user_id` (text, nullable - provider's user ID)
      - `last_sync_at` (timestamptz, nullable)
      - `sync_status` (text: 'active', 'paused', 'error', 'disconnected')
      - `sync_error` (text, nullable)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can only manage their own connections
*/

CREATE TABLE IF NOT EXISTS device_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('apple', 'oura', 'garmin', 'whoop', 'fitbit', 'samsung', 'polar', 'amazfit', 'xiaomi')),
  connection_type text NOT NULL CHECK (connection_type IN ('oauth', 'manual')),
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  external_user_id text,
  last_sync_at timestamptz,
  sync_status text DEFAULT 'active' CHECK (sync_status IN ('active', 'paused', 'error', 'disconnected')),
  sync_error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_device_connections_user ON device_connections(user_id);
CREATE INDEX idx_device_connections_provider ON device_connections(provider, sync_status);

ALTER TABLE device_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON device_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
  ON device_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON device_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON device_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);