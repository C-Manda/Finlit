-- Profile engagement and Android notification foundations.
-- This migration is intentionally idempotent so it can reproduce the live schema
-- without replacing the existing financial or learning tables.
begin;

create table if not exists public.engagement_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'lesson_completed', 'module_challenge_completed', 'assessment_completed',
    'budget_created', 'financial_entry_created', 'daily_check_in'
  )),
  source_key text not null,
  activity_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, activity_type, source_key, activity_date)
);

create index if not exists engagement_activity_user_date_idx
  on public.engagement_activity (user_id, activity_date desc);
alter table public.engagement_activity
  drop constraint if exists engagement_activity_user_id_activity_type_source_key_activity_date_key;
create unique index if not exists engagement_activity_source_unique
  on public.engagement_activity (user_id, activity_type, source_key);

create table if not exists public.financial_tips (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'budgeting', 'saving', 'spending', 'mobile_money', 'borrowing', 'general'
  )),
  tip_text text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.push_devices(id) on delete set null,
  notification_key text not null,
  category text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_ticket text,
  error_message text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (user_id, notification_key, scheduled_for)
);

alter table public.notification_preferences
  add column if not exists budget_tips_enabled boolean not null default true,
  add column if not exists general_tips_enabled boolean not null default true,
  add column if not exists streak_reminders_enabled boolean not null default true,
  add column if not exists inactivity_reminders_enabled boolean not null default true,
  add column if not exists notification_frequency text not null default 'daily',
  add column if not exists quiet_hours_start time not null default '21:00',
  add column if not exists quiet_hours_end time not null default '07:00',
  add column if not exists permission_status text not null default 'unknown';

alter table public.notification_preferences
  drop constraint if exists notification_preferences_frequency_check;
alter table public.notification_preferences
  add constraint notification_preferences_frequency_check
  check (notification_frequency in ('daily', 'weekly'));

alter table public.engagement_activity enable row level security;
alter table public.financial_tips enable row level security;
alter table public.notification_delivery_log enable row level security;

revoke all on public.engagement_activity from public, anon, authenticated;
revoke all on public.notification_delivery_log from public, anon, authenticated;
grant select on public.financial_tips to authenticated;

drop policy if exists financial_tips_read_active on public.financial_tips;
create policy financial_tips_read_active on public.financial_tips
  for select to authenticated using (is_active);

insert into public.badges (code, name, description, icon_name)
values
  ('first_lesson', 'First Step', 'Complete your first lesson.', 'book-open'),
  ('curious_mind', 'Curious Mind', 'Complete five lessons.', 'bulb'),
  ('knowledge_builder', 'Knowledge Builder', 'Complete ten lessons.', 'library'),
  ('first_module', 'Module Finisher', 'Complete your first module.', 'award'),
  ('all_modules', 'Financial Learning Journey', 'Complete every learning module.', 'trophy'),
  ('three_day_streak', 'Three-Day Streak', 'Learn on three consecutive days.', 'flame'),
  ('seven_day_streak', 'One Week Strong', 'Keep a seven-day streak.', 'flame'),
  ('fourteen_day_streak', 'Two Weeks of Growth', 'Keep a fourteen-day streak.', 'flame'),
  ('monthly_momentum', 'Monthly Momentum', 'Keep a thirty-day streak.', 'calendar'),
  ('unstoppable', 'Unstoppable', 'Keep a ninety-day streak.', 'rocket'),
  ('century_club', 'Century Club', 'Keep a one-hundred-day streak.', 'medal'),
  ('budget_started', 'Budget Starter', 'Create your first budget.', 'wallet-cards')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon_name = excluded.icon_name;

insert into public.financial_tips (category, tip_text, sort_order)
values
  ('budgeting', 'Give every planned expense a clear purpose before the month begins.', 10),
  ('budgeting', 'Review your budget once during the week so small changes stay manageable.', 20),
  ('saving', 'A small, regular saving habit is easier to maintain than an occasional large target.', 10),
  ('spending', 'Pause before unplanned purchases and compare them with your current priorities.', 10),
  ('mobile_money', 'Check the recipient and fee details before confirming a mobile money transfer.', 10),
  ('borrowing', 'Before borrowing, write down the total repayment and the date it will be due.', 10),
  ('general', 'Learning one practical money idea today can improve tomorrow’s decisions.', 10)
on conflict do nothing;

commit;
