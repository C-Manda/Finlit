
alter table public.assessment_options
  add constraint assessment_options_question_id_id_unique unique (question_id, id);

alter table public.assessment_answer_keys
  add constraint answer_key_option_matches_question
  foreign key (question_id, correct_option_id)
  references public.assessment_options(question_id, id)
  on delete cascade;

alter table public.assessment_answers
  add constraint selected_option_matches_question
  foreign key (question_id, selected_option_id)
  references public.assessment_options(question_id, id)
  on delete restrict;

revoke insert, update on public.assessment_attempts from authenticated;
grant insert (user_id, assessment_id) on public.assessment_attempts to authenticated;

revoke insert, update on public.assessment_answers from authenticated;
grant insert (attempt_id, question_id, selected_option_id) on public.assessment_answers to authenticated;
grant update (selected_option_id) on public.assessment_answers to authenticated;

revoke insert, update on public.module_progress from authenticated;
revoke insert, update on public.lesson_progress from authenticated;
revoke insert, update on public.user_streaks from authenticated;
revoke insert on public.user_badges from authenticated;
revoke insert, update on public.loan_assessments from authenticated;
revoke insert, update on public.ai_explanations from authenticated;
