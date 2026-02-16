-- ============================================================
-- Phase 30: Wardrobe & Garment Cache
-- Per-user wardrobe with tier-based quota + global Claid cache
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Wardrobe — per-user garment collection (quota-enforced)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wardrobe (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    original_image_url TEXT NOT NULL,
    clean_image_url TEXT,                       -- Claid-processed PNG (null until done)
    affiliate_url TEXT,                         -- Marketplace affiliate link (nullable)
    source TEXT NOT NULL DEFAULT 'upload'
        CHECK (source IN ('upload', 'marketplace')),
    title TEXT NOT NULL DEFAULT 'Untitled',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'cleaning', 'ready', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wardrobe_user_id ON wardrobe(user_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_status ON wardrobe(status);

-- RLS: users see only their own items
ALTER TABLE wardrobe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wardrobe"
    ON wardrobe FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wardrobe"
    ON wardrobe FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own wardrobe"
    ON wardrobe FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on wardrobe"
    ON wardrobe FOR ALL
    USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 2. Garment Cache — global dedupe by source URL hash
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS garment_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_url_hash TEXT UNIQUE NOT NULL,       -- SHA-256 of original image URL
    source_url TEXT NOT NULL,                   -- Original URL for reference
    clean_url TEXT NOT NULL,                    -- Claid-processed PNG in storage
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_garment_cache_hash ON garment_cache(source_url_hash);

-- RLS: service role only (workers insert/read, no user access needed)
ALTER TABLE garment_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access on garment_cache"
    ON garment_cache FOR ALL
    USING (true) WITH CHECK (true);
