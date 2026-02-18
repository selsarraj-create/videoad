-- Add phone and bio columns to brands table
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bio text;
