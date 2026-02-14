-- Migration: Media Library table for storing on-model try-on results
-- Run via Supabase SQL editor

create table if not exists public.media_library (
    id uuid default uuid_generate_v4() primary key,
    job_id uuid references public.jobs(id) on delete cascade,
    image_url text not null,
    person_image_url text,
    garment_image_url text,
    label text default '',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disable RLS for testing (auth removed)
alter table public.media_library enable row level security;

create policy "Allow all access to media_library"
    on public.media_library for all
    using (true)
    with check (true);
