/*
  # Add Admin RLS Policies for Full Dashboard Access

  1. Security Updates
    - Add policy for admins to view all biosimulation_sessions
    - Add policy for admins to delete user_profiles
    - Add policy for admins to view all health_metrics
    - Add policy for admins to view all simulations
    - Add policy for admins to view all activity_logs

  2. Notes
    - These policies enable the admin dashboard to access all user data
    - Admin status is verified by checking is_admin flag in user_profiles
    - Cascading deletes handle related data when a user is removed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can view all biosimulation sessions' 
    AND tablename = 'biosimulation_sessions'
  ) THEN
    CREATE POLICY "Admins can view all biosimulation sessions"
      ON biosimulation_sessions
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND is_admin = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can delete user profiles' 
    AND tablename = 'user_profiles'
  ) THEN
    CREATE POLICY "Admins can delete user profiles"
      ON user_profiles
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND is_admin = true
        )
        AND id != auth.uid()
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can view all health metrics' 
    AND tablename = 'health_metrics'
  ) THEN
    CREATE POLICY "Admins can view all health metrics"
      ON health_metrics
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND is_admin = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can view all simulations' 
    AND tablename = 'simulations'
  ) THEN
    CREATE POLICY "Admins can view all simulations"
      ON simulations
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND is_admin = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Admins can view all activity logs' 
    AND tablename = 'activity_logs'
  ) THEN
    CREATE POLICY "Admins can view all activity logs"
      ON activity_logs
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid() AND is_admin = true
        )
      );
  END IF;
END $$;