/*
  # Add sleep_score column to health_metrics

  1. Changes
    - Add `sleep_score` column (integer, 0-100) to health_metrics table
    - This column stores overall sleep quality scores from wearable devices

  2. Notes
    - Some devices (like Oura, Whoop) provide a computed sleep score
    - This is separate from deep_sleep_minutes and acts as an alternative metric
    - Used as a fallback in health score calculations when deep sleep data is unavailable
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'health_metrics' AND column_name = 'sleep_score'
  ) THEN
    ALTER TABLE health_metrics ADD COLUMN sleep_score integer;

    COMMENT ON COLUMN health_metrics.sleep_score IS 'Overall sleep quality score (0-100) from wearable device';
  END IF;
END $$;
