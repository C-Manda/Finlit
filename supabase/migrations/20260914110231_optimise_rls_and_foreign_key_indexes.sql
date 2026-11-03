
create index practical_activities_lesson_idx on public.practical_activities(lesson_id);
create index assessment_answer_keys_option_idx on public.assessment_answer_keys(correct_option_id);
create index assessment_answers_question_idx on public.assessment_answers(question_id);
create index assessment_answers_option_idx on public.assessment_answers(selected_option_id);
create index module_progress_module_idx on public.module_progress(module_id);
create index lesson_progress_lesson_idx on public.lesson_progress(lesson_id);
create index financial_entries_category_idx on public.financial_entries(category_id);
create index recurring_entries_category_idx on public.recurring_entries(category_id);
create index ai_explanations_lesson_idx on public.ai_explanations(lesson_id);
create index user_badges_badge_idx on public.user_badges(badge_id);

drop policy "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
using ((select auth.uid()) = id or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "modules_read_published" on public.modules;
drop policy "modules_admin_all" on public.modules;
create policy "modules_read_published_or_admin" on public.modules for select to authenticated
using (is_published or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "modules_admin_insert" on public.modules for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "modules_admin_update" on public.modules for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "modules_admin_delete" on public.modules for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "lessons_read_published" on public.lessons;
drop policy "lessons_admin_all" on public.lessons;
create policy "lessons_read_published_or_admin" on public.lessons for select to authenticated
using (is_published or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "lessons_admin_insert" on public.lessons for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "lessons_admin_update" on public.lessons for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "lessons_admin_delete" on public.lessons for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "activities_read_published" on public.practical_activities;
drop policy "activities_admin_all" on public.practical_activities;
create policy "activities_read_published_or_admin" on public.practical_activities for select to authenticated
using (is_published or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "activities_admin_insert" on public.practical_activities for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "activities_admin_update" on public.practical_activities for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "activities_admin_delete" on public.practical_activities for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "assessments_read_published" on public.assessments;
drop policy "assessments_admin_all" on public.assessments;
create policy "assessments_read_published_or_admin" on public.assessments for select to authenticated
using (is_published or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "assessments_admin_insert" on public.assessments for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "assessments_admin_update" on public.assessments for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "assessments_admin_delete" on public.assessments for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "questions_read_for_published_assessment" on public.assessment_questions;
drop policy "questions_admin_all" on public.assessment_questions;
create policy "questions_read_published_or_admin" on public.assessment_questions for select to authenticated
using (
  exists (
    select 1 from public.assessments a
    where a.id = assessment_id
      and (a.is_published or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  )
);
create policy "questions_admin_insert" on public.assessment_questions for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "questions_admin_update" on public.assessment_questions for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "questions_admin_delete" on public.assessment_questions for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "options_read_for_published_assessment" on public.assessment_options;
drop policy "options_admin_all" on public.assessment_options;
create policy "options_read_published_or_admin" on public.assessment_options for select to authenticated
using (
  exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = question_id
      and (a.is_published or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  )
);
create policy "options_admin_insert" on public.assessment_options for insert to authenticated
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "options_admin_update" on public.assessment_options for update to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "options_admin_delete" on public.assessment_options for delete to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "answer_keys_admin_only" on public.assessment_answer_keys;
create policy "answer_keys_admin_only" on public.assessment_answer_keys for all to authenticated
using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "attempts_own_or_admin_select" on public.assessment_attempts;
create policy "attempts_own_or_admin_select" on public.assessment_attempts for select to authenticated
using (user_id = (select auth.uid()) or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "answers_own_or_admin_select" on public.assessment_answers;
create policy "answers_own_or_admin_select" on public.assessment_answers for select to authenticated
using (
  exists (
    select 1 from public.assessment_attempts aa
    where aa.id = attempt_id
      and (aa.user_id = (select auth.uid()) or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  )
);

drop policy "module_progress_own_or_admin_select" on public.module_progress;
create policy "module_progress_own_or_admin_select" on public.module_progress for select to authenticated
using (user_id = (select auth.uid()) or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

drop policy "lesson_progress_own_or_admin_select" on public.lesson_progress;
create policy "lesson_progress_own_or_admin_select" on public.lesson_progress for select to authenticated
using (user_id = (select auth.uid()) or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
