-- Migration: Content Links table for affiliate URL tracking
-- Run via Supabase SQL editor

create table if not exists public.content_links (
    id uuid default uuid_generate_v4() primary key,
    job_id uuid references public.jobs(id) on delete cascade not null,
    user_id uuid references auth.users(id) not null,
    affiliate_url text,
    title text default '',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.content_links enable row level security;

-- Users can only see their own content links
create policy "Users can view their own content links"
    on public.content_links for select
    using (auth.uid() = user_id);

create policy "Users can insert their own content links"
    on public.content_links for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own content links"
    on public.content_links for update
    using (auth.uid() = user_id);

create policy "Users can delete their own content links"
    on public.content_links for delete
    using (auth.uid() = user_id);
