alter table public.notification_delivery_log
  add column if not exists status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists provider_ticket_id text,
  add column if not exists provider_receipt_status text,
  add column if not exists error_message text;

update public.notification_delivery_log
set status = 'sent'
where delivered_at is not null
  and status = 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_delivery_log'::regclass
      and conname = 'notification_delivery_log_status_check'
  ) then
    alter table public.notification_delivery_log
      add constraint notification_delivery_log_status_check
      check (status in ('pending', 'sent', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notification_delivery_log'::regclass
      and conname = 'notification_delivery_log_attempt_count_check'
  ) then
    alter table public.notification_delivery_log
      add constraint notification_delivery_log_attempt_count_check
      check (attempt_count >= 0);
  end if;
end $$;

create index if not exists notification_delivery_log_pending_idx
  on public.notification_delivery_log (scheduled_for, created_at)
  where status = 'pending';

alter table public.notification_delivery_log enable row level security;
revoke all on table public.notification_delivery_log from anon, authenticated;
grant all on table public.notification_delivery_log to service_role;
