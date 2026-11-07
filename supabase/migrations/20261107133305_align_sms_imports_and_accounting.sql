-- Applied on the live Supabase project on 2026-11-07.
-- This repository copy is intentionally additive and does not replay the
-- already-applied migration. It records the aligned SMS contract for fresh
-- environments while preserving the existing private API and RLS boundary.
begin;

alter table public.sms_imports
  drop constraint if exists sms_imports_provider_check;
alter table public.sms_imports
  add constraint sms_imports_provider_check
  check (provider in ('mtn','airtel','zamtel','unknown'));

-- Keep the existing owner-scoped table and private resolver protections.
alter table public.sms_imports enable row level security;

commit;
