-- Add columns for Hybrid Architecture (WaveSpeed + Kie)
alter table public.jobs 
add column if not exists provider_metadata jsonb default '{}'::jsonb,
add column if not exists tier text default 'draft';

-- Add check constraint for tier (optional but good for data integrity)
-- alter table public.jobs add constraint jobs_tier_check check (tier in ('draft', 'production'));

-- Add index on tier for filtering
create index if not exists jobs_tier_idx on public.jobs(tier);
