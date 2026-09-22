-- Run once in Supabase SQL Editor. Each account owns exactly one JSON document.
create table if not exists public.pockit_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pockit_data enable row level security;
revoke all on public.pockit_data from anon;
grant select, insert, update, delete on public.pockit_data to authenticated;

drop policy if exists "Users read their own budget" on public.pockit_data;
drop policy if exists "Users insert their own budget" on public.pockit_data;
drop policy if exists "Users update their own budget" on public.pockit_data;
drop policy if exists "Users delete their own budget" on public.pockit_data;

create policy "Users read their own budget" on public.pockit_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert their own budget" on public.pockit_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own budget" on public.pockit_data
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete their own budget" on public.pockit_data
  for delete to authenticated using ((select auth.uid()) = user_id);
