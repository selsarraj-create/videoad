-- Multi-angle identity views: stores validated photos from each angle
CREATE TABLE IF NOT EXISTS identity_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identity_id UUID REFERENCES identities(id) ON DELETE CASCADE,
    angle TEXT NOT NULL CHECK (angle IN ('front', 'profile', 'three_quarter')),
    image_url TEXT NOT NULL,
    validation_result JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected')),
    source TEXT DEFAULT 'camera' CHECK (source IN ('camera', 'upload')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(identity_id, angle)
);

-- Track which onboarding mode was used
ALTER TABLE identities ADD COLUMN IF NOT EXISTS onboarding_mode TEXT DEFAULT 'ai_director'
    CHECK (onboarding_mode IN ('ai_director', 'manual'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_identity_views_identity_id ON identity_views(identity_id);

-- RLS (open for testing)
ALTER TABLE identity_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for testing" ON identity_views FOR ALL USING (true) WITH CHECK (true);
