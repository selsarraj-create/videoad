-- ============================================================
-- Step 1: Ensure profiles table exists & add stripe_account_id
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add stripe_account_id if missing (using separate block for safety)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='stripe_account_id') THEN
        ALTER TABLE profiles ADD COLUMN stripe_account_id TEXT;
    END IF;
END $$;

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for testing" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Step 2: Commissions table — tracking sales & splits
-- ============================================================
CREATE TABLE IF NOT EXISTS commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    transaction_id TEXT UNIQUE NOT NULL, -- From Skimlinks/eBay
    source TEXT NOT NULL, -- 'skimlinks' or 'ebay'
    total_amount NUMERIC(10,2) NOT NULL,
    user_amount NUMERIC(10,2) NOT NULL, -- The 0.5 split
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Step 3: Indexes & RLS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_transaction ON commissions(transaction_id);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own commissions" ON commissions
    FOR SELECT USING (auth.uid() = user_id);
