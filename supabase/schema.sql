-- Slow Tide: optional cloud saves.
-- Run this once in your Supabase project (Dashboard → SQL Editor → New query → Run).
--
-- One row per player. Row level security means a signed-in player can only ever read,
-- create, change or delete their own row; signed-out visitors can't touch the table at all.

create table if not exists public.slow_tide_saves (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  version    integer not null check (version > 0),          -- save format version (see src/save.js)
  rev        integer not null default 1 check (rev > 0),    -- bumped on every write, to spot two devices saving at once
  saved_at   timestamptz not null default now(),            -- when the game saved it
  data       jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 2000000),
  updated_at timestamptz not null default now()
);

alter table public.slow_tide_saves enable row level security;

drop policy if exists "Players read their own save" on public.slow_tide_saves;
drop policy if exists "Players create their own save" on public.slow_tide_saves;
drop policy if exists "Players update their own save" on public.slow_tide_saves;
drop policy if exists "Players delete their own save" on public.slow_tide_saves;

create policy "Players read their own save" on public.slow_tide_saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players create their own save" on public.slow_tide_saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update their own save" on public.slow_tide_saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Players delete their own save" on public.slow_tide_saves
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.slow_tide_saves from anon;
revoke all on public.slow_tide_saves from public;
grant select, insert, update, delete on public.slow_tide_saves to authenticated;

create or replace function public.slow_tide_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists slow_tide_touch on public.slow_tide_saves;
create trigger slow_tide_touch before update on public.slow_tide_saves
  for each row execute function public.slow_tide_touch();
