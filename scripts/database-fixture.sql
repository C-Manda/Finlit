-- Disposable test schema based ONLY on repository types, not a live schema export.
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.profiles(id uuid primary key references auth.users(id),full_name text,institution text,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.modules(id uuid primary key default gen_random_uuid(),title text not null,slug text not null unique,description text,sort_order int not null,pass_mark int default 75,estimated_minutes int,is_published boolean default false,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.lessons(id uuid primary key default gen_random_uuid(),module_id uuid not null references public.modules(id),title text not null,summary text,content text not null default '',sort_order int not null,estimated_minutes int default 10,is_published boolean default false,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.lesson_progress(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),lesson_id uuid not null references public.lessons(id),is_completed boolean default false,completed_at timestamptz,updated_at timestamptz default now(),unique(user_id,lesson_id));
create table public.module_progress(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),module_id uuid not null references public.modules(id),status text default 'not_started',highest_score int,started_at timestamptz,completed_at timestamptz,updated_at timestamptz default now(),unique(user_id,module_id));
create table public.assessments(id uuid primary key default gen_random_uuid(),module_id uuid references public.modules(id),title text not null,assessment_type text not null,pass_mark int default 75,is_published boolean default false,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.assessment_questions(id uuid primary key default gen_random_uuid(),assessment_id uuid not null references public.assessments(id),topic text not null,question_text text not null,feedback_text text,sort_order int not null,points int default 1,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.assessment_options(id uuid primary key default gen_random_uuid(),question_id uuid not null references public.assessment_questions(id),option_text text not null,sort_order int not null);
create table public.assessment_answer_keys(question_id uuid primary key references public.assessment_questions(id),correct_option_id uuid not null references public.assessment_options(id),explanation text not null);
create table public.assessment_attempts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),assessment_id uuid not null references public.assessments(id),score int,passed boolean,topic_scores jsonb default '{}',started_at timestamptz default now(),completed_at timestamptz);
create table public.assessment_answers(id uuid primary key default gen_random_uuid(),attempt_id uuid not null references public.assessment_attempts(id),question_id uuid not null references public.assessment_questions(id),selected_option_id uuid not null references public.assessment_options(id),is_correct boolean,answered_at timestamptz default now(),unique(attempt_id,question_id));
create table public.financial_categories(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),name text not null,entry_type text not null check(entry_type in ('income','expense')),is_system boolean default false,created_at timestamptz default now());
create table public.financial_entries(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),category_id uuid not null references public.financial_categories(id),entry_type text not null check(entry_type in ('income','expense')),amount numeric(12,2) not null check(amount>0),description text,occurred_on date default current_date,created_at timestamptz default now(),updated_at timestamptz default now());

-- Compatibility checks verified against the live schema on 2026-11-02.
alter table public.assessments add constraint assessments_assessment_type_check check(assessment_type in ('diagnostic','module_quiz','final'));
alter table public.assessments add constraint assessments_check check((assessment_type='module_quiz' and module_id is not null) or (assessment_type in ('diagnostic','final') and module_id is null));
alter table public.assessment_questions add constraint assessment_questions_topic_check check(topic in ('income','budgeting','saving','borrowing'));
