import type { Tables } from '@/types/database.types';

import { supabase } from '@/lib/supabase';
import { recordEngagementActivity } from '@/services/engagement';

export type LessonProgress = Tables<'lesson_progress'>;
export type ModuleProgress = Tables<'module_progress'>;

export async function getUserLessonProgress(userId: string): Promise<LessonProgress[]> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}

export async function getLessonProgress(userId: string, lessonId: string): Promise<LessonProgress | null> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function completeLesson(userId: string, lessonId: string): Promise<LessonProgress> {
  const existing = await getLessonProgress(userId, lessonId);
  if (existing?.is_completed) {
    await recordEngagementActivity('lesson_completed', lessonId);
    return existing;
  }
  const { data, error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      is_completed: true,
      completed_at: existing?.completed_at ?? new Date().toISOString(),
    }, { onConflict: 'user_id,lesson_id' })
    .select('*')
    .single();
  if (error?.code === '42501') {
    throw new Error('Lesson completion is coming soon for this lesson. You can still review its content.');
  }
  if (error) throw error;
  await recordEngagementActivity('lesson_completed', lessonId);
  return data;
}

export async function getUserModuleProgress(userId: string): Promise<ModuleProgress[]> {
  const { data, error } = await supabase
    .from('module_progress')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return data || [];
}

export async function getModuleProgress(userId: string, moduleId: string): Promise<ModuleProgress | null> {
  const { data, error } = await supabase
    .from('module_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
