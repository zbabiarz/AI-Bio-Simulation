/*
  # Fix User Profiles RLS Policy

  1. Changes
    - Drop the problematic "Admins can view all profiles" policy that causes infinite recursion
    - The policy was checking user_profiles table within a policy for user_profiles table
    - For now, users can only view their own profile
    - Admin functionality can be implemented differently if needed (e.g., through service role or different approach)

  2. Security
    - Maintains secure access - users can only view/edit their own profiles
    - Removes the infinite recursion issue
*/

DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
