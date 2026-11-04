begin;
set local lock_timeout='5s';
create table public.money_locations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 location_type text not null check(location_type in ('cash','mobile_money','bank')),
 provider text not null check(length(provider) between 1 and 80), nickname text not null default '' check(length(nickname)<=80),
 colour text not null check(colour in ('#f6d365','#f5b5b5','#dce8f1','#d9eee5','#e4def1','#f1dfd3')),
 opening_balance numeric(14,2) not null default 0 check(opening_balance>=0),
 opening_date date not null default (now() at time zone 'Africa/Lusaka')::date,
 active boolean not null default true, request_id uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,id), unique(user_id,request_id), check(location_type<>'cash' or active)
);
create unique index money_locations_one_cash on public.money_locations(user_id) where location_type='cash';
create table public.balance_adjustments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 location_id uuid not null, amount numeric(14,2) not null check(amount<>0),
 balance_before numeric(14,2) not null, balance_after numeric(14,2) not null check(balance_after>=0),
 reason text not null default '' check(length(reason)<=500), request_id uuid not null,
 created_at timestamptz not null default now(), unique(user_id,request_id),
 foreign key(user_id,location_id) references public.money_locations(user_id,id),
 check(balance_after-balance_before=amount)
);
create index balance_adjustments_location_date on public.balance_adjustments(user_id,location_id,created_at);
create index balance_adjustments_location_fk on public.balance_adjustments(location_id);
alter table public.financial_entries
 add column location_id uuid,
 add column destination_location_id uuid,
 -- Reserved import envelope; no SMS reader or automatic provider-to-wallet matching.
 add column import_metadata jsonb,
 add constraint entry_source_owner foreign key(user_id,location_id) references public.money_locations(user_id,id),
 add constraint entry_destination_owner foreign key(user_id,destination_location_id) references public.money_locations(user_id,id),
 add constraint entry_location_pair check(
  (location_id is null and destination_location_id is null) or
  (location_id is not null and ((entry_type='transfer' and destination_location_id is not null and destination_location_id<>location_id)
   or (entry_type<>'transfer' and destination_location_id is null))));
create index financial_entries_source_date on public.financial_entries(location_id,occurred_on) where location_id is not null;
create index financial_entries_destination_date on public.financial_entries(destination_location_id,occurred_on) where destination_location_id is not null;
alter table public.money_locations enable row level security;
alter table public.balance_adjustments enable row level security;
create policy money_locations_read on public.money_locations for select to authenticated using(user_id=(select auth.uid()));
create policy balance_adjustments_read on public.balance_adjustments for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.money_locations,public.balance_adjustments from anon,authenticated;
grant select on public.money_locations,public.balance_adjustments to authenticated;
-- Existing records remain unassigned. Cash starts at zero, never historical income.
insert into public.money_locations(user_id,location_type,provider,colour,request_id)
select id,'cash','Cash','#d9eee5',gen_random_uuid() from auth.users;
create function finlit_private.create_cash_location() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.money_locations(user_id,location_type,provider,colour,request_id)
 values(new.id,'cash','Cash','#d9eee5',gen_random_uuid()) on conflict do nothing;
 return new;
end $$;
revoke all on function finlit_private.create_cash_location() from public,anon,authenticated;
create trigger on_auth_user_money_location after insert on auth.users for each row execute function finlit_private.create_cash_location();
-- One ledger, derived from the existing entries plus explicit baseline/corrections.
create function finlit_private.location_ledger(u uuid)
returns table(location_id uuid,day date,amount numeric) language sql stable set search_path='' as $$
 select id,opening_date,opening_balance from public.money_locations where user_id=u
 union all
 select location_id,occurred_on,(case when entry_type='income' then amount else -amount end)-fee_amount
 from public.financial_entries where user_id=u and deleted_at is null and location_id is not null
 union all
 select destination_location_id,occurred_on,amount from public.financial_entries
 where user_id=u and deleted_at is null and destination_location_id is not null
 union all
 select location_id,(created_at at time zone 'Africa/Lusaka')::date,amount from public.balance_adjustments where user_id=u
$$;
create function finlit_private.location_balances(u uuid)
returns table(location_id uuid,balance numeric) language sql stable set search_path='' as $$
 select location_id,sum(amount) from finlit_private.location_ledger(u) group by location_id
$$;
create function finlit_private.check_location_funds(u uuid) returns void language plpgsql set search_path='' as $$
begin
 -- Dates are day-granular: no negative end-of-day balance, including after edits/deletes.
 if exists(select 1 from (
 select sum(sum(amount)) over(partition by location_id order by day) balance
 from finlit_private.location_ledger(u) group by location_id,day) daily where balance<0) then
  raise exception 'Insufficient money in this location. Check its balance, dates and any later transfers.';
 end if;
end $$;
revoke all on function finlit_private.location_ledger(uuid),finlit_private.location_balances(uuid),finlit_private.check_location_funds(uuid) from public,anon,authenticated;
create function finlit_private.money_operation(action text,p jsonb) returns jsonb language plpgsql set search_path='' as $$
declare
 u uuid:=auth.uid(); l public.money_locations; a public.balance_adjustments; current_balance numeric;
 target numeric; opening numeric; effective date; kind text; provider_name text; nickname_value text; card_colour text;
begin
 if u is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 if nullif(p->>'request','') is null then raise exception 'Missing save reference'; end if;
 if action='create_location' then
  kind:=p->>'type'; provider_name:=trim(coalesce(p->>'provider','')); nickname_value:=trim(coalesce(p->>'nickname',''));
  card_colour:=case when kind='mobile_money' and provider_name='MTN MoMo' then '#f6d365' when kind='mobile_money' and provider_name='Airtel Money' then '#f5b5b5' else p->>'colour' end;
  if kind is null or kind not in ('mobile_money','bank') or length(provider_name) not between 1 and 80 or length(nickname_value)>80
   or card_colour is null or card_colour not in ('#f6d365','#f5b5b5','#dce8f1','#d9eee5','#e4def1','#f1dfd3')
   or coalesce(p->>'opening','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$'
   or coalesce(p->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Enter a location name, colour, opening balance and valid date'; end if;
  opening:=(p->>'opening')::numeric; effective:=(p->>'date')::date;
  if effective>(now() at time zone 'Africa/Lusaka')::date then raise exception 'Opening date cannot be in the future'; end if;
  select * into l from public.money_locations where user_id=u and request_id=(p->>'request')::uuid;
  if l.id is not null then
   if l.location_type=kind and l.provider=provider_name and l.nickname=nickname_value and l.colour=card_colour and l.opening_balance=opening and l.opening_date=effective then return to_jsonb(l); end if;
   raise exception 'This save reference was already used. Reload before creating another location.';
  end if;
  insert into public.money_locations(user_id,location_type,provider,nickname,colour,opening_balance,opening_date,request_id)
  values(u,kind,provider_name,nickname_value,card_colour,opening,effective,(p->>'request')::uuid) returning * into l;
  return to_jsonb(l);
 end if;
 if action='adjust_location' then
  if coalesce(p->>'balance','') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' or coalesce(p->>'expected','') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$'
   or length(coalesce(p->>'reason',''))>500 then raise exception 'Enter a non-negative balance with up to two decimals and a reason of at most 500 characters'; end if;
  target:=(p->>'balance')::numeric;
  select * into l from public.money_locations where id=(p->>'location')::uuid and user_id=u and active;
  if l.id is null then raise exception 'Money location unavailable' using errcode='42501'; end if;
  select * into a from public.balance_adjustments where user_id=u and request_id=(p->>'request')::uuid;
  if a.id is not null then
   if a.location_id=l.id and a.balance_after=target and a.balance_before=(p->>'expected')::numeric and a.reason=coalesce(p->>'reason','') then return to_jsonb(a); end if;
   raise exception 'This save reference was already used. Reload before correcting another balance.';
  end if;
  select balance into current_balance from finlit_private.location_balances(u) where location_id=l.id;
  if current_balance<>(p->>'expected')::numeric then raise exception 'Balance changed in another view. Reload before correcting it.' using errcode='40001'; end if;
  if target=current_balance then raise exception 'The balance is already correct'; end if;
  insert into public.balance_adjustments(user_id,location_id,amount,balance_before,balance_after,reason,request_id)
  values(u,l.id,target-current_balance,current_balance,target,coalesce(p->>'reason',''),(p->>'request')::uuid) returning * into a;
  perform finlit_private.check_location_funds(u);
  return to_jsonb(a);
 end if;
 raise exception 'Unknown money operation';
end $$;
revoke all on function finlit_private.money_operation(text,jsonb) from public,anon,authenticated;
create or replace function finlit_private.api(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); e public.financial_entries; kind text; amt numeric; fee numeric;
 cat uuid; fee_cat uuid; day date; note text; wanted_revision integer; source_id uuid; destination_id uuid; locations jsonb; available numeric;
begin
 if u is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 if p_action in ('create_location','adjust_location') then return finlit_private.money_operation(p_action,p_payload); end if;
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
  update public.financial_entries set location_id=source_id,destination_location_id=destination_id,amount=amt,entry_type=kind,category_id=cat,occurred_on=day,description=note,fee_amount=fee,fee_category_id=fee_cat,revision=revision+1,updated_at=now() where id=e.id returning * into e;
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
