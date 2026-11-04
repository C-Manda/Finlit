begin;
set local lock_timeout='5s';
-- Serialize this small taxonomy migration with writes; no amounts or entry kinds change.
lock table public.financial_categories,public.financial_entries,public.budget_plans,public.recurring_entries in share row exclusive mode;
create temporary table category_names(kind text,old_name text,new_name text) on commit drop;
insert into category_names values
('income','Family & gifts','Family & gifts'),
('income','Family support','Family & gifts'),
('income','Allowance','Family & gifts'),
('income','Gift','Family & gifts'),
('income','Work & business','Work & business'),
('income','Salary','Work & business'),
('income','Employment','Work & business'),
('income','Part-time work','Work & business'),
('income','Trading','Work & business'),
('income','Scholarships & grants','Scholarships & grants'),
('income','Loans received','Loans received'),
('income','Other income','Other income'),
('expense','Food & groceries','Food & groceries'),
('expense','Food','Food & groceries'),
('expense','Groceries','Food & groceries'),
('expense','Housing & utilities','Housing & utilities'),
('expense','Rent','Housing & utilities'),
('expense','Accommodation','Housing & utilities'),
('expense','Utilities','Housing & utilities'),
('expense','Transport','Transport'),
('expense','Data & airtime','Data & airtime'),
('expense','Data','Data & airtime'),
('expense','Data and Wi-Fi','Data & airtime'),
('expense','Education','Education'),
('expense','Academic expenses','Education'),
('expense','Study materials','Education'),
('expense','Fees','Education'),
('expense','Health & personal care','Health & personal care'),
('expense','Medical','Health & personal care'),
('expense','Recreation','Recreation'),
('expense','Entertainment','Recreation'),
('expense','Family support','Family support'),
('expense','Debt repayments','Debt repayments'),
('expense','Other expenses','Other expenses'),
('expense','Other expense','Other expenses'),
('expense','Other / uncategorised','Other expenses'),
('expense','Transaction fees','Transaction fees');
insert into public.financial_categories(name,entry_type,is_system)
select distinct n.new_name,n.kind,true from category_names n
where not exists(select 1 from public.financial_categories c where c.name=n.new_name and c.entry_type=n.kind and c.is_system and c.user_id is null);
create temporary table category_merge on commit drop as
select old.id old_id,target.id new_id from category_names n
join public.financial_categories old on old.name=n.old_name and old.entry_type=n.kind and old.is_system and old.user_id is null
join public.financial_categories target on target.name=n.new_name and target.entry_type=n.kind and target.is_system and target.user_id is null
where old.id<>target.id;
-- Retain principal/fees/dates/descriptions, including deleted and recurring records.
update public.financial_entries e set
 category_id=coalesce((select new_id from category_merge where old_id=e.category_id),e.category_id),
 fee_category_id=coalesce((select new_id from category_merge where old_id=e.fee_category_id),e.fee_category_id),revision=revision+1
where exists(select 1 from category_merge where old_id=e.category_id or old_id=e.fee_category_id);
update public.recurring_entries e set category_id=m.new_id from category_merge m where e.category_id=m.old_id;
-- Sum allocations when several old categories become one. A stale editor must reload.
update public.budget_plans b set allocations=(
 select jsonb_object_agg(category,amount) from (
  select coalesce(m.new_id::text,a.key) category,sum((a.value#>>'{}')::numeric) amount
  from jsonb_each(b.allocations) a left join category_merge m on m.old_id::text=a.key
  group by coalesce(m.new_id::text,a.key)
 ) grouped
),revision=revision+1
where exists(select 1 from jsonb_object_keys(b.allocations) k join category_merge m on m.old_id::text=k);
delete from public.financial_categories c using category_merge m where c.id=m.old_id;
-- A fee is an attached expense for any entry type, not a fourth transaction type.
alter table public.financial_entries drop constraint financial_entries_kind_fields;
alter table public.financial_entries add constraint financial_entries_kind_fields check(
 ((entry_type='transfer' and category_id is null) or (entry_type in ('income','expense') and category_id is not null))
 and ((fee_amount=0 and fee_category_id is null) or (fee_amount>0 and fee_category_id is not null)));
create or replace function finlit_private.api(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); e public.financial_entries; kind text; amt numeric; fee numeric;
 cat uuid; fee_cat uuid; day date; note text; wanted_revision integer;
begin
 if u is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 if p_action='budget' then
  return jsonb_build_object('plans',coalesce((select jsonb_agg(to_jsonb(b) order by b.period_start desc) from public.budget_plans b where b.user_id=u),'[]'::jsonb),
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
  if e.amount=amt and e.entry_type=kind and e.category_id is not distinct from cat and e.occurred_on=day and coalesce(e.description,'')=note and e.fee_amount=fee and e.fee_category_id is not distinct from fee_cat then return to_jsonb(e); end if;
  if p_action='entry' then raise exception 'This save reference was already used. Reload before entering another transaction.'; end if;
  if e.revision<>wanted_revision then raise exception 'Transaction changed in another view. Reload before editing.' using errcode='40001'; end if;
  update public.financial_entries set amount=amt,entry_type=kind,category_id=cat,occurred_on=day,description=note,fee_amount=fee,fee_category_id=fee_cat,revision=revision+1,updated_at=now() where id=e.id returning * into e;
 else
  insert into public.financial_entries(user_id,category_id,entry_type,amount,description,occurred_on,request_id,fee_amount,fee_category_id)
  values(u,cat,kind,amt,note,day,(p_payload->>'request')::uuid,fee,fee_cat) returning * into e;
 end if;
 return to_jsonb(e);
end $$;
revoke all on function finlit_private.api(text,jsonb) from public,anon;
grant execute on function finlit_private.api(text,jsonb) to authenticated;
commit;
