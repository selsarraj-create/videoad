-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create tables
create table if not exists public.workspaces (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id) not null
);

create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  status text default 'active' check (status in ('active', 'archived')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.jobs (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  input_params jsonb not null default '{}'::jsonb,
  output_url text,
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.jobs enable row level security;

-- Policies for Workspaces
create policy "Users can view their own workspaces"
  on public.workspaces for select
  using (auth.uid() = user_id);

create policy "Users can insert their own workspaces"
  on public.workspaces for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own workspaces"
  on public.workspaces for update
  using (auth.uid() = user_id);

create policy "Users can delete their own workspaces"
  on public.workspaces for delete
  using (auth.uid() = user_id);

-- Policies for Projects (cascading access via workspace)
create policy "Users can view projects in their workspaces"
  on public.projects for select
  using (exists (
    select 1 from public.workspaces
    where workspaces.id = projects.workspace_id
    and workspaces.user_id = auth.uid()
  ));

create policy "Users can insert projects in their workspaces"
  on public.projects for insert
  with check (exists (
    select 1 from public.workspaces
    where workspaces.id = workspace_id
    and workspaces.user_id = auth.uid()
  ));

create policy "Users can update projects in their workspaces"
  on public.projects for update
  using (exists (
    select 1 from public.workspaces
    where workspaces.id = workspace_id
    and workspaces.user_id = auth.uid()
  ));

create policy "Users can delete projects in their workspaces"
  on public.projects for delete
  using (exists (
    select 1 from public.workspaces
    where workspaces.id = workspace_id
    and workspaces.user_id = auth.uid()
  ));

-- Policies for Jobs (cascading access via project -> workspace)
create policy "Users can view jobs in their projects"
  on public.jobs for select
  using (exists (
    select 1 from public.projects
    join public.workspaces on projects.workspace_id = workspaces.id
    where projects.id = jobs.project_id
    and workspaces.user_id = auth.uid()
  ));

create policy "Users can insert jobs in their projects"
  on public.jobs for insert
  with check (exists (
    select 1 from public.projects
    join public.workspaces on projects.workspace_id = workspaces.id
    where projects.id = project_id
    and workspaces.user_id = auth.uid()
  ));

-- Allow workers (service role) to update jobs
-- Note: Service role bypasses RLS, so explicit policy might strictly limit public access, 
-- but we need to ensure the worker can write.
-- Usually, we use a service_role key for the worker.

-- Storage Buckets Setup (Supabase specific)
-- We cannot create buckets via SQL in standard postgres, but Supabase exposes `storage.buckets`
insert into storage.buckets (id, name, public)
values 
  ('raw_assets', 'raw_assets', false),
  ('final_ads', 'final_ads', true)
on conflict (id) do nothing;

-- Storage Policies
create policy "Authenticated users can upload raw assets"
  on storage.objects for insert
  with check (bucket_id = 'raw_assets' and auth.role() = 'authenticated');

create policy "Users can view their own raw assets"
  on storage.objects for select
  using (bucket_id = 'raw_assets' and auth.uid() = owner);

create policy "Public view for final ads"
  on storage.objects for select
  using (bucket_id = 'final_ads');
