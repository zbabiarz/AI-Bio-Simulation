/*
  # Add Health Intake Modifiers to User Profiles

  1. Changes to `user_profiles`
    - `age` (integer) - User's age for risk adjustment
    - `sex` (text) - Biological sex for physiological baselines
    - `has_heart_failure` (boolean) - Heart failure condition modifier
    - `has_diabetes` (boolean) - Diabetes condition modifier
    - `has_chronic_kidney_disease` (boolean) - CKD condition modifier
    - `intake_completed` (boolean) - Whether health intake has been completed

  2. Notes
    - All new columns are nullable to support existing users
    - intake_completed defaults to false
    - Medical condition booleans default to false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'age'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN age integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sex'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sex text CHECK (sex IN ('male', 'female', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'has_heart_failure'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN has_heart_failure boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'has_diabetes'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN has_diabetes boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'has_chronic_kidney_disease'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN has_chronic_kidney_disease boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'intake_completed'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN intake_completed boolean DEFAULT false;
  END IF;
END $$;