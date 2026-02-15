-- ============================================================
-- Step 1: Revenue Ledger table (The Source of Truth)
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    skimlinks_transaction_id TEXT UNIQUE,
    ebay_transaction_id TEXT UNIQUE,
    item_name TEXT NOT NULL,
    total_sale_amount DECIMAL(12, 2) NOT NULL,
    raw_commission DECIMAL(12, 2) NOT NULL,
    user_share DECIMAL(12, 2) NOT NULL, -- 50% split
    platform_fee DECIMAL(12, 2) NOT NULL, -- 50% split
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'cleared', 'paid', 'failed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    cleared_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_revenue_ledger_user_id ON revenue_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_ledger_status ON revenue_ledger(status);

-- ============================================================
-- Step 2: RLS Policies for Ledger
-- ============================================================
ALTER TABLE revenue_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ledger"
    ON revenue_ledger FOR SELECT
    USING (auth.uid() = user_id);

-- ============================================================
-- Step 3: Profiles Enhancements for Stripe
-- ============================================================
-- Ensure profiles table exists (redundancy for safety)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    stripe_account_id TEXT UNIQUE,
    payout_enabled BOOLEAN DEFAULT false,
    onboarding_complete BOOLEAN DEFAULT false,
    lifetime_earnings DECIMAL(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for profiles if not already set
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile"
            ON profiles FOR UPDATE
            USING (auth.uid() = id);
    END IF;
END $$;
