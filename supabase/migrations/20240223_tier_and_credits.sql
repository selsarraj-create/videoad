-- ============================================================
-- Phase 2: Tiered Accounts & Credit System
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Expand subscription tiers on profiles
-- ────────────────────────────────────────────────────────────

-- Drop the old constraint and add expanded one
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

-- Migrate 'free' → 'starter' for consistency
UPDATE profiles SET subscription_status = 'starter' WHERE subscription_status = 'free';

ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_status_check
    CHECK (subscription_status IN ('starter', 'pro', 'high_octane'));

-- Default new rows to 'starter'
ALTER TABLE profiles ALTER COLUMN subscription_status SET DEFAULT 'starter';

-- ────────────────────────────────────────────────────────────
-- 2. Add credit & trial columns to profiles
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='credit_balance') THEN
        ALTER TABLE profiles ADD COLUMN credit_balance INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='trial_ends_at') THEN
        ALTER TABLE profiles ADD COLUMN trial_ends_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='monthly_credit_grant') THEN
        ALTER TABLE profiles ADD COLUMN monthly_credit_grant INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='render_priority') THEN
        ALTER TABLE profiles ADD COLUMN render_priority INT DEFAULT 3;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. Credit Transactions — immutable ledger
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INT NOT NULL,                          -- negative = debit, positive = credit
    balance_after INT NOT NULL,                   -- snapshot of balance post-tx
    reason TEXT NOT NULL
        CHECK (reason IN ('generation', 'purchase', 'monthly_grant', 'refund', 'admin')),
    engine_id TEXT,                                -- which model was used (for debits)
    job_id UUID,                                  -- linked job (for debits)
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_tx_reason ON credit_transactions(reason);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit transactions"
    ON credit_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Insert-only via service role (API routes handle credit logic)

-- ────────────────────────────────────────────────────────────
-- 4. Set High-Octane users to 20 monthly credits
-- ────────────────────────────────────────────────────────────
UPDATE profiles
SET monthly_credit_grant = 20,
    render_priority = 1
WHERE subscription_status = 'high_octane';

-- Set Pro users priority
UPDATE profiles
SET render_priority = 2
WHERE subscription_status = 'pro';
