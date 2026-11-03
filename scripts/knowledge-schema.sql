-- Additive knowledge assessment state. Existing questions, answers and progress are retained.
alter table public.assessments add column if not exists assessment_version integer not null default 1;
alter table public.assessments add column if not exists comparison_group text;
alter table public.assessment_questions add column if not exists skill_metadata jsonb not null default '{}';
create table if not exists public.learner_assessment_state (
 user_id uuid primary key references auth.users(id) on delete cascade,
 legacy_learner boolean not null default false,
 baseline_attempt_id uuid unique references public.assessment_attempts(id),
 baseline_classification text check(baseline_classification in ('pre_learning','late_baseline','historical_unverified')),
 created_at timestamptz not null default now()
);
alter table public.learner_assessment_state enable row level security;
revoke all on public.learner_assessment_state from public,anon,authenticated;
grant select on public.learner_assessment_state to authenticated;
drop policy if exists own_assessment_state on public.learner_assessment_state;
create policy own_assessment_state on public.learner_assessment_state for select to authenticated using(user_id=(select auth.uid()));
create index if not exists learner_state_baseline_idx on public.learner_assessment_state(baseline_attempt_id);
-- Only evidence of learning, not merely a provisioned locked/available row, grants legacy access.
insert into public.learner_assessment_state(user_id,legacy_learner,baseline_attempt_id,baseline_classification)
select p.id,
 exists(select 1 from public.lesson_progress lp where lp.user_id=p.id)
 or exists(select 1 from public.module_progress mp where mp.user_id=p.id and (mp.started_at is not null or mp.completed_at is not null or mp.status in ('in_progress','completed')))
 or exists(select 1 from public.assessment_attempts t join public.assessments a on a.id=t.assessment_id where t.user_id=p.id and a.assessment_type='module_quiz'),
 base.id,case when base.id is not null then 'historical_unverified' end
from public.profiles p left join lateral (
 select t.id from public.assessment_attempts t join public.assessments a on a.id=t.assessment_id
 where t.user_id=p.id and a.assessment_type='diagnostic' and t.completed_at is not null and t.score is not null order by t.completed_at,t.id limit 1
) base on true on conflict(user_id) do nothing;

create or replace function finlit_private.knowledge_profile(p_attempt uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',t.id,'score',t.score,'total',(select count(*) from public.assessment_questions where assessment_id=a.id),
 'percentage',round(t.score*100/nullif((select count(*) from public.assessment_questions where assessment_id=a.id),0),1),
 'scores',t.topic_scores,'completedAt',t.completed_at,'version',a.assessment_version,'questionSet',a.content_key,'comparisonGroup',a.comparison_group,
 'classification',s.baseline_classification,
 'competencies',(select jsonb_agg(jsonb_build_object('key',key,'correct',(value->>'correct')::int,'total',(value->>'total')::int,'percentage',round((value->>'correct')::numeric*100/nullif((value->>'total')::numeric,0),1)) order by key) from jsonb_each(t.topic_scores)),
 'reviewAreas',(select coalesce(jsonb_agg(key order by key),'[]') from jsonb_each(t.topic_scores) where (value->>'correct')::int<(value->>'total')::int))
 from public.assessment_attempts t join public.assessments a on a.id=t.assessment_id
 left join public.learner_assessment_state s on s.baseline_attempt_id=t.id
 where t.id=p_attempt and t.user_id=auth.uid() and t.completed_at is not null
$$;
revoke all on function finlit_private.knowledge_profile(uuid) from public,anon,authenticated;

create or replace function finlit_private.knowledge_journey() returns jsonb
language plpgsql stable set search_path='' as $$
declare u uuid:=auth.uid(); st public.learner_assessment_state; baseline jsonb; final_result jsonb; eligible boolean; priorities jsonb; comparable boolean;
begin
 select * into st from public.learner_assessment_state where user_id=u;
 baseline:=finlit_private.knowledge_profile(st.baseline_attempt_id);
 select finlit_private.knowledge_profile(t.id) into final_result from public.assessment_attempts t join public.assessments a on a.id=t.assessment_id
 where t.user_id=u and a.assessment_type='final' and t.completed_at is not null order by t.completed_at,t.id limit 1;
 eligible:=(select count(*) from public.module_progress mp join public.modules m on m.id=mp.module_id where mp.user_id=u and mp.completed_at is not null and m.content_key in ('module-1','module-2','module-3','module-4','module-5','module-6'))=6
 and (select count(*) from public.lesson_progress lp join public.lessons l on l.id=lp.lesson_id where lp.user_id=u and lp.is_completed and l.content_key is not null and l.is_published)=24;
 select coalesce(jsonb_agg(jsonb_build_object('key',m.content_key,'correct',(x.value->>'correct')::int,'total',(x.value->>'total')::int,
 'available',finlit_private.module_available(u,m.id),'completedLessons',(select count(*) from public.lesson_progress lp join public.lessons l on l.id=lp.lesson_id where lp.user_id=u and lp.is_completed and l.module_id=m.id),
 'reason',case m.content_key when 'module-1' then 'Review available money, essential needs and competing obligations.' when 'module-2' then 'Practise planning expenses and adjusting budgets when costs change.' when 'module-3' then 'Review savings goals, contributions and responses to unexpected expenses.' when 'module-4' then 'Review borrowing charges, repayment dates and affordability.' when 'module-5' then 'Review payment records, transaction charges and suspicious financial requests.' else 'Review purchasing power, planning and investment risk.' end)
 order by (x.value->>'correct')::numeric/nullif((x.value->>'total')::numeric,0),m.sort_order),'[]') into priorities
 from jsonb_each(coalesce(baseline->'scores','{}')) x join public.modules m on m.content_key=x.key
 where (x.value->>'correct')::int<(x.value->>'total')::int
 and not exists(select 1 from public.module_progress mp where mp.user_id=u and mp.module_id=m.id and mp.completed_at is not null);
 comparable:=coalesce(baseline->>'classification'='pre_learning' and baseline->>'comparisonGroup'=final_result->>'comparisonGroup'
 and baseline->>'comparisonGroup' is not null and baseline->>'total'=final_result->>'total',false);
 return jsonb_build_object('required',st.baseline_attempt_id is null and not coalesce(st.legacy_learner,false),'legacy',coalesce(st.legacy_learner,false),
 'baseline',baseline,'final',final_result,'finalAvailable',eligible,'priorities',priorities,
 'comparison',jsonb_build_object('available',baseline is not null and final_result is not null,'comparable',comparable,
 'correctDifference',case when comparable then (final_result->>'score')::numeric-(baseline->>'score')::numeric end,
 'percentagePointDifference',case when comparable then round(((final_result->>'score')::numeric-(baseline->>'score')::numeric)*100/(baseline->>'total')::numeric,1) end,
 'limitation',case when baseline is null then 'No initial assessment is stored.' when final_result is null then 'Complete the final assessment to view your comparison.' when not comparable then 'These results are not a comparable pre-learning and post-learning pair: the initial assessment was taken after learning, its timing is unverified, or the question versions differ.' else 'These original paired question sets have not been psychometrically equated. Differences describe sampled short-term knowledge, not proven behaviour change or financial wellbeing.' end));
end $$;
revoke all on function finlit_private.knowledge_journey() from public,anon,authenticated;

create or replace function finlit_private.api(p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare u uuid:=auth.uid(); a public.assessments; t public.assessment_attempts; st public.learner_assessment_state;
 data jsonb; journey jsonb; total integer; answered integer; points integer; topics jsonb; chosen_key text; is_measurement boolean;
begin
 if u is null then raise exception 'Sign in to continue' using errcode='42501'; end if;
 -- The existing mutation lock also serialises baseline assignment and attempt resume.
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 insert into public.learner_assessment_state(user_id) values(u) on conflict(user_id) do nothing;
 select * into st from public.learner_assessment_state where user_id=u;
 journey:=finlit_private.knowledge_journey();
 if p_action='journey' then return journey; end if;
 if p_action='snapshot' then
  data:=finlit_private.curriculum_api_v1(p_action,p_payload);
  return data||jsonb_build_object('diagnostic',journey->'baseline','journey',journey);
 end if;
 if p_action in ('lesson','save_lesson') and (journey->>'required')::boolean then raise exception 'Complete your initial assessment before starting guided lessons.' using errcode='42501'; end if;
 if p_action in ('assessment','begin_assessment') then
  chosen_key:=case p_payload->>'key' when 'diagnostic' then 'diagnostic-v2' when 'final' then 'final-v1' else p_payload->>'key' end;
  select * into a from public.assessments where content_key=chosen_key and is_published;
  if a.id is null then raise exception 'Assessment unavailable'; end if;
  is_measurement:=a.assessment_type in ('diagnostic','final');
  if not is_measurement then
   if (journey->>'required')::boolean then raise exception 'Complete your initial assessment before starting guided lessons.' using errcode='42501'; end if;
   return finlit_private.curriculum_api_v1(p_action,p_payload);
  end if;
  if a.assessment_type='final' and not (journey->>'finalAvailable')::boolean then raise exception 'Complete all 24 lessons and pass all six module challenges to open the final assessment.' using errcode='42501'; end if;
  -- Once a baseline or final exists, show it rather than silently creating a retake.
  if p_action='begin_assessment' and a.assessment_type='diagnostic' and st.baseline_attempt_id is not null then return jsonb_build_object('completedAttempt',st.baseline_attempt_id); end if;
  if p_action='begin_assessment' and a.assessment_type='final' and journey->'final'<>'null'::jsonb then return jsonb_build_object('completedAttempt',journey#>>'{final,id}'); end if;
  select * into t from public.assessment_attempts where user_id=u and assessment_id=a.id and completed_at is null order by started_at,id limit 1;
  if p_action='begin_assessment' and t.id is null then insert into public.assessment_attempts(user_id,assessment_id) values(u,a.id) returning * into t; end if;
  return jsonb_build_object('assessment',to_jsonb(a),'attempt',case when p_action='begin_assessment' then to_jsonb(t) else null end,'activeAttempt',t.id,
   'baseline',journey->'baseline','legacy',st.legacy_learner,
   'answers',coalesce((select jsonb_object_agg(question_id,selected_option_id) from public.assessment_answers where attempt_id=t.id),'{}'),
   'questions',(select jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.question_text,'topic',q.topic,
    'options',(select jsonb_agg(jsonb_build_object('id',o.id,'text',o.option_text) order by o.sort_order) from public.assessment_options o where o.question_id=q.id)) order by q.sort_order) from public.assessment_questions q where q.assessment_id=a.id),
   'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.started_at) from public.assessment_attempts h where h.user_id=u and h.assessment_id=a.id and h.completed_at is not null),'[]'));
 end if;
 if p_action in ('answer','submit','result') then
  select * into t from public.assessment_attempts where id=(p_payload->>'attempt')::uuid and user_id=u;
  if t.id is null then raise exception 'Assessment attempt unavailable' using errcode='42501'; end if;
  select * into a from public.assessments where id=t.assessment_id;
  if a.assessment_type='module_quiz' then
   if p_action<>'result' and (journey->>'required')::boolean then raise exception 'Complete your initial assessment first.' using errcode='42501'; end if;
   return finlit_private.curriculum_api_v1(p_action,p_payload);
  end if;
  if a.assessment_type='final' and p_action<>'result' and not (journey->>'finalAvailable')::boolean then raise exception 'Complete all lessons and module challenges first.' using errcode='42501'; end if;
  if p_action='answer' then return finlit_private.curriculum_api_v1(p_action,p_payload); end if;
  if p_action='submit' and t.completed_at is null then
   if a.assessment_type='diagnostic' and st.baseline_attempt_id is not null then raise exception 'Your original assessment is already saved. Open your knowledge profile.'; end if;
   if t.revision is distinct from (p_payload->>'revision')::int then raise exception 'Answers changed in another view. Reload before submitting.' using errcode='40001'; end if;
   select count(*) into total from public.assessment_questions where assessment_id=a.id;
   if a.comparison_group is not null and total<>18 then raise exception 'Assessment content is incomplete'; end if;
   select count(*) into answered from public.assessment_answers ans join public.assessment_questions q on q.id=ans.question_id join public.assessment_options o on o.id=ans.selected_option_id and o.question_id=q.id join public.assessment_answer_keys k on k.question_id=q.id where ans.attempt_id=t.id and q.assessment_id=a.id;
   if total=0 or answered<>total then raise exception 'Save an answer to every question before submitting'; end if;
   update public.assessment_answers ans set is_correct=ans.selected_option_id=k.correct_option_id from public.assessment_answer_keys k where ans.attempt_id=t.id and k.question_id=ans.question_id;
   select count(*) into points from public.assessment_answers where attempt_id=t.id and is_correct;
   select jsonb_object_agg(topic,jsonb_build_object('correct',correct,'total',cnt)) into topics from (select q.topic,count(*) filter(where ans.is_correct) correct,count(*) cnt from public.assessment_questions q join public.assessment_answers ans on ans.question_id=q.id where ans.attempt_id=t.id group by q.topic) x;
   update public.assessment_attempts set score=points,passed=null,topic_scores=topics,completed_at=now(),revision=revision+1 where id=t.id returning * into t;
   if a.assessment_type='diagnostic' then
    update public.learner_assessment_state set baseline_attempt_id=t.id,baseline_classification=case when legacy_learner then 'late_baseline' when a.comparison_group is null then 'historical_unverified' else 'pre_learning' end where user_id=u and baseline_attempt_id is null;
   end if;
  end if;
  data:=finlit_private.curriculum_api_v1('result',jsonb_build_object('attempt',t.id));
  return data||jsonb_build_object('analysis',finlit_private.knowledge_profile(t.id),'journey',finlit_private.knowledge_journey());
 end if;
 return finlit_private.curriculum_api_v1(p_action,p_payload);
end $$;
revoke all on function finlit_private.api(text,jsonb) from public,anon;
grant execute on function finlit_private.api(text,jsonb) to authenticated;
