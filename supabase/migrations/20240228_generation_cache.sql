-- ============================================================
-- Generation Cache: input_hash column for deduplication
-- ============================================================
-- SHA-256 hash of (prompt + model + resolution + duration + preset)
-- Used to detect identical generation requests and return cached results
-- instead of making redundant paid API calls.

ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS input_hash TEXT;

-- Index for fast cache lookups (hash + status + model)
CREATE INDEX IF NOT EXISTS idx_jobs_input_hash
    ON public.jobs (input_hash)
    WHERE input_hash IS NOT NULL AND status = 'completed';
