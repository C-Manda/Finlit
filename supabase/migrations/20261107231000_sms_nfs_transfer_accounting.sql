begin;
set local lock_timeout='5s';
create or replace function finlit_private.sms_operation(action text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
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
  if coalesce(p->>'provider','') not in ('mtn','airtel','zamtel','unknown') or coalesce(p->>'kind','') not in ('received','sent','withdrawal','deposit','merchant_payment','bill_payment','airtime_purchase','data_purchase','bank_transfer','reversal','refund','loan','balance_check','failed','unknown')
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
 if s.transaction_type in ('sent','merchant_payment','bill_payment','airtime_purchase','data_purchase') and (entry_kind<>'expense' or source_id<>l.id) then raise exception 'This transaction leaves the selected wallet as an expense'; end if;
 if s.transaction_type='bank_transfer' and (
   entry_kind<>'transfer' or source_id is null or destination_id is null or source_id=destination_id
   or not exists(select 1 from public.money_locations a where a.id=source_id and a.user_id=u and a.active)
   or not exists(select 1 from public.money_locations b where b.id=destination_id and b.user_id=u and b.active)
   or p->>'direction' not in ('in','out')
   or (p->>'direction'='in' and (destination_id<>l.id or source_id=l.id))
   or (p->>'direction'='out' and (source_id<>l.id or destination_id=l.id))
 ) then raise exception 'NFS transfers must move money between two owned locations'; end if;
 if s.transaction_type='deposit' and (entry_kind<>'transfer' or destination_id<>l.id or source_id is null or source_id=l.id) then raise exception 'A deposit must transfer from a known source into the selected wallet'; end if;
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

commit;
