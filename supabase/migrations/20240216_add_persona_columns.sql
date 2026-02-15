-- Add persona columns to existing identities table
ALTER TABLE identities ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Default';
ALTER TABLE identities ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;
