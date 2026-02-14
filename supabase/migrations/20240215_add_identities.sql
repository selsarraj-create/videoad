-- Identities table: stores creator selfie + AI-generated master identity
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

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_identities_user_id ON identities(user_id);

-- RLS (open for testing)
ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for testing" ON identities FOR ALL USING (true) WITH CHECK (true);
