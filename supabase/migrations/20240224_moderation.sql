-- Moderation: content violation tracking & account status
-- Strike 1-2 = warning, Strike 3 = 24h cooldown, 2nd ban in a month = permanent suspension

-- 1. Violation log
CREATE TABLE IF NOT EXISTS public.content_violations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    violation_type TEXT NOT NULL DEFAULT 'safety_filter',  -- safety_filter | banned_content | api_rejection
    source_api TEXT NOT NULL DEFAULT 'unknown',             -- kie | fashn | internal
    job_id UUID,                                            -- optional reference to the job that triggered it
    details JSONB DEFAULT '{}',                              -- raw error payload / filter reason
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Add account_status to profiles (active | cooldown | suspended)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'cooldown', 'suspended')),
    ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 3. RLS — users can read their own violations
ALTER TABLE public.content_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own violations"
    ON public.content_violations FOR SELECT
    USING (auth.uid() = user_id);

-- Admin/service can insert (no user-facing insert policy)
CREATE POLICY "Service can manage violations"
    ON public.content_violations FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_violations_user_created
    ON public.content_violations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
    ON public.profiles(account_status);
