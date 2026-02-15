-- Build status enum for garment processing pipeline
CREATE TYPE build_status AS ENUM ('pending', 'processing', 'ready', 'failed');

-- Clothes table: retailer garment uploads → 3D processing → ready assets
CREATE TABLE IF NOT EXISTS clothes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'tops',
    raw_image_url TEXT NOT NULL,
    processed_3d_url TEXT,
    glb_url TEXT,
    build_status build_status DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clothes_build_status ON clothes(build_status);

-- RLS
ALTER TABLE clothes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access for admin" ON clothes FOR ALL USING (true) WITH CHECK (true);
