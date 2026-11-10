begin;

alter table public.push_devices
  drop constraint if exists push_devices_expo_push_token_key;

create unique index if not exists push_devices_user_token_unique
  on public.push_devices (user_id, expo_push_token);

commit;
