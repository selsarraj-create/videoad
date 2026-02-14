-- ============================================================
-- Step 1: Identities table (must exist before current_looks)
-- ============================================================
CREATE TABLE IF NOT EXISTS identities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    raw_selfie_url TEXT NOT NULL,
    master_identity_url TEXT,
    validation_result JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'validated', 'generating', 'ready', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identities_user_id ON identities(user_id);
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for testing" ON identities FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Step 2: Affiliate Items — product catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS affiliate_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    image_url TEXT,
    affiliate_url TEXT,
    price NUMERIC(10,2) DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'tops'
        CHECK (category IN ('tops', 'bottoms', 'shoes', 'accessories')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Step 3: Current Looks — outfit compositions
-- ============================================================
CREATE TABLE IF NOT EXISTS current_looks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identity_id UUID REFERENCES identities(id),
    garments JSONB DEFAULT '[]'::jsonb,
    name TEXT DEFAULT 'Untitled Look',
    claid_result_url TEXT,
    status TEXT NOT NULL DEFAULT 'building'
        CHECK (status IN ('building', 'rendering', 'ready', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Step 4: Add look_id + outfit_cost to content_links
-- ============================================================
ALTER TABLE content_links ADD COLUMN IF NOT EXISTS look_id UUID REFERENCES current_looks(id);
ALTER TABLE content_links ADD COLUMN IF NOT EXISTS outfit_cost NUMERIC(10,2);

-- ============================================================
-- Indexes & RLS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_affiliate_items_category ON affiliate_items(category);
CREATE INDEX IF NOT EXISTS idx_current_looks_identity ON current_looks(identity_id);

ALTER TABLE affiliate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_looks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for testing" ON affiliate_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for testing" ON current_looks FOR ALL USING (true) WITH CHECK (true);
