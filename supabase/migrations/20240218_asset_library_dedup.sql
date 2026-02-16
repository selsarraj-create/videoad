-- ============================================================
-- Phase 23: Asset Library — Deduplication Guardrail
-- SHA-256 hash of product image URL as deterministic cache key.
-- Enables zero-cost VTO cache hits across all product sources.
-- ============================================================

ALTER TABLE asset_library ADD COLUMN IF NOT EXISTS product_url_hash TEXT;

-- Unique partial index — only one VTO render per unique product image
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_library_url_hash
    ON asset_library(product_url_hash) WHERE product_url_hash IS NOT NULL;
