begin;
set local lock_timeout='5s';
-- Cover the ownership foreign keys and per-user ledger/date lookups together.
create index financial_entries_owner_source_date on public.financial_entries(user_id,location_id,occurred_on);
create index financial_entries_owner_destination_date on public.financial_entries(user_id,destination_location_id,occurred_on);
drop index public.financial_entries_source_date;
drop index public.financial_entries_destination_date;
-- The existing (user_id,location_id,created_at) index already covers this FK.
drop index public.balance_adjustments_location_fk;
commit;
