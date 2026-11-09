begin;

create or replace function private.record_engagement_activity_impl(
  p_activity_type text,
  p_source_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := auth.uid();
  activity_day date;
  inserted_day date;
  user_timezone text;
  streak public.user_streaks;
  activity_count integer;
  lesson_count integer;
  module_count integer;
begin
  if u is null then raise exception 'Authentication required'; end if;
  select coalesce(timezone, 'Africa/Lusaka') into user_timezone
  from public.notification_preferences where user_id = u;
  activity_day := (now() at time zone coalesce(user_timezone, 'Africa/Lusaka'))::date;

  perform private.validate_engagement_source(u, p_activity_type, p_source_key);

  insert into public.engagement_activity (
    user_id, activity_type, source_key, activity_date
  ) values (u, p_activity_type, p_source_key, activity_day)
  on conflict (user_id, activity_type, source_key) do nothing
  returning activity_date into inserted_day;

  if inserted_day is null then
    select * into streak from public.user_streaks where user_id = u;
    return jsonb_build_object('recorded', false, 'streak', to_jsonb(streak));
  end if;

  insert into public.user_streaks (user_id, current_streak, longest_streak, last_active_on)
  values (u, 1, 1, activity_day)
  on conflict (user_id) do update set
    current_streak = case
      when public.user_streaks.last_active_on = activity_day then public.user_streaks.current_streak
      when public.user_streaks.last_active_on = activity_day - 1 then public.user_streaks.current_streak + 1
      else 1
    end,
    longest_streak = greatest(
      public.user_streaks.longest_streak,
      case
        when public.user_streaks.last_active_on = activity_day then public.user_streaks.current_streak
        when public.user_streaks.last_active_on = activity_day - 1 then public.user_streaks.current_streak + 1
        else 1
      end
    ),
    last_active_on = greatest(public.user_streaks.last_active_on, activity_day),
    updated_at = now()
  returning * into streak;

  select count(*) into activity_count from public.engagement_activity
    where user_id = u and activity_type = 'lesson_completed';
  select count(*) into lesson_count from public.lesson_progress
    where user_id = u and is_completed;
  select count(*) into module_count from public.module_progress
    where user_id = u and completed_at is not null;

  insert into public.user_badges (user_id, badge_id)
  select u, b.id from public.badges b
  where b.code in (
    case when lesson_count >= 1 then 'first_lesson' end,
    case when lesson_count >= 5 then 'curious_mind' end,
    case when lesson_count >= 10 then 'knowledge_builder' end,
    case when module_count >= 1 then 'first_module' end,
    case when exists (
      select 1 from public.modules m where m.is_published and m.content_key is not null
    ) and not exists (
      select 1 from public.modules m
      where m.is_published and m.content_key is not null
        and not exists (
          select 1 from public.module_progress mp
          where mp.user_id = u and mp.module_id = m.id and mp.completed_at is not null
        )
    ) then 'all_modules' end,
    case when streak.current_streak >= 3 then 'three_day_streak' end,
    case when streak.current_streak >= 7 then 'seven_day_streak' end,
    case when streak.current_streak >= 14 then 'fourteen_day_streak' end,
    case when streak.current_streak >= 30 then 'monthly_momentum' end,
    case when streak.current_streak >= 90 then 'unstoppable' end,
    case when streak.current_streak >= 100 then 'century_club' end,
    case when exists (select 1 from public.engagement_activity where user_id = u and activity_type = 'budget_created')
      then 'budget_started' end
  )
  on conflict (user_id, badge_id) do nothing;

  return jsonb_build_object(
    'recorded', true,
    'activityDate', activity_day,
    'streak', to_jsonb(streak)
  );
end;
$$;

create or replace function public.record_engagement_activity(
  p_activity_type text,
  p_source_key text
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_engagement_activity_impl(
    p_activity_type, p_source_key
  );
$$;

revoke all on function private.record_engagement_activity_impl(text, text)
  from public, anon, authenticated;
revoke all on function public.record_engagement_activity(text, text)
  from public, anon;
grant execute on function public.record_engagement_activity(text, text)
  to authenticated;

create or replace function private.get_engagement_summary_impl()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'streak', coalesce(
      (select to_jsonb(s) from public.user_streaks s where s.user_id = auth.uid()),
      jsonb_build_object('current_streak', 0, 'longest_streak', 0, 'last_active_on', null)
    ),
    'activityDates', coalesce(
      (select jsonb_agg(distinct a.activity_date order by a.activity_date desc)
       from public.engagement_activity a
       where a.user_id = auth.uid()
         and a.activity_date >= (
           (now() at time zone coalesce(
             (select timezone from public.notification_preferences where user_id = auth.uid()),
             'Africa/Lusaka'
           ))::date - 6
         )),
      '[]'::jsonb
    ),
    'lessonCount', (select count(*) from public.lesson_progress where user_id = auth.uid() and is_completed),
    'moduleCount', (select count(*) from public.module_progress where user_id = auth.uid() and completed_at is not null),
    'badges', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'code', b.code, 'name', b.name, 'description', b.description,
        'icon_name', b.icon_name, 'awarded_at', ub.awarded_at
      ) order by ub.awarded_at desc)
       from public.user_badges ub join public.badges b on b.id = ub.badge_id
       where ub.user_id = auth.uid()),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.get_engagement_summary()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_engagement_summary_impl();
$$;

revoke all on function private.get_engagement_summary_impl() from public, anon, authenticated;
revoke all on function public.get_engagement_summary() from public, anon;
grant execute on function public.get_engagement_summary() to authenticated;

commit;
