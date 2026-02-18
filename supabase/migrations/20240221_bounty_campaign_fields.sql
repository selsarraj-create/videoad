-- 20240221_bounty_campaign_fields.sql
-- Add payment_per_video and product_image_url to bounties

ALTER TABLE bounties
  ADD COLUMN IF NOT EXISTS payment_per_video integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_image_url text;
