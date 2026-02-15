-- Add master_url column to identity_views for per-angle master identity images
ALTER TABLE identity_views ADD COLUMN IF NOT EXISTS master_url TEXT;
