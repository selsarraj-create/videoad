-- ============================================================
-- Public Showcase (Community Feed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public_showcase (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    garment_metadata JSONB NOT NULL DEFAULT '[]',
    persona_id UUID REFERENCES identities(id),
    hearts INTEGER DEFAULT 0,
    ai_labeled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for feed performance
CREATE INDEX IF NOT EXISTS idx_showcase_hearts ON public_showcase(hearts DESC);

-- ============================================================
-- Gamification: Credit Award Logic
-- ============================================================
-- Note: This assumes a 'render_credits' column exists in profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS render_credits INTEGER DEFAULT 10;

CREATE OR REPLACE FUNCTION award_creator_credits()
RETURNS TRIGGER AS $$
BEGIN
    -- Award 5 credits for every 50 hearts (milestone check)
    IF (NEW.hearts >= 50 AND OLD.hearts < 50) OR 
       (NEW.hearts >= 100 AND OLD.hearts < 100) OR
       (NEW.hearts >= 150 AND OLD.hearts < 150) THEN
        UPDATE profiles 
        SET render_credits = render_credits + 5
        WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_award_showcase_credits
AFTER UPDATE OF hearts ON public_showcase
FOR EACH ROW
EXECUTE FUNCTION award_creator_credits();
