-- ============================================================
-- Viral Showcase: Lineage & Permission
-- ============================================================
ALTER TABLE public_showcase 
ADD COLUMN IF NOT EXISTS allow_remix BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS original_creator_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS original_showcase_id UUID REFERENCES public_showcase(id);

-- Index for lineage lookups
CREATE INDEX IF NOT EXISTS idx_showcase_original_creator ON public_showcase(original_creator_id);
CREATE INDEX IF NOT EXISTS idx_showcase_lineage ON public_showcase(original_showcase_id);
