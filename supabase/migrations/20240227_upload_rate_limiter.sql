-- ============================================================
-- Upload Rate Limiter — Daily upload tracking columns
-- ============================================================
-- Adds daily_uploads counter and last_upload_reset timestamp
-- to the profiles table for per-user rate limiting.

DO $$
BEGIN
    -- Daily upload counter (resets every 24h)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='daily_uploads') THEN
        ALTER TABLE profiles ADD COLUMN daily_uploads INTEGER DEFAULT 0 NOT NULL;
    END IF;

    -- Timestamp of last counter reset
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_upload_reset') THEN
        ALTER TABLE profiles ADD COLUMN last_upload_reset TIMESTAMPTZ DEFAULT now() NOT NULL;
    END IF;
END $$;
