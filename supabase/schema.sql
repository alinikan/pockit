-- Run once in Supabase SQL Editor. Each account owns exactly one JSON document.
create table if not exists public.pockit_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Safe to rerun for projects created before revision tracking was added.
alter table public.pockit_data add column if not exists revision bigint not null default 0;

alter table public.pockit_data enable row level security;
revoke all on public.pockit_data from anon;
revoke insert, update on public.pockit_data from authenticated;
grant select, delete on public.pockit_data to authenticated;

drop policy if exists "Users read their own budget" on public.pockit_data;
drop policy if exists "Users insert their own budget" on public.pockit_data;
drop policy if exists "Users update their own budget" on public.pockit_data;
drop policy if exists "Users delete their own budget" on public.pockit_data;

create policy "Users read their own budget" on public.pockit_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users delete their own budget" on public.pockit_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Atomic compare-and-swap. A stale device cannot silently replace newer data.
create or replace function public.pockit_save(expected_revision bigint, next_data jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare saved_revision bigint;
begin
  if auth.uid() is null then raise exception 'Sign in before saving'; end if;
  if next_data is null or jsonb_typeof(next_data) <> 'object' then
    raise exception 'Invalid budget data';
  end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid revision';
  end if;
  if expected_revision = 0 then
    insert into public.pockit_data (user_id, data, revision, updated_at)
      values (auth.uid(), next_data, 1, now())
      on conflict (user_id) do nothing;
    if found then return 1; end if;
  end if;
  update public.pockit_data
    set data = next_data, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = expected_revision
    returning revision into saved_revision;
  if saved_revision is null then
    raise exception 'POCKIT_CONFLICT' using errcode = 'P0001';
  end if;
  return saved_revision;
end;
$$;
revoke all on function public.pockit_save(bigint, jsonb) from public, anon;
grant execute on function public.pockit_save(bigint, jsonb) to authenticated;
