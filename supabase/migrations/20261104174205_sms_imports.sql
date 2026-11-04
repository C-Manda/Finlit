begin;
set local lock_timeout='5s';
alter table public.financial_entries add column occurred_at timestamptz;
alter table public.financial_entries add constraint financial_entry_precise_date check(occurred_at is null or occurred_on=(occurred_at at time zone 'Africa/Lusaka')::date);
create table public.sms_imports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 location_id uuid not null, provider text not null check(provider in ('mtn','airtel','zamtel')),
 provider_transaction_id text check(length(provider_transaction_id) between 1 and 120),
 message_fingerprint text not null check(message_fingerprint ~ '^[a-f0-9]{64}$'),
 sms_received_at timestamptz not null, transaction_occurred_at timestamptz not null,
 tracking_started_at timestamptz not null,
 timestamp_source text not null check(timestamp_source in ('provider','receipt')),
 transaction_type text not null check(transaction_type in ('received','sent','withdrawal','deposit','merchant_payment','bill_payment','airtime_purchase','data_purchase','bank_transfer','reversal','refund','loan','balance_check','failed','unknown')),
 amount numeric(14,2) check(amount>0), fee_amount numeric(14,2) check(fee_amount>=0), balance_after numeric(14,2) check(balance_after>=0),
 status text not null default 'requires_review' check(status in ('requires_review','imported','matched_existing','history_only','ignored')),
 financial_entry_id uuid references public.financial_entries(id),
 parser_version text not null check(length(parser_version) between 1 and 40),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(user_id,location_id) references public.money_locations(user_id,id),
 unique(user_id,location_id,provider,message_fingerprint)
);
create unique index sms_import_reference on public.sms_imports(user_id,location_id,provider,provider_transaction_id) where provider_transaction_id is not null;
create index sms_import_owner_time on public.sms_imports(user_id,transaction_occurred_at desc);
create index sms_import_entry_fk on public.sms_imports(financial_entry_id);
alter table public.sms_imports enable row level security;
create policy sms_imports_read on public.sms_imports for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.sms_imports from anon,authenticated;
grant select on public.sms_imports to authenticated;
create function finlit_private.sms_operation(action text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare
 u uuid:=auth.uid(); s public.sms_imports; l public.money_locations; e public.financial_entries;
 minor jsonb; key text; occurred timestamptz; received timestamptz; day date; fee numeric(14,2); baseline timestamptz;
 source_id uuid; destination_id uuid; entry_kind text; result jsonb; candidate_count integer;
begin
 if u is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if action='sms_list' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.transaction_occurred_at desc) from
   (select * from public.sms_imports where user_id=u order by transaction_occurred_at desc limit 500) x),'[]'::jsonb);
 end if;
 if action='sms_forget' then
  -- Explicit removal of import metadata, never the financial records. Identity tombstones
  -- retain fingerprint/reference so a later scan cannot recreate forgotten activity.
  select * into s from public.sms_imports where id=(p->>'id')::uuid and user_id=u;
  if s.id is null then raise exception 'Import unavailable' using errcode='42501'; end if;
  update public.sms_imports set amount=null,fee_amount=null,balance_after=null,updated_at=now(),
   status=case when status='requires_review' then 'ignored' else status end where id=s.id returning * into s;
  if s.financial_entry_id is not null then
   update public.financial_entries set import_metadata=null,revision=revision+1,updated_at=now() where id=s.financial_entry_id and user_id=u;
  end if;
  return to_jsonb(s);
 end if;
 if action='sms_stage' then
  select * into l from public.money_locations where id=(p->>'wallet')::uuid and user_id=u and active and location_type='mobile_money';
  if l.id is null then raise exception 'Choose your active Mobile Money wallet' using errcode='42501'; end if;
  if p->>'walletConfirmed' is distinct from 'true' then raise exception 'Confirm which wallet received this SMS'; end if;
  if coalesce(p->>'provider','') not in ('mtn','airtel','zamtel') or coalesce(p->>'kind','') not in ('received','sent','withdrawal','deposit','merchant_payment','bill_payment','airtime_purchase','data_purchase','bank_transfer','reversal','refund','loan','balance_check','failed','unknown')
   or coalesce(p->>'fingerprint','') !~ '^[a-f0-9]{64}$' or coalesce(p->>'timestampSource','') not in ('provider','receipt')
   or coalesce(p->>'parserVersion','')<>'finlit-sms-1'
   or (nullif(p->>'reference','') is not null and (length(p->>'reference')>120 or (p->>'reference') !~ '^[A-Za-z0-9._-]+$')) then raise exception 'Invalid SMS candidate'; end if;
  foreach key in array array['amountMinor','feeMinor','balanceMinor'] loop
   minor:=p->key;
   if minor is not null and minor<>'null'::jsonb and (jsonb_typeof(minor)<>'number' or minor::text !~ '^[0-9]{1,11}$') then raise exception 'SMS monetary values must be exact non-negative minor units'; end if;
  end loop;
  if coalesce((p->>'amountMinor')::numeric,1)=0 then raise exception 'Transaction amount must be positive'; end if;
  baseline:=(p->>'baseline')::timestamptz;
  if baseline is null or not isfinite(baseline) or baseline>now()+interval '5 minutes' or baseline<'2000-01-01'::timestamptz then raise exception 'Confirm a valid tracking baseline'; end if;
  occurred:=(p->>'occurredAt')::timestamptz; received:=(p->>'receivedAt')::timestamptz;
  if occurred is null or received is null or not isfinite(occurred) or not isfinite(received) or occurred>now()+interval '5 minutes' or received>now()+interval '5 minutes'
   or occurred<'2000-01-01'::timestamptz or received<'2000-01-01'::timestamptz then raise exception 'Check the SMS transaction and receipt timestamps'; end if;
  select * into s from public.sms_imports where user_id=u and location_id=l.id and provider=p->>'provider'
   and (message_fingerprint=p->>'fingerprint' or (provider_transaction_id is not null and provider_transaction_id=nullif(p->>'reference','')));
  if s.id is not null then return to_jsonb(s); end if;
  insert into public.sms_imports(user_id,location_id,provider,provider_transaction_id,message_fingerprint,sms_received_at,transaction_occurred_at,timestamp_source,transaction_type,amount,fee_amount,balance_after,parser_version,tracking_started_at,status)
  values(u,l.id,p->>'provider',nullif(p->>'reference',''),p->>'fingerprint',received,occurred,p->>'timestampSource',p->>'kind',
   (p->>'amountMinor')::numeric/100,(p->>'feeMinor')::numeric/100,(p->>'balanceMinor')::numeric/100,p->>'parserVersion',baseline,
   case when occurred<baseline or (occurred at time zone 'Africa/Lusaka')::date<l.opening_date then 'history_only' else 'requires_review' end) returning * into s;
  return to_jsonb(s);
 end if;
 select * into s from public.sms_imports where id=(p->>'id')::uuid and user_id=u for update;
 if s.id is null then raise exception 'Import unavailable' using errcode='42501'; end if;
 if action<>'sms_resolve' then raise exception 'Unknown SMS operation'; end if;
 if s.status<>'requires_review' then return to_jsonb(s); end if;
 if p->>'decision' in ('ignore','history') then
  update public.sms_imports set status=case when p->>'decision'='ignore' then 'ignored' else 'history_only' end,updated_at=now() where id=s.id returning * into s;
  return to_jsonb(s);
 end if;
 if p->>'confirmed' is distinct from 'true' then raise exception 'Confirm the transaction before posting'; end if;
 select * into l from public.money_locations where id=s.location_id and user_id=u and active;
 if l.id is null then raise exception 'Money location unavailable' using errcode='42501'; end if;
 day:=(s.transaction_occurred_at at time zone 'Africa/Lusaka')::date;
 if day<l.opening_date then raise exception 'This SMS is already represented by the opening balance'; end if;
 if day=l.opening_date and p->>'baselineConfirmed' is distinct from 'true' then raise exception 'Confirm this opening-day activity is not already included in the opening balance'; end if;
 if s.transaction_type in ('balance_check','failed','reversal','refund','loan') or s.amount is null then raise exception 'This SMS cannot post a transaction. Review its history or use an audited correction.'; end if;
 if p->>'feeConfirmed' is distinct from 'true' or coalesce(p->>'feeMinor','') !~ '^[0-9]{1,11}$' then raise exception 'Confirm the actual fee; an unstated fee is not automatically zero'; end if;
 fee:=(p->>'feeMinor')::numeric/100;
 if s.fee_amount is not null and fee<>s.fee_amount then raise exception 'The fee differs from the SMS. Review the original message.'; end if;
 entry_kind:=p->>'type'; source_id:=(p->>'source')::uuid; destination_id:=nullif(p->>'destination','')::uuid;
 if entry_kind is null or entry_kind not in ('income','expense','transfer') then raise exception 'Choose an accounting classification'; end if;
 if source_id is null or (source_id<>l.id and (entry_kind<>'transfer' or destination_id is distinct from l.id)) then raise exception 'The selected wallet must be part of this transaction'; end if;
 if s.transaction_type='received' and not ((entry_kind='income' and source_id=l.id) or (entry_kind='transfer' and destination_id=l.id)) then raise exception 'Received money must enter the selected wallet'; end if;
 if s.transaction_type in ('sent','withdrawal','bill_payment') and (entry_kind='income' or source_id<>l.id) then raise exception 'This transaction leaves the selected wallet'; end if;
 if s.transaction_type='withdrawal' and (entry_kind<>'transfer' or not exists(select 1 from public.money_locations where id=destination_id and user_id=u and location_type='cash')) then raise exception 'Withdrawals must transfer the principal to your Cash location'; end if;
 if p->>'decision'='match' then
  select * into e from public.financial_entries where id=(p->>'entry')::uuid and user_id=u and deleted_at is null;
  if e.id is null or e.amount<>s.amount or e.occurred_on<>day or e.entry_type<>entry_kind or e.location_id is distinct from source_id or e.destination_location_id is distinct from destination_id or e.fee_amount<>fee
   or exists(select 1 from public.sms_imports where financial_entry_id=e.id and status in ('imported','matched_existing')) then raise exception 'The selected entry does not match this SMS or is already linked'; end if;
 elsif p->>'decision'='import' then
  select count(*) into candidate_count from public.financial_entries f where f.user_id=u and f.deleted_at is null and f.amount=s.amount and f.occurred_on=day
   and (f.location_id=l.id or f.destination_location_id=l.id or f.location_id is null)
   and not exists(select 1 from public.sms_imports i where i.financial_entry_id=f.id and i.status in ('imported','matched_existing'));
  if candidate_count>0 and p->>'distinctConfirmed' is distinct from 'true' then raise exception 'A similar entry exists. Link it or explicitly confirm this is a separate transaction.'; end if;
  result:=finlit_private.api('entry',jsonb_build_object('type',entry_kind,'amount',s.amount,'fee',fee,'category',p->'category','date',day,'description',coalesce(p->>'description',''),'request',s.id,'location',source_id,'destination',destination_id));
  select * into e from public.financial_entries where id=(result->>'id')::uuid and user_id=u;
 else raise exception 'Choose import, match, ignore or history'; end if;
 update public.financial_entries set occurred_at=coalesce(occurred_at,s.transaction_occurred_at),import_metadata=jsonb_build_object('source','sms','import_id',s.id,'provider',s.provider,'reference',s.provider_transaction_id,'parser_version',s.parser_version),revision=revision+1,updated_at=now() where id=e.id;
 update public.sms_imports set status=case when p->>'decision'='match' then 'matched_existing' else 'imported' end,financial_entry_id=e.id,updated_at=now() where id=s.id returning * into s;
 return to_jsonb(s);
end $$;
revoke all on function finlit_private.sms_operation(text,jsonb) from public,anon,authenticated;
create or replace function finlit_private.api(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); e public.financial_entries; kind text; amt numeric; fee numeric;
 cat uuid; fee_cat uuid; day date; note text; wanted_revision integer; source_id uuid; destination_id uuid; locations jsonb; available numeric;
begin
 if u is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 if p_action in ('sms_stage','sms_resolve','sms_list','sms_forget') then return finlit_private.sms_operation(p_action,p_payload); end if;
 if p_action in ('create_location','adjust_location','delete_location') then return finlit_private.money_operation(p_action,p_payload); end if;
 if p_action='budget' then
  -- Keep the balances and returned transactions in the same owner-serialized snapshot.
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select coalesce(jsonb_agg(to_jsonb(l)||jsonb_build_object('balance',b.balance) order by l.created_at,l.id),'[]'::jsonb),coalesce(sum(b.balance) filter(where l.active),0)
  into locations,available from public.money_locations l join finlit_private.location_balances(u) b on b.location_id=l.id where l.user_id=u;
  return jsonb_build_object('locations',locations,'available',available,'adjustments',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.balance_adjustments a where a.user_id=u),'[]'::jsonb),'plans',coalesce((select jsonb_agg(to_jsonb(b) order by b.period_start desc) from public.budget_plans b where b.user_id=u),'[]'::jsonb),
  'entries',coalesce((select jsonb_agg(to_jsonb(f) order by f.occurred_on desc,f.created_at desc) from public.financial_entries f where f.user_id=u and f.deleted_at is null),'[]'::jsonb),
  'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.financial_categories c where (c.is_system and c.user_id is null) or c.user_id=u),'[]'::jsonb),
  'insights',coalesce((select insights_enabled from public.profiles where id=u),false));
 end if;
 if p_action='save_budget' then
  if jsonb_typeof(p_payload->'allocations') is distinct from 'object' then raise exception 'Enter valid category allocations'; end if;
  if exists(select 1 from jsonb_each(p_payload->'allocations') allocation
    where jsonb_typeof(allocation.value) is distinct from 'number'
       or (allocation.value#>>'{}') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$') then
   raise exception 'Enter non-negative numeric allocations with at most two decimals';
  end if;

  if coalesce(p_payload->>'start','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_payload->>'end','') !~ '^\d{4}-\d{2}-\d{2}$'
   or coalesce(p_payload->>'income','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$'
   or coalesce(p_payload->>'revision','') !~ '^\d+$' then raise exception 'Enter valid dates, income and budget revision'; end if;
 end if;
 if p_action not in ('entry','update_entry','delete_entry') then return finlit_private.learning_api_v2(p_action,p_payload); end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if p_action in ('update_entry','delete_entry') then
  select * into e from public.financial_entries where id=(p_payload->>'id')::uuid and user_id=u for update;
  if e.id is null then raise exception 'Transaction unavailable' using errcode='42501'; end if;
  if coalesce(p_payload->>'revision','') !~ '^\d+$' then raise exception 'Reload the transaction before editing'; end if;
  wanted_revision:=(p_payload->>'revision')::integer;
  if p_action='delete_entry' then
   if e.deleted_at is not null then return to_jsonb(e); end if;
   if e.revision<>wanted_revision then raise exception 'Transaction changed in another view. Reload before deleting.' using errcode='40001'; end if;
   update public.financial_entries set deleted_at=now(),revision=revision+1,updated_at=now() where id=e.id returning * into e;
   perform finlit_private.check_location_funds(u);
   return to_jsonb(e);
  end if;
  if e.deleted_at is not null then raise exception 'Transaction was deleted. Reload your records.'; end if;
 end if;
 kind:=p_payload->>'type'; note:=coalesce(p_payload->>'description','');
 if kind is null or kind not in ('income','expense','transfer') or coalesce(p_payload->>'amount','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$'
 or coalesce(p_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
 or coalesce(p_payload->>'fee','0') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then raise exception 'Enter a valid type, date and positive amount with up to two decimal places'; end if;
 amt:=(p_payload->>'amount')::numeric; fee:=coalesce(p_payload->>'fee','0')::numeric; day:=(p_payload->>'date')::date;
 if amt<=0 or day>(now() at time zone 'Africa/Lusaka')::date or length(note)>500 then raise exception 'Use a positive amount, an actual transaction date and a note of at most 500 characters'; end if;
 source_id:=nullif(p_payload->>'location','')::uuid; destination_id:=nullif(p_payload->>'destination','')::uuid;
 if source_id is not null then
  if not exists(select 1 from public.money_locations where id=source_id and user_id=u and active and opening_date<=day) then raise exception 'Choose your active location and a date on or after its opening date'; end if;
  if kind='transfer' then
   if destination_id is null or destination_id=source_id or not exists(select 1 from public.money_locations where id=destination_id and user_id=u and active and opening_date<=day) then raise exception 'Choose a different destination you own and a date on or after its opening date'; end if;
  elsif destination_id is not null then raise exception 'Only transfers have a destination'; end if;
 elsif destination_id is not null then raise exception 'Choose a source location'; end if;
 -- Preserve unassigned legacy entries; an already-linked entry cannot silently lose its account effects.
 if e.location_id is not null and source_id is null then raise exception 'Choose a money location for this linked entry'; end if;
 if kind<>'transfer' then
  cat:=(p_payload->>'category')::uuid;
  if not exists(select 1 from public.financial_categories where id=cat and entry_type=kind and ((is_system and user_id is null) or user_id=u)) then raise exception 'Choose a current category for this transaction type. Reload your records.'; end if;
 end if;
 if fee>0 then
  fee_cat:=nullif(p_payload->>'feeCategory','')::uuid;
  if fee_cat is null then
   select id into fee_cat from public.financial_categories where name='Transaction fees' and entry_type='expense' and is_system and user_id is null;
  end if;
  if not exists(select 1 from public.financial_categories where id=fee_cat and entry_type='expense' and ((is_system and user_id is null) or user_id=u)) then raise exception 'Choose an expense category for the fee'; end if;
 end if;
 if p_action='entry' then
  if nullif(p_payload->>'request','') is null then raise exception 'Missing save reference'; end if;
  select * into e from public.financial_entries where user_id=u and request_id=(p_payload->>'request')::uuid;
  if e.deleted_at is not null then raise exception 'This transaction was deleted. Start a new transaction.'; end if;
 end if;
 if e.id is not null then
  if e.location_id is not distinct from source_id and e.destination_location_id is not distinct from destination_id and e.amount=amt and e.entry_type=kind and e.category_id is not distinct from cat and e.occurred_on=day and coalesce(e.description,'')=note and e.fee_amount=fee and e.fee_category_id is not distinct from fee_cat then return to_jsonb(e); end if;
  if p_action='entry' then raise exception 'This save reference was already used. Reload before entering another transaction.'; end if;
  if e.revision<>wanted_revision then raise exception 'Transaction changed in another view. Reload before editing.' using errcode='40001'; end if;
  update public.financial_entries set occurred_at=case when occurred_on=day then occurred_at else null end,location_id=source_id,destination_location_id=destination_id,amount=amt,entry_type=kind,category_id=cat,occurred_on=day,description=note,fee_amount=fee,fee_category_id=fee_cat,revision=revision+1,updated_at=now() where id=e.id returning * into e;
 else
  insert into public.financial_entries(user_id,category_id,entry_type,amount,description,occurred_on,request_id,fee_amount,fee_category_id,location_id,destination_location_id)
  values(u,cat,kind,amt,note,day,(p_payload->>'request')::uuid,fee,fee_cat,source_id,destination_id) returning * into e;
 end if;
 perform finlit_private.check_location_funds(u);
 return to_jsonb(e);
end $$;
revoke all on function finlit_private.api(text,jsonb) from public,anon;
grant execute on function finlit_private.api(text,jsonb) to authenticated;
commit;
