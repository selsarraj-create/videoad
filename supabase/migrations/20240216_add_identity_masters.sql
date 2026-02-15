-- Persona Slots: up to 5 named identity masters per user
CREATE TABLE IF NOT EXISTS identity_masters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Default',
    identity_image_url TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_identity_masters_user_id ON identity_masters(user_id);

-- RLS (open for testing)
ALTER TABLE identity_masters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for testing" ON identity_masters FOR ALL USING (true) WITH CHECK (true);
