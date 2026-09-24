-- Run after schema.sql. The outbox stores only the email needed for delivery.
create table if not exists public.pockit_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('signup', 'account_deleted')),
  user_id uuid not null,
  email text not null,
  event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  locked_until timestamptz,
  attempts integer not null default 0,
  last_error text,
  unique (kind, user_id)
);

-- A minimal receipt lets the app safely retry queuing an owner's signup alert
-- when the database webhook is unavailable, without emailing again on each login.
create table if not exists public.pockit_notification_receipts (
  kind text not null check (kind = 'signup'),
  user_id uuid not null,
  delivered_at timestamptz not null default now(),
  primary key (kind, user_id)
);
alter table public.pockit_notification_receipts enable row level security;
revoke all on public.pockit_notification_receipts from public, anon, authenticated;
grant select, insert on public.pockit_notification_receipts to service_role;

alter table public.pockit_notifications enable row level security;
revoke all on public.pockit_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.pockit_notifications to service_role;

create or replace function public.queue_pockit_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.email_confirmed_at is not null then
      return new;
    end if;
  end if;
  if exists (select 1 from public.pockit_notification_receipts where kind = 'signup' and user_id = new.id) then
    return new;
  end if;
  insert into public.pockit_notifications (kind, user_id, email, event_at)
  values ('signup', new.id, new.email, new.email_confirmed_at)
  on conflict (kind, user_id) do nothing;
  return new;
end;
$$;

create or replace function public.queue_pockit_account_deleted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.email is not null then
    insert into public.pockit_notifications (kind, user_id, email, event_at)
    values ('account_deleted', old.id, old.email, now())
    on conflict (kind, user_id) do nothing;
  end if;
  return old;
end;
$$;

revoke all on function public.queue_pockit_signup() from public, anon, authenticated;
revoke all on function public.queue_pockit_account_deleted() from public, anon, authenticated;

drop trigger if exists pockit_signup_notification on auth.users;
create trigger pockit_signup_notification
  after insert or update on auth.users
  for each row execute function public.queue_pockit_signup();

drop trigger if exists pockit_account_deleted_notification on auth.users;
create trigger pockit_account_deleted_notification
  after delete on auth.users
  for each row execute function public.queue_pockit_account_deleted();

-- Atomic claim prevents the webhook and daily retry from sending the same row together.
create or replace function public.claim_pockit_notification(p_id uuid)
returns setof public.pockit_notifications
language sql security definer set search_path = '' as $$
  update public.pockit_notifications
  set locked_until = now() + interval '5 minutes', attempts = attempts + 1
  where id = p_id and (locked_until is null or locked_until < now())
  returning *;
$$;
revoke all on function public.claim_pockit_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_pockit_notification(uuid) to service_role;
