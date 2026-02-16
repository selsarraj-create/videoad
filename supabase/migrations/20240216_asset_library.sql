-- ============================================================
-- Phase 21: Fashion Asset Library
-- Caches Universal VTO renders keyed by merchant_offer_id
-- to eliminate redundant Vertex AI VTO calls.
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_library (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    merchant_offer_id TEXT UNIQUE NOT NULL,
    brand TEXT,
    title TEXT NOT NULL,
    category TEXT,
    original_image_url TEXT NOT NULL,        -- High-res merchant image (1024px+)
    merchant_link TEXT NOT NULL,             -- Raw merchant URL (unwrapped)
    price TEXT,
    currency TEXT DEFAULT 'USD',
    universal_vto_urls TEXT[] DEFAULT '{}',  -- All 4 VTO variant GCS URIs
    universal_vto_url TEXT,                  -- Primary/best VTO render
    synthid_applied BOOLEAN DEFAULT false,
    iptc_tagged BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',               -- Searchable: brand, category, keywords
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Fast lookups by offer ID (the cache key)
CREATE INDEX IF NOT EXISTS idx_asset_library_offer ON asset_library(merchant_offer_id);

-- GIN index for tag-based search (brand, category, keywords)
CREATE INDEX IF NOT EXISTS idx_asset_library_tags ON asset_library USING GIN(tags);

-- Full-text search on title for keyword queries
CREATE INDEX IF NOT EXISTS idx_asset_library_title ON asset_library USING GIN(to_tsvector('english', title));

-- RLS
ALTER TABLE asset_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON asset_library FOR SELECT USING (true);
CREATE POLICY "Service role insert/update" ON asset_library FOR ALL USING (true) WITH CHECK (true);
