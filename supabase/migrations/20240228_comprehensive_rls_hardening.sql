-- ============================================================
-- Comprehensive RLS Hardening — Fix all data leaks
-- ============================================================
-- Audit findings:
-- 1. jobs: old workspace-based policies leak via OR
-- 2. profiles: wide open USING(true) — anyone can read all profiles
-- 3. current_looks: may still have USING(true) if 0221 migration didn't fix
-- 4. affiliate_items: USING(true) but this is a shared catalog (intentional)
-- 5. commissions: SELECT only, missing INSERT/UPDATE/DELETE guards
-- 6. revenue_ledger: SELECT only, missing INSERT/UPDATE/DELETE guards

-- ════════════════════════════════════════════════════════════
-- 1. FIX JOBS TABLE — Remove old workspace-based policies
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can view jobs in their projects" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert jobs in their projects" ON public.jobs;

-- Create strict user_id-based policies
CREATE POLICY "jobs_select_own" ON public.jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "jobs_insert_own" ON public.jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "jobs_update_own" ON public.jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "jobs_delete_own" ON public.jobs FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- 2. FIX PROFILES TABLE — Replace wide-open policy
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all access for testing" ON public.profiles;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile (may already exist from rev ledger migration)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- ════════════════════════════════════════════════════════════
-- 3. FIX CURRENT_LOOKS — Replace any remaining open policy
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all for testing" ON public.current_looks;

-- Add user_id column if missing
ALTER TABLE public.current_looks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill user_id from identity → user chain
UPDATE public.current_looks cl
SET user_id = i.user_id
FROM public.identities i
WHERE cl.identity_id = i.id AND cl.user_id IS NULL;

-- Create strict policies (drop any existing first)
DROP POLICY IF EXISTS "current_looks_select_own" ON public.current_looks;
DROP POLICY IF EXISTS "current_looks_insert_own" ON public.current_looks;
DROP POLICY IF EXISTS "current_looks_update_own" ON public.current_looks;
DROP POLICY IF EXISTS "current_looks_delete_own" ON public.current_looks;

CREATE POLICY "current_looks_select_own" ON public.current_looks FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "current_looks_insert_own" ON public.current_looks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "current_looks_update_own" ON public.current_looks FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "current_looks_delete_own" ON public.current_looks FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- 4. FIX COMMISSIONS — Add missing write guards
-- ════════════════════════════════════════════════════════════
-- SELECT already exists: "Users can view own commissions"
-- Add INSERT/UPDATE/DELETE guards

CREATE POLICY "commissions_insert_own" ON public.commissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "commissions_update_own" ON public.commissions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "commissions_delete_own" ON public.commissions FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- 5. FIX REVENUE_LEDGER — Add missing write guards
-- ════════════════════════════════════════════════════════════
-- SELECT already exists: "Users can view their own ledger"
-- Users shouldn't write directly, but protect against public writes

CREATE POLICY "revenue_ledger_insert_service" ON public.revenue_ledger FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "revenue_ledger_update_own" ON public.revenue_ledger FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "revenue_ledger_delete_own" ON public.revenue_ledger FOR DELETE
  USING (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- 6. HARDEN CLOTHES TABLE — Remove open policy, add read-only
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all access for admin" ON public.clothes;

-- Clothes are a shared catalog — authenticated users can read
CREATE POLICY "clothes_select_authenticated" ON public.clothes FOR SELECT
  USING (auth.role() = 'authenticated');
-- Service role (workers) bypass RLS for writes

-- ════════════════════════════════════════════════════════════
-- 7. HARDEN AFFILIATE_ITEMS — Remove open policy, add read-only
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all for testing" ON public.affiliate_items;

CREATE POLICY "affiliate_items_select_authenticated" ON public.affiliate_items FOR SELECT
  USING (auth.role() = 'authenticated');
-- Service role handles writes
