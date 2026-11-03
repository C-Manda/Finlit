
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  institution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  sort_order integer not null unique check (sort_order > 0),
  pass_mark numeric(5,2) not null default 70 check (pass_mark between 0 and 100),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  summary text,
  content text not null default '',
  sort_order integer not null check (sort_order > 0),
  estimated_minutes integer not null default 5 check (estimated_minutes > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, sort_order)
);

create table public.practical_activities (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  instructions text not null,
  activity_type text not null check (activity_type in ('scenario', 'budget', 'savings', 'loan')),
  configuration jsonb not null default '{}'::jsonb,
  sort_order integer not null check (sort_order > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, sort_order)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id) on delete cascade,
  title text not null,
  assessment_type text not null check (assessment_type in ('diagnostic', 'module_quiz', 'final')),
  pass_mark numeric(5,2) not null default 70 check (pass_mark between 0 and 100),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (assessment_type = 'module_quiz' and module_id is not null)
    or (assessment_type in ('diagnostic', 'final') and module_id is null)
  )
);

create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  topic text not null check (topic in ('income', 'budgeting', 'saving', 'borrowing')),
  question_text text not null,
  feedback_text text,
  sort_order integer not null check (sort_order > 0),
  points integer not null default 1 check (points > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, sort_order)
);

create table public.assessment_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  option_text text not null,
  sort_order integer not null check (sort_order > 0),
  unique (question_id, sort_order)
);

create table public.assessment_answer_keys (
  question_id uuid primary key references public.assessment_questions(id) on delete cascade,
  correct_option_id uuid not null references public.assessment_options(id) on delete cascade,
  explanation text not null
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  score numeric(5,2) check (score is null or score between 0 and 100),
  passed boolean,
  topic_scores jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id) on delete cascade,
  selected_option_id uuid not null references public.assessment_options(id) on delete restrict,
  is_correct boolean,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table public.module_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked', 'available', 'in_progress', 'completed')),
  highest_score numeric(5,2) check (highest_score is null or highest_score between 0 and 100),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, module_id)
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  is_completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  entry_type text not null check (entry_type in ('income', 'expense')),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  check ((is_system and user_id is null) or (not is_system and user_id is not null))
);

create unique index financial_categories_system_unique
  on public.financial_categories (lower(name), entry_type)
  where is_system;

create unique index financial_categories_user_unique
  on public.financial_categories (user_id, lower(name), entry_type)
  where not is_system;

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.financial_categories(id) on delete restrict,
  entry_type text not null check (entry_type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.financial_categories(id) on delete restrict,
  entry_type text not null check (entry_type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  description text,
  frequency_unit text not null check (frequency_unit in ('day', 'week', 'month', 'year')),
  interval_count integer not null default 1 check (interval_count > 0),
  starts_on date not null,
  ends_on date,
  next_occurrence_on date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.loan_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_source text not null check (input_source in ('budget_tracker', 'manual')),
  principal numeric(14,2) not null check (principal > 0),
  annual_interest_rate numeric(7,4) not null check (annual_interest_rate >= 0),
  term_months integer not null check (term_months > 0),
  monthly_income numeric(14,2) not null check (monthly_income >= 0),
  monthly_expenses numeric(14,2) not null check (monthly_expenses >= 0),
  estimated_monthly_payment numeric(14,2) not null check (estimated_monthly_payment >= 0),
  estimated_total_repayment numeric(14,2) not null check (estimated_total_repayment >= 0),
  repayment_to_income_ratio numeric(8,4),
  remaining_income numeric(14,2) not null,
  affordability_result text not null check (affordability_result in ('lower_pressure', 'caution', 'high_pressure')),
  educational_warning text not null,
  calculated_at timestamptz not null default now()
);

create table public.ai_explanations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  request_type text not null check (request_type in ('simplify', 'expand', 'example', 'quiz_feedback')),
  source_section text,
  source_fingerprint text not null,
  explanation text not null,
  created_at timestamptz not null default now()
);

create index ai_explanations_reuse_idx
  on public.ai_explanations (user_id, lesson_id, request_type, source_fingerprint);

create table public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_active_on date,
  updated_at timestamptz not null default now()
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  icon_name text,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reminders_enabled boolean not null default true,
  reminder_time time not null default '18:00',
  timezone text not null default 'Africa/Lusaka',
  inactivity_days integer not null default 2 check (inactivity_days between 1 and 30),
  updated_at timestamptz not null default now()
);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  is_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index lessons_module_idx on public.lessons(module_id);
create index practical_activities_module_idx on public.practical_activities(module_id);
create index assessments_module_idx on public.assessments(module_id);
create index assessment_questions_assessment_idx on public.assessment_questions(assessment_id);
create index assessment_options_question_idx on public.assessment_options(question_id);
create index assessment_attempts_user_idx on public.assessment_attempts(user_id, started_at desc);
create index assessment_attempts_assessment_idx on public.assessment_attempts(assessment_id);
create index assessment_answers_attempt_idx on public.assessment_answers(attempt_id);
create index module_progress_user_idx on public.module_progress(user_id, status);
create index lesson_progress_user_idx on public.lesson_progress(user_id, is_completed);
create index financial_entries_user_date_idx on public.financial_entries(user_id, occurred_on desc);
create index recurring_entries_user_active_idx on public.recurring_entries(user_id, is_active);
create index loan_assessments_user_date_idx on public.loan_assessments(user_id, calculated_at desc);
create index push_devices_user_idx on public.push_devices(user_id);

create trigger profiles_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger modules_updated_at before update on public.modules
for each row execute function private.set_updated_at();
create trigger lessons_updated_at before update on public.lessons
for each row execute function private.set_updated_at();
create trigger practical_activities_updated_at before update on public.practical_activities
for each row execute function private.set_updated_at();
create trigger assessments_updated_at before update on public.assessments
for each row execute function private.set_updated_at();
create trigger assessment_questions_updated_at before update on public.assessment_questions
for each row execute function private.set_updated_at();
create trigger module_progress_updated_at before update on public.module_progress
for each row execute function private.set_updated_at();
create trigger lesson_progress_updated_at before update on public.lesson_progress
for each row execute function private.set_updated_at();
create trigger financial_entries_updated_at before update on public.financial_entries
for each row execute function private.set_updated_at();
create trigger recurring_entries_updated_at before update on public.recurring_entries
for each row execute function private.set_updated_at();
create trigger user_streaks_updated_at before update on public.user_streaks
for each row execute function private.set_updated_at();
create trigger notification_preferences_updated_at before update on public.notification_preferences
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  insert into public.user_streaks (user_id)
  values (new.id);

  insert into public.notification_preferences (user_id)
  values (new.id);

  insert into public.module_progress (user_id, module_id, status)
  select new.id, m.id,
    case when m.sort_order = 1 then 'available' else 'locked' end
  from public.modules m;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.modules
  (title, slug, description, sort_order, pass_mark, estimated_minutes)
values
  ('Managing Income', 'managing-income', 'Understanding regular and irregular income and planning before spending.', 1, 70, 25),
  ('Budgeting and Expenses', 'budgeting-and-expenses', 'Planning income, prioritising needs and controlling expenses.', 2, 70, 30),
  ('Saving and Emergency Planning', 'saving-and-emergency-planning', 'Setting savings goals and preparing for unexpected expenses.', 3, 70, 25),
  ('Responsible Borrowing', 'responsible-borrowing', 'Understanding interest, repayments, affordability and borrowing pressure.', 4, 70, 30);

insert into public.assessments
  (title, assessment_type, pass_mark)
values
  ('Initial Financial Knowledge Assessment', 'diagnostic', 0),
  ('Final Financial Knowledge Assessment', 'final', 70);

insert into public.financial_categories (name, entry_type, is_system)
values
  ('Salary', 'income', true),
  ('Gift', 'income', true),
  ('Allowance', 'income', true),
  ('Family support', 'income', true),
  ('Part-time work', 'income', true),
  ('Other income', 'income', true),
  ('Food', 'expense', true),
  ('Medical', 'expense', true),
  ('Groceries', 'expense', true),
  ('Transport', 'expense', true),
  ('Rent', 'expense', true),
  ('Utilities', 'expense', true),
  ('Data and Wi-Fi', 'expense', true),
  ('Academic expenses', 'expense', true),
  ('Entertainment', 'expense', true),
  ('Savings', 'expense', true),
  ('Other expense', 'expense', true);

insert into public.badges (code, name, description, icon_name)
values
  ('first_lesson', 'First Step', 'Complete your first lesson.', 'book-open'),
  ('first_module', 'Module Finisher', 'Complete your first module.', 'award'),
  ('three_day_streak', 'Three-Day Streak', 'Learn on three consecutive days.', 'flame'),
  ('budget_started', 'Budget Starter', 'Record your first income or expense.', 'wallet-cards'),
  ('all_modules', 'Financial Learning Journey', 'Complete every learning module.', 'trophy');

alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.practical_activities enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_options enable row level security;
alter table public.assessment_answer_keys enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.module_progress enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.financial_categories enable row level security;
alter table public.financial_entries enable row level security;
alter table public.recurring_entries enable row level security;
alter table public.loan_assessments enable row level security;
alter table public.ai_explanations enable row level security;
alter table public.user_streaks enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_devices enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "modules_read_published" on public.modules for select to authenticated
using (is_published or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "modules_admin_all" on public.modules for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "lessons_read_published" on public.lessons for select to authenticated
using (is_published or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "lessons_admin_all" on public.lessons for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "activities_read_published" on public.practical_activities for select to authenticated
using (is_published or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "activities_admin_all" on public.practical_activities for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "assessments_read_published" on public.assessments for select to authenticated
using (is_published or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "assessments_admin_all" on public.assessments for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "questions_read_for_published_assessment" on public.assessment_questions for select to authenticated
using (
  exists (
    select 1 from public.assessments a
    where a.id = assessment_id
      and (a.is_published or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  )
);
create policy "questions_admin_all" on public.assessment_questions for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "options_read_for_published_assessment" on public.assessment_options for select to authenticated
using (
  exists (
    select 1
    from public.assessment_questions q
    join public.assessments a on a.id = q.assessment_id
    where q.id = question_id
      and (a.is_published or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  )
);
create policy "options_admin_all" on public.assessment_options for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "answer_keys_admin_only" on public.assessment_answer_keys for all to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "attempts_own_or_admin_select" on public.assessment_attempts for select to authenticated
using (user_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "attempts_insert_own" on public.assessment_attempts for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "attempts_update_own" on public.assessment_attempts for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "answers_own_or_admin_select" on public.assessment_answers for select to authenticated
using (
  exists (
    select 1 from public.assessment_attempts aa
    where aa.id = attempt_id
      and (aa.user_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  )
);
create policy "answers_insert_own" on public.assessment_answers for insert to authenticated
with check (
  exists (
    select 1 from public.assessment_attempts aa
    where aa.id = attempt_id and aa.user_id = (select auth.uid())
  )
);
create policy "answers_update_own" on public.assessment_answers for update to authenticated
using (
  exists (
    select 1 from public.assessment_attempts aa
    where aa.id = attempt_id and aa.user_id = (select auth.uid())
  )
) with check (
  exists (
    select 1 from public.assessment_attempts aa
    where aa.id = attempt_id and aa.user_id = (select auth.uid())
  )
);

create policy "module_progress_own_or_admin_select" on public.module_progress for select to authenticated
using (user_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "module_progress_own_insert" on public.module_progress for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "module_progress_own_update" on public.module_progress for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "lesson_progress_own_or_admin_select" on public.lesson_progress for select to authenticated
using (user_id = (select auth.uid()) or (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "lesson_progress_own_insert" on public.lesson_progress for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "lesson_progress_own_update" on public.lesson_progress for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "categories_read_system_or_own" on public.financial_categories for select to authenticated
using (is_system or user_id = (select auth.uid()));
create policy "categories_insert_own" on public.financial_categories for insert to authenticated
with check (not is_system and user_id = (select auth.uid()));
create policy "categories_update_own" on public.financial_categories for update to authenticated
using (not is_system and user_id = (select auth.uid()))
with check (not is_system and user_id = (select auth.uid()));
create policy "categories_delete_own" on public.financial_categories for delete to authenticated
using (not is_system and user_id = (select auth.uid()));

create policy "financial_entries_own_all" on public.financial_entries for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recurring_entries_own_all" on public.recurring_entries for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "loan_assessments_own_all" on public.loan_assessments for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "ai_explanations_own_all" on public.ai_explanations for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "streaks_own_select" on public.user_streaks for select to authenticated
using (user_id = (select auth.uid()));
create policy "streaks_own_update" on public.user_streaks for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "badges_authenticated_read" on public.badges for select to authenticated using (true);
create policy "user_badges_own_select" on public.user_badges for select to authenticated
using (user_id = (select auth.uid()));
create policy "notification_preferences_own_all" on public.notification_preferences for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "push_devices_own_all" on public.push_devices for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select on public.modules, public.lessons, public.practical_activities,
  public.assessments, public.assessment_questions, public.assessment_options,
  public.financial_categories, public.badges to authenticated;
grant select, insert, update on public.profiles, public.assessment_attempts,
  public.assessment_answers, public.module_progress, public.lesson_progress,
  public.financial_entries, public.recurring_entries, public.loan_assessments,
  public.ai_explanations, public.user_streaks, public.user_badges,
  public.notification_preferences, public.push_devices to authenticated;
grant delete on public.financial_entries, public.recurring_entries,
  public.loan_assessments, public.ai_explanations, public.push_devices to authenticated;
grant insert, update, delete on public.financial_categories to authenticated;
grant insert, update, delete on public.modules, public.lessons,
  public.practical_activities, public.assessments, public.assessment_questions,
  public.assessment_options, public.assessment_answer_keys, public.badges to authenticated;
grant select on public.assessment_answer_keys to authenticated;
