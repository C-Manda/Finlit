
-- Hide the legacy test curriculum without deleting it or its historical progress.
UPDATE public.modules
SET is_published = false
WHERE slug = 'test-financial-foundations'
  AND content_key IS NULL
  AND is_published = true;

UPDATE public.lessons
SET is_published = false
WHERE module_id = (
  SELECT id FROM public.modules
  WHERE slug = 'test-financial-foundations' AND content_key IS NULL
)
AND is_published = true;

-- Backfill published curriculum module progress for existing accounts.
-- Preserve all existing statuses, scores and completion timestamps.
INSERT INTO public.module_progress (user_id, module_id, status)
SELECT p.id, m.id,
       CASE WHEN m.sort_order = 1 THEN 'available' ELSE 'locked' END
FROM public.profiles p
CROSS JOIN public.modules m
WHERE m.is_published = true
  AND m.content_key IS NOT NULL
ON CONFLICT (user_id, module_id) DO NOTHING;

-- Future signups must not receive retired/test modules.
CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name');

  INSERT INTO public.user_streaks (user_id)
  VALUES (new.id);

  INSERT INTO public.notification_preferences (user_id)
  VALUES (new.id);

  INSERT INTO public.module_progress (user_id, module_id, status)
  SELECT new.id, m.id,
         CASE WHEN m.sort_order = 1 THEN 'available' ELSE 'locked' END
  FROM public.modules m
  WHERE m.is_published = true AND m.content_key IS NOT NULL;

  RETURN new;
END;
$function$;

-- Keep constraint-backed unique indexes; remove only redundant standalone copies.
DROP INDEX IF EXISTS public.assessment_answers_attempt_question;
DROP INDEX IF EXISTS public.lesson_progress_owner_lesson;
DROP INDEX IF EXISTS public.module_progress_owner_module;
