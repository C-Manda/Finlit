import type { Tables } from '@/types/database.types';

import { supabase } from '@/lib/supabase';

export type Assessment = Tables<'assessments'>;
export type AssessmentQuestion = Tables<'assessment_questions'>;
export type AssessmentOption = Tables<'assessment_options'>;

export async function getAvailableAssessment(): Promise<Assessment | null> {
  const { data, error } = await supabase
    .from('assessments')
    .select('*')
    .eq('is_published', true)
    .eq('assessment_type', 'diagnostic')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAssessmentQuestions(assessmentId: string): Promise<AssessmentQuestion[]> {
  const { data, error } = await supabase
    .from('assessment_questions')
    .select('*')
    .eq('assessment_id', assessmentId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getQuestionOptions(questionId: string): Promise<AssessmentOption[]> {
  const { data, error } = await supabase
    .from('assessment_options')
    .select('*')
    .eq('question_id', questionId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAssessmentQuestionOptions(questionIds: string[]): Promise<Record<string, AssessmentOption[]>> {
  if (questionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('assessment_options')
    .select('*')
    .in('question_id', questionIds)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return (data || []).reduce<Record<string, AssessmentOption[]>>((optionsByQuestion, option) => {
    const options = optionsByQuestion[option.question_id] || [];
    optionsByQuestion[option.question_id] = [...options, option];
    return optionsByQuestion;
  }, {});
}
