-- ============================================================================
-- Enhanced Submissions: add 'changes_requested' status + new columns
-- ============================================================================

-- 1. Add 'changes_requested' to submission_status enum
-- ============================================================================

ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- 2. Add columns to submissions
-- ============================================================================

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS thumbnail_url text,
    ADD COLUMN IF NOT EXISTS notes text,
    ADD COLUMN IF NOT EXISTS feedback text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Index for brand lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_submissions_bounty_status ON submissions(bounty_id, status);
