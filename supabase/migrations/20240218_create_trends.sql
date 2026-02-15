-- ============================================================
-- Trends table (The Look of the Day Source)
-- ============================================================
CREATE TABLE IF NOT EXISTS trends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    look_of_the_day_date DATE UNIQUE DEFAULT CURRENT_DATE,
    retail_item JSONB NOT NULL,    -- From Skimlinks (title, price, url, image, brand)
    vintage_accessory JSONB NOT NULL, -- From eBay (title, price, url, image)
    vibe_category TEXT NOT NULL,   -- Quiet Luxury, Loud Layers, etc.
    growth_score DECIMAL(5, 2),    -- % growth over 7 days
    discovery_log JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for date-based retrieval
CREATE INDEX IF NOT EXISTS idx_trends_date ON trends(look_of_the_day_date);

-- RLS for Trend retrieval
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public trends are viewable by everyone" ON trends FOR SELECT USING (true);
