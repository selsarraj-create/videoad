-- Migration: Add user_id to jobs & media_library, fix RLS policies
-- This ensures each user only sees their own data

-- ════════════════════════════════════════════
-- 1. Add user_id column to jobs table
-- ════════════════════════════════════════════
ALTER TABLE public.jobs
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill existing jobs with user_id from workspace chain
UPDATE public.jobs j
SET user_id = w.user_id
FROM public.projects p
JOIN public.workspaces w ON p.workspace_id = w.id
WHERE j.project_id = p.id AND j.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);

-- ════════════════════════════════════════════
-- 2. Add user_id column to media_library table
-- ════════════════════════════════════════════
ALTER TABLE public.media_library
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill existing media_library via jobs → projects → workspaces
UPDATE public.media_library ml
SET user_id = w.user_id
FROM public.jobs j
JOIN public.projects p ON j.project_id = p.id
JOIN public.workspaces w ON p.workspace_id = w.id
WHERE ml.job_id = j.id AND ml.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_library_user_id ON public.media_library(user_id);

-- ════════════════════════════════════════════
-- 3. Replace open media_library RLS policy
-- ════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all access to media_library" ON public.media_library;

CREATE POLICY "Users can view own media"
    ON public.media_library FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own media"
    ON public.media_library FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media"
    ON public.media_library FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own media"
    ON public.media_library FOR DELETE
    USING (auth.uid() = user_id);

-- Service role (workers) bypass RLS, so they can still write

-- ════════════════════════════════════════════
-- 4. Fix identities RLS (currently open)
-- ════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all access for testing" ON public.identities;

CREATE POLICY "Users can view own identities"
    ON public.identities FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own identities"
    ON public.identities FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own identities"
    ON public.identities FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own identities"
    ON public.identities FOR DELETE
    USING (auth.uid() = user_id);

-- ════════════════════════════════════════════
-- 5. Fix identity_views RLS (currently open)
-- ════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all access for testing" ON public.identity_views;

CREATE POLICY "Users can view own identity views"
    ON public.identity_views FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.identities
        WHERE identities.id = identity_views.identity_id
        AND identities.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own identity views"
    ON public.identity_views FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.identities
        WHERE identities.id = identity_id
        AND identities.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own identity views"
    ON public.identity_views FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.identities
        WHERE identities.id = identity_views.identity_id
        AND identities.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own identity views"
    ON public.identity_views FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.identities
        WHERE identities.id = identity_views.identity_id
        AND identities.user_id = auth.uid()
    ));

-- ════════════════════════════════════════════
-- 6. Fix current_looks RLS (if open)
-- ════════════════════════════════════════════
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'current_looks') THEN
        EXECUTE 'ALTER TABLE public.current_looks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_current_looks_user_id ON public.current_looks(user_id)';
    END IF;
END $$;
