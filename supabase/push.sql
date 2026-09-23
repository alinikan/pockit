-- Run in Supabase SQL Editor after schema.sql. Each device has one subscription.
create table if not exists public.pockit_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  timezone text not null default 'UTC',
  enabled boolean not null default true,
  last_sent_on date,
  created_at timestamptz not null default now()
);
create index if not exists pockit_push_user_id_idx on public.pockit_push_subscriptions(user_id);
alter table public.pockit_push_subscriptions enable row level security;
revoke all on public.pockit_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.pockit_push_subscriptions to authenticated;
grant select, insert, update, delete on public.pockit_push_subscriptions to service_role;

drop policy if exists "Users see their own push devices" on public.pockit_push_subscriptions;
drop policy if exists "Users add their own push devices" on public.pockit_push_subscriptions;
drop policy if exists "Users update their own push devices" on public.pockit_push_subscriptions;
drop policy if exists "Users remove their own push devices" on public.pockit_push_subscriptions;
create policy "Users see their own push devices" on public.pockit_push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own push devices" on public.pockit_push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own push devices" on public.pockit_push_subscriptions
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users remove their own push devices" on public.pockit_push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);
