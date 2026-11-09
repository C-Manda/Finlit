begin;

create or replace function private.validate_engagement_source(
  p_user uuid,
  p_activity_type text,
  p_source_key text
) returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_activity_type = 'lesson_completed' and not exists (
    select 1 from public.lesson_progress
    where user_id = p_user and lesson_id = p_source_key::uuid and is_completed
  ) then
    raise exception 'Lesson completion has not been verified';
  elsif p_activity_type = 'module_challenge_completed' and not exists (
    select 1 from public.module_progress
    where user_id = p_user and module_id = p_source_key::uuid and completed_at is not null
  ) then
    raise exception 'Module completion has not been verified';
  elsif p_activity_type = 'assessment_completed' and not exists (
    select 1 from public.assessment_attempts
    where user_id = p_user and id = p_source_key::uuid and completed_at is not null
  ) then
    raise exception 'Assessment completion has not been verified';
  elsif p_activity_type = 'budget_created' and not exists (
    select 1 from public.budget_plans where user_id = p_user and id = p_source_key::uuid
  ) then
    raise exception 'Budget creation has not been verified';
  elsif p_activity_type = 'financial_entry_created' and not exists (
    select 1 from public.financial_entries
    where user_id = p_user and id = p_source_key::uuid and deleted_at is null
  ) then
    raise exception 'Financial entry has not been verified';
  elsif p_activity_type = 'daily_check_in' and p_source_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Daily check-in requires a stable date source identifier';
  end if;
exception
  when invalid_text_representation then
    raise exception 'Engagement source identifier is invalid';
end;
$$;

revoke all on function private.validate_engagement_source(uuid, text, text)
  from public, anon, authenticated;

commit;
