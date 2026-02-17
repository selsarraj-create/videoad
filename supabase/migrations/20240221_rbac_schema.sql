-- ============================================================================
-- RBAC Schema: Roles, Brands, Bounties, Submissions
-- ============================================================================

-- 1. Role Enum + Profiles Update
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('creator', 'brand', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'creator',
    ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Backfill: all existing users default to creator
UPDATE profiles SET role = 'creator' WHERE role IS NULL;

-- Index for middleware role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 2. Brands Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS brands (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name text NOT NULL,
    logo_url     text,
    invoice_email text,
    website      text,
    created_at   timestamptz DEFAULT now(),

    UNIQUE(profile_id)  -- 1:1 with user
);

CREATE INDEX IF NOT EXISTS idx_brands_profile_id ON brands(profile_id);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

-- Brand owners can read/update their own record
CREATE POLICY brands_select_own ON brands
    FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY brands_insert_own ON brands
    FOR INSERT WITH CHECK (
        profile_id = auth.uid()
        AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'brand'
    );

CREATE POLICY brands_update_own ON brands
    FOR UPDATE USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

-- 3. Bounties Table (Brand-created campaigns)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE bounty_status AS ENUM ('draft', 'active', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS bounties (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id     uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    title        text NOT NULL,
    description  text,
    budget_gbp   integer NOT NULL DEFAULT 0,
    deadline     timestamptz,
    requirements jsonb DEFAULT '{}',
    status       bounty_status DEFAULT 'draft',
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bounties_brand_id ON bounties(brand_id);
CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status);

ALTER TABLE bounties ENABLE ROW LEVEL SECURITY;

-- Brands: full CRUD on their own bounties
CREATE POLICY bounties_select_own ON bounties
    FOR SELECT USING (
        brand_id IN (SELECT id FROM brands WHERE profile_id = auth.uid())
    );

-- Creators: read active bounties only
CREATE POLICY bounties_select_active ON bounties
    FOR SELECT USING (
        status = 'active'
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('creator', 'admin')
    );

-- Only brands can insert bounties
CREATE POLICY bounties_insert_brand ON bounties
    FOR INSERT WITH CHECK (
        brand_id IN (SELECT id FROM brands WHERE profile_id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('brand', 'admin')
    );

-- Only brands can update their own bounties
CREATE POLICY bounties_update_brand ON bounties
    FOR UPDATE USING (
        brand_id IN (SELECT id FROM brands WHERE profile_id = auth.uid())
    ) WITH CHECK (
        brand_id IN (SELECT id FROM brands WHERE profile_id = auth.uid())
    );

-- 4. Submissions Table (Creator responses to bounties)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE submission_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS submissions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bounty_id   uuid NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
    creator_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_url   text,
    message     text,
    status      submission_status DEFAULT 'pending',
    created_at  timestamptz DEFAULT now(),

    UNIQUE(bounty_id, creator_id)  -- One submission per creator per bounty
);

CREATE INDEX IF NOT EXISTS idx_submissions_bounty_id ON submissions(bounty_id);
CREATE INDEX IF NOT EXISTS idx_submissions_creator_id ON submissions(creator_id);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Creators: read and insert their own submissions
CREATE POLICY submissions_select_own ON submissions
    FOR SELECT USING (creator_id = auth.uid());

CREATE POLICY submissions_insert_creator ON submissions
    FOR INSERT WITH CHECK (
        creator_id = auth.uid()
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('creator', 'admin')
    );

-- Brands: read submissions to their bounties
CREATE POLICY submissions_select_brand ON submissions
    FOR SELECT USING (
        bounty_id IN (
            SELECT b.id FROM bounties b
            JOIN brands br ON b.brand_id = br.id
            WHERE br.profile_id = auth.uid()
        )
    );

-- Brands: update submission status (accept/reject)
CREATE POLICY submissions_update_brand ON submissions
    FOR UPDATE USING (
        bounty_id IN (
            SELECT b.id FROM bounties b
            JOIN brands br ON b.brand_id = br.id
            WHERE br.profile_id = auth.uid()
        )
    ) WITH CHECK (
        bounty_id IN (
            SELECT b.id FROM bounties b
            JOIN brands br ON b.brand_id = br.id
            WHERE br.profile_id = auth.uid()
        )
    );
