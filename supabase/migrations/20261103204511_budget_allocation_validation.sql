begin;
-- Patch only the validation branch; preserve the applied dispatcher and learning delegate.
do $migration$
declare definition text; marker text := ' if p_action=''save_budget'' then';
begin
 definition:=pg_get_functiondef('finlit_private.api(text,jsonb)'::regprocedure);
 if strpos(definition,marker)=0 then raise exception 'Expected budget dispatcher is unavailable'; end if;
 execute replace(definition,marker,marker || $validation$
  if jsonb_typeof(p_payload->'allocations') is distinct from 'object' then raise exception 'Enter valid category allocations'; end if;
  if exists(select 1 from jsonb_each(p_payload->'allocations') allocation
    where jsonb_typeof(allocation.value) is distinct from 'number'
       or (allocation.value#>>'{}') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$') then
   raise exception 'Enter non-negative numeric allocations with at most two decimals';
  end if;
$validation$);
end $migration$;
commit;
