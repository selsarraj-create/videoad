-- ============================================================
-- Phase 22: Asset Library — Trending + Category Columns
-- Supports Google Trends integration and category-based browsing
-- ============================================================

ALTER TABLE asset_library ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false;
ALTER TABLE asset_library ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE asset_library ADD COLUMN IF NOT EXISTS trend_keyword TEXT;
ALTER TABLE asset_library ADD COLUMN IF NOT EXISTS last_trend_refresh TIMESTAMPTZ;
ALTER TABLE asset_library ADD COLUMN IF NOT EXISTS merchant_name TEXT;

-- Partial index on trending items (fast lookups for trend feed)
CREATE INDEX IF NOT EXISTS idx_asset_library_trending
    ON asset_library(is_trending) WHERE is_trending = true;

-- Category-based filtering
CREATE INDEX IF NOT EXISTS idx_asset_library_category_id
    ON asset_library(category_id);
