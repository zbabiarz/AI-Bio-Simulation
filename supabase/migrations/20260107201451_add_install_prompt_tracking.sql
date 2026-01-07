/*
  # Add Install Prompt Tracking

  1. Changes
    - Add `install_prompt_count` column to `user_profiles` table
    - Tracks how many times the install prompt has been shown to the user
    - Default value is 0

  2. Purpose
    - Used to show install-to-homescreen instructions only for the first 2 logins
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'install_prompt_count'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN install_prompt_count integer DEFAULT 0;
  END IF;
END $$;