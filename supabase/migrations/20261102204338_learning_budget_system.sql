-- Reviewed against the live FinLit schema on 2026-11-02.
begin;
-- Preserve legacy topic values while permitting the six stable curriculum keys.
alter table public.assessment_questions drop constraint if exists assessment_questions_topic_check;
alter table public.assessment_questions add constraint assessment_questions_topic_check check(topic in ('income','budgeting','saving','borrowing','module-1','module-2','module-3','module-4','module-5','module-6'));
create schema if not exists finlit_private;
revoke all on schema finlit_private from public, anon;
grant usage on schema finlit_private to authenticated;
alter table public.modules add column if not exists content_key text;
alter table public.lessons add column if not exists content_key text;
alter table public.lessons add column if not exists structured_content jsonb;
alter table public.lessons add column if not exists revision integer not null default 1;
alter table public.assessments add column if not exists content_key text;
alter table public.lesson_progress add column if not exists player_state jsonb;
alter table public.assessment_attempts add column if not exists revision integer not null default 0;
alter table public.profiles add column if not exists insights_enabled boolean not null default false;
create unique index if not exists modules_content_key on public.modules(content_key);
create unique index if not exists lessons_content_key on public.lessons(content_key);
create unique index if not exists assessments_content_key on public.assessments(content_key);
create unique index if not exists lesson_progress_owner_lesson on public.lesson_progress(user_id,lesson_id);
create unique index if not exists module_progress_owner_module on public.module_progress(user_id,module_id);
create unique index if not exists assessment_answers_attempt_question on public.assessment_answers(attempt_id,question_id);
create index if not exists finlit_attempt_owner on public.assessment_attempts(user_id,assessment_id,started_at desc);
create index if not exists finlit_entries_owner_date on public.financial_entries(user_id,occurred_on);
create table if not exists public.budget_plans (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 period_start date not null, period_end date not null, planned_income numeric(12,2) not null check(planned_income>=0),
 allocations jsonb not null default '{}', revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(period_end>=period_start), unique(user_id,period_start)
);
alter table public.financial_entries add column if not exists request_id uuid;
create unique index if not exists financial_entries_request on public.financial_entries(user_id,request_id);
-- Scope policy replacement to this feature. Rows and unrelated application tables are preserved.
do $$ declare t text; p record; cols text; begin
 foreach t in array array['modules','lessons','assessments','assessment_questions','assessment_options','assessment_answer_keys','lesson_progress','module_progress','assessment_attempts','assessment_answers','financial_entries','financial_categories','budget_plans'] loop
  execute format('alter table public.%I enable row level security',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name=t;
  execute format('revoke all (%s) on public.%I from public, anon, authenticated',cols,t);
 end loop;
end $$;
grant select on public.modules,public.lessons,public.assessments,public.assessment_options,public.lesson_progress,public.module_progress,public.assessment_attempts,public.assessment_answers,public.financial_entries,public.financial_categories,public.budget_plans to authenticated;
-- Legacy feedback_text may contain solutions; expose only question presentation columns.
grant select(id,assessment_id,topic,question_text,sort_order,points,created_at,updated_at) on public.assessment_questions to authenticated;
create policy published_modules on public.modules for select to authenticated using(is_published);
create policy published_lessons on public.lessons for select to authenticated using(is_published);
create policy published_assessments on public.assessments for select to authenticated using(is_published);
create policy published_questions on public.assessment_questions for select to authenticated using(exists(select 1 from public.assessments a where a.id=assessment_id and a.is_published));
create policy published_options on public.assessment_options for select to authenticated using(exists(select 1 from public.assessment_questions q where q.id=question_id));
create policy own_lessons on public.lesson_progress for select to authenticated using(user_id=(select auth.uid()));
create policy own_modules on public.module_progress for select to authenticated using(user_id=(select auth.uid()));
create policy own_attempts on public.assessment_attempts for select to authenticated using(user_id=(select auth.uid()));
create policy own_answers on public.assessment_answers for select to authenticated using(exists(select 1 from public.assessment_attempts a where a.id=attempt_id and a.user_id=(select auth.uid())));
create policy own_entries on public.financial_entries for select to authenticated using(user_id=(select auth.uid()));
create policy own_categories on public.financial_categories for select to authenticated using((is_system and user_id is null) or user_id=(select auth.uid()));
create policy own_budgets on public.budget_plans for select to authenticated using(user_id=(select auth.uid()));
-- No client policy or grant for answer keys. No client DML grants for mastery or attempts.
create or replace function finlit_private.module_available(p_user uuid,p_module uuid) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from public.modules m where m.id=p_module and m.is_published and m.content_key is not null
 and not exists(select 1 from public.modules prior where prior.content_key is not null and prior.is_published and prior.sort_order<m.sort_order
 and not exists(select 1 from public.module_progress mp where mp.user_id=p_user and mp.module_id=prior.id and mp.completed_at is not null)))
$$;
revoke all on function finlit_private.module_available(uuid,uuid) from public,anon,authenticated;

create or replace function finlit_private.api(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare
 u uuid:=auth.uid(); l public.lessons; a public.assessments; at public.assessment_attempts;
 lp public.lesson_progress; bp public.budget_plans; fe public.financial_entries;
 old jsonb; ns jsonb; result jsonb; stage integer; maximum integer; i integer; n integer; total integer; points integer; k text; val jsonb;
begin
 if u is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 if p_action not in ('snapshot','lesson','assessment','result','budget') then perform pg_advisory_xact_lock(hashtextextended(u::text,0)); end if;
 if p_action='snapshot' then
  return jsonb_build_object(
   'lessons',coalesce((select jsonb_object_agg(l.content_key,lp.player_state) from public.lesson_progress lp join public.lessons l on l.id=lp.lesson_id where lp.user_id=u and lp.player_state is not null and l.content_key is not null),'{}'::jsonb),
   'modules',coalesce((select jsonb_agg(jsonb_build_object('key',m.content_key,'completed',mp.completed_at is not null,'score',mp.highest_score,'status',mp.status)) from public.module_progress mp join public.modules m on m.id=mp.module_id where mp.user_id=u and m.content_key is not null),'[]'::jsonb),
   'diagnostic',(select jsonb_build_object('id',at.id,'scores',at.topic_scores,'score',at.score) from public.assessment_attempts at join public.assessments a on a.id=at.assessment_id where at.user_id=u and a.assessment_type='diagnostic' and at.completed_at is not null and at.score is not null order by at.completed_at desc limit 1));
 elsif p_action in ('lesson','save_lesson') then
  select * into l from public.lessons where content_key=p_payload->>'key' and is_published;
  if l.id is null or l.structured_content is null then raise exception 'Lesson unavailable'; end if;
  select * into lp from public.lesson_progress where user_id=u and lesson_id=l.id for update;
  if not coalesce(lp.is_completed,false) and (not finlit_private.module_available(u,l.module_id) or exists(
   select 1 from public.lessons prior where prior.module_id=l.module_id and prior.is_published and prior.content_key is not null and prior.sort_order<l.sort_order
   and not exists(select 1 from public.lesson_progress p where p.user_id=u and p.lesson_id=prior.id and p.is_completed)
  )) then raise exception 'Complete the preceding lessons and module challenge first' using errcode='42501'; end if;
  if p_action='lesson' then return l.structured_content; end if;
  old:=lp.player_state;
  if old is null then old:=jsonb_build_object('version',l.revision,'stage',0,'maxStage',0,'reflection',null,'practice','','practiceSubmitted',false,'answers',jsonb_build_array(null,null,null),'checked',jsonb_build_array(false,false,false),'checkpointIndex',0,'completed',false); end if;
  ns:=p_payload->'record';
  if ns=old then return old; end if;
  if p_payload->'expected' is distinct from old then raise exception 'Progress changed in another view. Load latest saved progress.' using errcode='40001'; end if;
  if not (ns ?& array['version','stage','maxStage','reflection','practice','practiceSubmitted','answers','checked','checkpointIndex','completed']) then raise exception 'Incomplete lesson record'; end if;
  if ns->'reflection'<>'null'::jsonb and (jsonb_typeof(ns->'reflection')<>'number' or (ns->>'reflection')::numeric<>trunc((ns->>'reflection')::numeric) or (ns->>'reflection')::int not between 0 and jsonb_array_length(l.structured_content#>'{situation,choices}')-1) then raise exception 'Invalid reflection'; end if;
  if (ns->>'checkpointIndex')::int>0 and not coalesce((ns->'checked'->>((ns->>'checkpointIndex')::int-1))::boolean,false) then raise exception 'Check the preceding question first'; end if;
  if jsonb_typeof(ns) is distinct from 'object' or (ns->>'version')::int is distinct from l.revision then raise exception 'Lesson revision changed. Reload the lesson.'; end if;
  stage:=(ns->>'stage')::int; maximum:=(ns->>'maxStage')::int;
  if stage is null or maximum is null or stage not between 0 and 6 or maximum not between stage and 6
   or jsonb_typeof(ns->'practice') is distinct from 'string' or length(ns->>'practice')>(case when l.structured_content#>>'{practice,kind}'='allocation' then 512 else 12 end)
   or jsonb_typeof(ns->'practiceSubmitted') is distinct from 'boolean' or jsonb_typeof(ns->'completed') is distinct from 'boolean'
   or jsonb_typeof(ns->'answers') is distinct from 'array' or jsonb_array_length(ns->'answers')<>3
   or jsonb_typeof(ns->'checked') is distinct from 'array' or jsonb_array_length(ns->'checked')<>3
   or (ns->>'checkpointIndex') is null or (ns->>'checkpointIndex')::int not between 0 and 2 then raise exception 'Invalid lesson progress'; end if;
  if not (old->>'completed')::boolean and stage>(old->>'stage')::int+1 then raise exception 'Stages must be completed in order'; end if;
  if maximum>greatest((old->>'maxStage')::int,stage) then raise exception 'Invalid completed stages'; end if;
  if (ns->>'practiceSubmitted')::boolean then
   if l.structured_content#>>'{practice,kind}'='allocation' then
    val := (ns->>'practice')::jsonb;
    if jsonb_typeof(val) is distinct from 'object' or (select count(*) from jsonb_object_keys(val))<>jsonb_array_length(l.structured_content#>'{practice,allocation,fields}') then raise exception 'Complete every allocation'; end if;
    for k in select f->>'id' from jsonb_array_elements(l.structured_content#>'{practice,allocation,fields}') f loop
     if jsonb_typeof(val->k) is distinct from 'string' or (val->>k) !~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' then raise exception 'Enter valid allocations'; end if;
    end loop;
   else
    if (ns->>'practice') !~ '^[0-9]{1,7}(\.[0-9]{1,2})?$' then raise exception 'Enter a valid practice answer'; end if;
    if l.structured_content#>>'{practice,kind}'='choice' and ((ns->>'practice')::numeric<>trunc((ns->>'practice')::numeric) or (ns->>'practice')::numeric>=jsonb_array_length(l.structured_content#>'{practice,options}')) then raise exception 'Invalid practice choice'; end if;
   end if;
  end if;
  if maximum>=4 and not (ns->>'practiceSubmitted')::boolean then raise exception 'Attempt the practice first'; end if;
  for i in 0..2 loop
   if ns->'answers'->i<>'null'::jsonb and (jsonb_typeof(ns->'answers'->i)<>'number' or (ns->'answers'->>i)::numeric<>trunc((ns->'answers'->>i)::numeric) or (ns->'answers'->>i)::int not between 0 and jsonb_array_length(l.structured_content->'checkpoint'->i->'options')-1) then raise exception 'Invalid checkpoint option'; end if;
   if jsonb_typeof(ns->'checked'->i) is distinct from 'boolean' then raise exception 'Invalid checkpoint state'; end if;
   if (ns->'checked'->>i)::boolean then
    if ns->'answers'->i='null'::jsonb or not (ns->>'practiceSubmitted')::boolean then raise exception 'Answer every checked question'; end if;
    if not (old->'checked'->>i)::boolean and ((old->>'stage')::int<>5 or (old->>'checkpointIndex')::int<>i) then raise exception 'Check questions one at a time'; end if;
    if i>0 and not (ns->'checked'->>(i-1))::boolean then raise exception 'Check questions in order'; end if;
   end if;
  end loop;
  if maximum>=6 and ns->'checked'<>'[true,true,true]'::jsonb then raise exception 'Attempt all three checkpoints'; end if;
  if (ns->>'completed')::boolean and (maximum<>6 or (not (old->>'completed')::boolean and (old->>'stage')::int<>6)) then raise exception 'Finish the summary first'; end if;
  if (old->>'completed')::boolean and (not (ns->>'completed')::boolean or ns->'answers'<>old->'answers' or ns->'practice'<>old->'practice' or ns->'checked'<>old->'checked') then raise exception 'Completed records cannot be reset'; end if;
  insert into public.lesson_progress(user_id,lesson_id,player_state,is_completed,completed_at,updated_at)
   values(u,l.id,ns,(ns->>'completed')::boolean,case when (ns->>'completed')::boolean then now() end,now())
   on conflict(user_id,lesson_id) do update set player_state=excluded.player_state,is_completed=lesson_progress.is_completed or excluded.is_completed,completed_at=coalesce(lesson_progress.completed_at,excluded.completed_at),updated_at=now();
  return ns;
 elsif p_action in ('assessment','begin_assessment') then
  select * into a from public.assessments where content_key=p_payload->>'key' and is_published;
  if a.id is null then raise exception 'Assessment unavailable'; end if;
  if a.assessment_type<>'diagnostic' and (not finlit_private.module_available(u,a.module_id) or (select count(*) from public.lessons l join public.lesson_progress p on p.lesson_id=l.id and p.user_id=u and p.is_completed where l.module_id=a.module_id and l.content_key is not null and l.is_published)<>4) then raise exception 'Complete all four lessons before the challenge' using errcode='42501'; end if;
  if p_action='begin_assessment' then
   select * into at from public.assessment_attempts where user_id=u and assessment_id=a.id and completed_at is null order by started_at desc limit 1;
   if at.id is null then insert into public.assessment_attempts(user_id,assessment_id) values(u,a.id) returning * into at; end if;
  end if;
  return jsonb_build_object('assessment',to_jsonb(a),'attempt',case when at.id is not null then to_jsonb(at) else null end,
   'answers',coalesce((select jsonb_object_agg(question_id,selected_option_id) from public.assessment_answers where attempt_id=at.id),'{}'::jsonb),
   'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.question_text,'topic',q.topic,'options',(select jsonb_agg(jsonb_build_object('id',o.id,'text',o.option_text) order by o.sort_order) from public.assessment_options o where o.question_id=q.id)) order by q.sort_order) from public.assessment_questions q where q.assessment_id=a.id),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.started_at desc) from public.assessment_attempts h where h.user_id=u and h.assessment_id=a.id and h.completed_at is not null),'[]'::jsonb));
 elsif p_action in ('answer','submit','result') then
  select * into at from public.assessment_attempts where id=(p_payload->>'attempt')::uuid and user_id=u for update;
  if at.id is null then raise exception 'Assessment attempt unavailable' using errcode='42501'; end if;
  select * into a from public.assessments where id=at.assessment_id;
  if p_action='answer' then
   if at.completed_at is not null then raise exception 'This attempt is already submitted'; end if;
   if at.revision is distinct from (p_payload->>'revision')::int then
    if exists(select 1 from public.assessment_answers where attempt_id=at.id and question_id=(p_payload->>'question')::uuid and selected_option_id=(p_payload->>'option')::uuid) then return to_jsonb(at); end if;
    raise exception 'Answers changed in another view. Reload the assessment.' using errcode='40001';
   end if;
   if not exists(select 1 from public.assessment_questions q join public.assessment_options o on o.question_id=q.id where q.assessment_id=a.id and q.id=(p_payload->>'question')::uuid and o.id=(p_payload->>'option')::uuid) then raise exception 'Invalid question or option'; end if;
   insert into public.assessment_answers(attempt_id,question_id,selected_option_id) values(at.id,(p_payload->>'question')::uuid,(p_payload->>'option')::uuid)
    on conflict(attempt_id,question_id) do update set selected_option_id=excluded.selected_option_id,answered_at=now();
   update public.assessment_attempts set revision=revision+1 where id=at.id returning * into at;
   return to_jsonb(at);
  end if;
  if p_action='submit' and at.completed_at is null then
   if a.module_id is not null and (not finlit_private.module_available(u,a.module_id) or (select count(*) from public.lessons ls join public.lesson_progress pr on pr.lesson_id=ls.id and pr.user_id=u and pr.is_completed where ls.module_id=a.module_id and ls.content_key is not null and ls.is_published)<>4) then raise exception 'Complete the preceding lessons and module challenge first'; end if;
   if at.revision is distinct from (p_payload->>'revision')::int then raise exception 'Answers changed in another view. Reload before submitting.' using errcode='40001'; end if;
   select count(*) into total from public.assessment_questions where assessment_id=a.id;
   if total=0 or (a.assessment_type<>'diagnostic' and total<>8) then raise exception 'Assessment content is incomplete'; end if;
   select count(*) into n from public.assessment_answers ans join public.assessment_questions q on q.id=ans.question_id join public.assessment_options o on o.id=ans.selected_option_id and o.question_id=q.id join public.assessment_answer_keys k on k.question_id=q.id where ans.attempt_id=at.id and q.assessment_id=a.id;
   if n<>total then raise exception 'Save an answer to every question before submitting'; end if;
   update public.assessment_answers ans set is_correct=(ans.selected_option_id=k.correct_option_id) from public.assessment_answer_keys k where ans.attempt_id=at.id and k.question_id=ans.question_id;
   select count(*) into points from public.assessment_answers where attempt_id=at.id and is_correct;
   select jsonb_object_agg(topic,jsonb_build_object('correct',correct,'total',cnt)) into result from (select q.topic,count(*) filter(where ans.is_correct) correct,count(*) cnt from public.assessment_questions q join public.assessment_answers ans on ans.question_id=q.id where ans.attempt_id=at.id group by q.topic) grouped;
   update public.assessment_attempts set score=points,passed=case when a.assessment_type='diagnostic' then null else points>=6 end,topic_scores=result,completed_at=now(),revision=revision+1 where id=at.id returning * into at;
   if a.module_id is not null then
    insert into public.module_progress(user_id,module_id,status,highest_score,started_at,completed_at,updated_at) values(u,a.module_id,case when points>=6 then 'completed' else 'in_progress' end,points,at.started_at,case when points>=6 then now() end,now())
     on conflict(user_id,module_id) do update set highest_score=greatest(module_progress.highest_score,excluded.highest_score),status=case when module_progress.completed_at is not null or excluded.completed_at is not null then 'completed' else 'in_progress' end,completed_at=coalesce(module_progress.completed_at,excluded.completed_at),updated_at=now();
   end if;
  end if;
  if at.completed_at is null then raise exception 'Submit the assessment before viewing feedback'; end if;
  return jsonb_build_object('attempt',to_jsonb(at),'assessment',to_jsonb(a),'feedback',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.question_text,'selected',o.option_text,'correct',ans.is_correct,'explanation',k.explanation,'topic',q.topic) order by q.sort_order) from public.assessment_answers ans join public.assessment_questions q on q.id=ans.question_id join public.assessment_options o on o.id=ans.selected_option_id join public.assessment_answer_keys k on k.question_id=q.id where ans.attempt_id=at.id),'[]'::jsonb));
 elsif p_action='budget' then
  return jsonb_build_object('plans',coalesce((select jsonb_agg(to_jsonb(b) order by b.period_start desc) from public.budget_plans b where user_id=u),'[]'::jsonb),
  'entries',coalesce((select jsonb_agg(to_jsonb(e) order by e.occurred_on desc,e.created_at desc) from public.financial_entries e where user_id=u),'[]'::jsonb),
  'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.name) from public.financial_categories c where (c.is_system and c.user_id is null) or c.user_id=u),'[]'::jsonb),
  'insights',coalesce((select insights_enabled from public.profiles where id=u),false));
 elsif p_action='consent' then
  if jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'Invalid preference'; end if;
  update public.profiles set insights_enabled=(p_payload->>'enabled')::boolean where id=u;
  if not found then raise exception 'Profile unavailable. Please reload your account.'; end if;
  return p_payload->'enabled';
 elsif p_action='save_budget' then
  if (p_payload->>'start')::date>(p_payload->>'end')::date or (p_payload->>'end')::date-(p_payload->>'start')::date>366 then raise exception 'Choose a period of up to one year'; end if;
  if (p_payload->>'income') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' or jsonb_typeof(p_payload->'allocations') is distinct from 'object' then raise exception 'Enter valid budget amounts'; end if;
  for k,val in select * from jsonb_each(p_payload->'allocations') loop
   if not exists(select 1 from public.financial_categories where id=k::uuid and entry_type='expense' and ((is_system and user_id is null) or user_id=u)) then raise exception 'Invalid allocation category'; end if;
   if (val#>>'{}') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then raise exception 'Enter non-negative allocations with at most two decimals'; end if;
  end loop;
  select * into bp from public.budget_plans where user_id=u and period_start=(p_payload->>'start')::date for update;
  if bp.id is not null and bp.revision is distinct from (p_payload->>'revision')::int then
   if bp.period_end=(p_payload->>'end')::date and bp.planned_income=(p_payload->>'income')::numeric and bp.allocations=p_payload->'allocations' then return to_jsonb(bp); end if;
   raise exception 'Budget changed in another view. Reload before editing.' using errcode='40001';
  end if;
  if exists(select 1 from public.budget_plans where user_id=u and id is distinct from bp.id and period_start<=(p_payload->>'end')::date and period_end>=(p_payload->>'start')::date) then raise exception 'Budget periods must not overlap'; end if;
  insert into public.budget_plans(user_id,period_start,period_end,planned_income,allocations) values(u,(p_payload->>'start')::date,(p_payload->>'end')::date,(p_payload->>'income')::numeric,p_payload->'allocations')
  on conflict(user_id,period_start) do update set period_end=excluded.period_end,planned_income=excluded.planned_income,allocations=excluded.allocations,revision=budget_plans.revision+1,updated_at=now() returning * into bp;
  return to_jsonb(bp);
 elsif p_action='entry' then
  if not (p_payload ?& array['type','amount','date','category','request']) or p_payload->>'request' is null then raise exception 'Incomplete transaction'; end if;
  if p_payload->>'type' not in ('income','expense') or (p_payload->>'amount') !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' or (p_payload->>'amount')::numeric<=0 then raise exception 'Enter a positive amount with up to two decimal places'; end if;
  if (p_payload->>'date')::date>(now() at time zone 'Africa/Lusaka')::date or length(coalesce(p_payload->>'description',''))>500 then raise exception 'Use an actual transaction date and a note of at most 500 characters'; end if;
  if not exists(select 1 from public.financial_categories where id=(p_payload->>'category')::uuid and entry_type=p_payload->>'type' and ((is_system and user_id is null) or user_id=u)) then raise exception 'Choose a category for this transaction type'; end if;
  select * into fe from public.financial_entries where user_id=u and request_id=(p_payload->>'request')::uuid;
  if fe.id is not null then
   if fe.amount<>(p_payload->>'amount')::numeric or fe.category_id<>(p_payload->>'category')::uuid or fe.entry_type<>p_payload->>'type' or fe.occurred_on<>(p_payload->>'date')::date or coalesce(fe.description,'')<>coalesce(p_payload->>'description','') then raise exception 'This save reference was already used. Reload before entering another transaction.'; end if;
   return to_jsonb(fe);
  end if;
  insert into public.financial_entries(user_id,category_id,entry_type,amount,description,occurred_on,request_id) values(u,(p_payload->>'category')::uuid,p_payload->>'type',(p_payload->>'amount')::numeric,p_payload->>'description',(p_payload->>'date')::date,(p_payload->>'request')::uuid) returning * into fe;
  return to_jsonb(fe);
 end if;
 raise exception 'Unknown action';
end $$;
revoke all on function finlit_private.api(text,jsonb) from public,anon;
grant execute on function finlit_private.api(text,jsonb) to authenticated;
create or replace function public.finlit_api(p_action text,p_payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select finlit_private.api(p_action,p_payload) $$;
revoke all on function public.finlit_api(text,jsonb) from public,anon;
grant execute on function public.finlit_api(text,jsonb) to authenticated;
commit;
