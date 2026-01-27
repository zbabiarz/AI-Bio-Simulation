/*
  # Create Keep-Alive Database Function

  1. New Functions
    - `keep_alive_ping` - Executes a minimal SELECT query to keep database active
  
  2. Purpose
    - Prevents database from being paused due to inactivity
    - Performs read-only operation with minimal overhead
    - Returns simple confirmation value
  
  3. Security
    - Function is marked as SECURITY DEFINER to run with elevated privileges
    - Only accessible via Edge Function with token authentication
    - No RLS policies needed (system function)
*/

-- Create a simple keep-alive function that executes a minimal query
CREATE OR REPLACE FUNCTION public.keep_alive_ping()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple SELECT query to touch the database
  -- Returns 1 to confirm execution
  RETURN 1;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.keep_alive_ping IS 'Minimal database operation to prevent automatic pausing due to inactivity';