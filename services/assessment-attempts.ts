import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types';

import { supabase } from '@/lib/supabase';
import { recordEngagementActivity } from '@/services/engagement';

export type AssessmentAttempt = Tables<'assessment_attempts'>;
export type AssessmentAnswer = Tables<'assessment_answers'>;

export type AssessmentResult = {
  attempt: AssessmentAttempt;
  answers: Pick<AssessmentAnswer, 'id' | 'attempt_id' | 'question_id' | 'selected_option_id' | 'answered_at'>[];
  questionCount: number;
};

async function findOrCreateAssessmentAttempt(userId: string, assessmentId: string): Promise<AssessmentAttempt> {
  const { data: existing, error: existingError } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('assessment_id', assessmentId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const insert: TablesInsert<'assessment_attempts'> = {
    user_id: userId,
    assessment_id: assessmentId,
  };

  const { data, error } = await supabase
    .from('assessment_attempts')
    .insert(insert)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// Coalesce duplicate mounts in this runtime. Cross-device races still require a DB constraint.
const starting = new Map<string, Promise<AssessmentAttempt>>();
export function createAssessmentAttempt(userId: string, assessmentId: string): Promise<AssessmentAttempt> {
  const key = JSON.stringify([userId, assessmentId]);
  const pending = starting.get(key);
  if (pending) return pending;
  const task = findOrCreateAssessmentAttempt(userId, assessmentId).finally(() => starting.delete(key));
  starting.set(key, task);
  return task;
}

export async function saveAssessmentAnswer(
  userId: string,
  answer: Pick<AssessmentAnswer, 'attempt_id' | 'question_id' | 'selected_option_id'>,
): Promise<AssessmentAnswer> {
  const { data: attempt, error: attemptError } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('id', answer.attempt_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (attemptError) throw attemptError;
  if (!attempt) throw new Error('This assessment could not be found in your account.');

  if (attempt.completed_at) throw new Error('This assessment has already been submitted.');
  const { data: question, error: questionError } = await supabase.from('assessment_questions')
    .select('id').eq('id', answer.question_id).eq('assessment_id', attempt.assessment_id).maybeSingle();
  if (questionError) throw questionError;
  if (!question) throw new Error('This question does not belong to the assessment.');
  // Only selected_option_id is UPDATE-granted; an upsert would also update immutable keys.
  const updateAnswer = () => supabase.from('assessment_answers')
    .update({ selected_option_id: answer.selected_option_id })
    .eq('attempt_id', answer.attempt_id).eq('question_id', answer.question_id)
    .select('*').maybeSingle();
  const updated = await updateAnswer();
  if (updated.error) throw updated.error;
  if (updated.data) return updated.data;
  // The live composite FK verifies option/question membership.
  const inserted = await supabase.from('assessment_answers').insert({
    attempt_id: answer.attempt_id, question_id: answer.question_id,
    selected_option_id: answer.selected_option_id,
  }).select('*').single();
  if (!inserted.error) return inserted.data;
  if (inserted.error.code === '23505') {
    const retried = await updateAnswer();
    if (retried.error) throw retried.error;
    if (retried.data) return retried.data;
  }
  throw inserted.error;
}

export async function submitAssessmentAttempt(userId: string, attemptId: string): Promise<AssessmentAttempt> {
  const existing = await getAssessmentAttempt(userId, attemptId);
  if (!existing) throw new Error('Assessment attempt not found.');
  if (existing.completed_at) {
    await recordEngagementActivity('assessment_completed', attemptId);
    return existing;
  } // Retry after a lost response.
  const [{ data: questions, error: questionError }, { data: answers, error: answerError }] = await Promise.all([
    supabase.from('assessment_questions').select('id').eq('assessment_id', existing.assessment_id),
    supabase.from('assessment_answers').select('question_id').eq('attempt_id', attemptId),
  ]);
  if (questionError) throw questionError;
  if (answerError) throw answerError;
  const ids = new Set((answers || []).map(answer => answer.question_id));
  if (!questions?.length || ids.size !== questions.length || !questions.every(question => ids.has(question.id))) {
    throw new Error('Save an answer to every assessment question before submitting.');
  }
  const update: TablesUpdate<'assessment_attempts'> = {
    completed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('assessment_attempts')
    .update(update)
    .eq('id', attemptId)
    .eq('user_id', userId)
    .is('completed_at', null)
    .select('*')
    .maybeSingle();

  if (error?.code === '42501') {
    throw new Error('Assessment submission is coming soon. Your saved answers are still available.');
  }
  if (error) throw error;
  if (!data) {
    const submitted = await getAssessmentAttempt(userId, attemptId);
    if (submitted?.completed_at) {
      await recordEngagementActivity('assessment_completed', attemptId);
      return submitted;
    }
    throw new Error('Submission was not saved. Please retry.');
  }
  return data;
}

export async function getAssessmentAttempt(userId: string, attemptId: string): Promise<AssessmentAttempt | null> {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAssessmentResults(userId: string, attemptId: string): Promise<AssessmentResult | null> {
  const attempt = await getAssessmentAttempt(userId, attemptId);
  if (!attempt) return null;

  const [{ data: answers, error: answersError }, { count: questionCount, error: questionsError }] = await Promise.all([
    supabase.from('assessment_answers').select('id, attempt_id, question_id, selected_option_id, answered_at').eq('attempt_id', attemptId),
    supabase.from('assessment_questions').select('*', { count: 'exact', head: true }).eq('assessment_id', attempt.assessment_id),
  ]);

  if (answersError) throw answersError;
  if (questionsError) throw questionsError;

  return {
    attempt,
    answers: answers || [],
    questionCount: questionCount || 0,
  };
}
