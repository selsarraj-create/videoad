-- ============================================================
-- Fix Projects RLS: Replace workspace-based policies with strict user_id isolation
-- ============================================================
-- The old workspace-based policies are OR'd with the newer user_id policy,
-- which can leak data to users who shouldn't see certain projects.
-- This migration drops ALL old workspace-based policies and ensures
-- only the strict user_id = auth.uid() policy exists.

-- 1. Drop old workspace-based policies
DROP POLICY IF EXISTS "Users can view projects in their workspaces" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects in their workspaces" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects in their workspaces" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects in their workspaces" ON public.projects;

-- 2. Drop the newer user_id policy (if it exists) so we can recreate cleanly
DROP POLICY IF EXISTS "Users can view own projects by user_id" ON public.projects;

-- 3. Create strict user_id-based policies
CREATE POLICY "projects_select_own"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_own"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "projects_delete_own"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);
