
CREATE INDEX IF NOT EXISTS assessment_answer_keys_question_option_idx
ON public.assessment_answer_keys (question_id, correct_option_id);

CREATE INDEX IF NOT EXISTS assessment_answers_question_selected_idx
ON public.assessment_answers (question_id, selected_option_id);
