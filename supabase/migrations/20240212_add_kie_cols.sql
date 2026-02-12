-- Add columns for external provider tracking
alter table public.jobs 
add column if not exists provider_task_id text,
add column if not exists model text;

-- Add index for poll performance
create index if not exists jobs_provider_task_id_idx on public.jobs(provider_task_id);
