import type { KnowledgeJourney, KnowledgeProfile } from '@/content/knowledge';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/database.types';
import type { LessonContent, LessonRecord } from '@/content/learning';

export type LearningSnapshot = {
  journey?: KnowledgeJourney;
  lessons: Record<string, LessonRecord>;
  modules: { key: string; completed: boolean; score: number | null; status: string }[];
  diagnostic: { id: string; score: number; scores: Record<string, { correct: number; total: number }> } | null;
};
export const blankSnapshot = (): LearningSnapshot => ({ lessons: {}, modules: [], diagnostic: null });
export async function learningApi<T>(action: string, payload: object = {}): Promise<T> {
  const { data, error } = await supabase.rpc('finlit_api', { p_action: action, p_payload: payload as Json });
  if (error) {
    if (error.code === '40001' || error.code === 'P0001') throw new Error(error.message);
    if (error.code === '42501' && ['budget','save_budget','entry','update_entry','delete_entry','consent','create_location','adjust_location','delete_location'].includes(action)) throw new Error('This financial record is unavailable or your session has expired. Reload your budget or sign in again.');
    if (error.code === '42501') throw new Error('This content is locked or your session has expired. Return to your learning path or sign in again.');
    throw new Error('We could not connect to your account data. Check your connection and try again.');
  }
  return data as T;
}
export const loadLearning = () => learningApi<LearningSnapshot>('snapshot');
export const loadLesson = (key: string) => learningApi<LessonContent>('lesson', { key });
export const saveLesson = (key: string, record: LessonRecord, expected: LessonRecord) => learningApi<LessonRecord>('save_lesson', { key, record, expected });

export type Attempt = { id: string; assessment_id: string; user_id: string; score: number | null; passed: boolean | null; completed_at: string | null; started_at: string; revision: number; topic_scores: Record<string, { correct: number; total: number }> };
export type Challenge = {
  assessment: { id: string; title: string; content_key: string; assessment_type: string };
  completedAttempt?: string; activeAttempt?: string | null; baseline?: KnowledgeProfile | null; legacy?: boolean;
  attempt: Attempt | null; answers: Record<string, string>; history: Attempt[];
  questions: { id: string; prompt: string; topic: string; options: { id: string; text: string }[] }[];
};
export type ChallengeResult = { analysis?: KnowledgeProfile; journey?: KnowledgeJourney; assessment: Challenge['assessment']; attempt: Attempt; feedback: { id: string; prompt: string; selected: string; correct: boolean; explanation: string; topic: string }[] };
