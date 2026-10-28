import type { Tables } from '@/types/database.types';

import { supabase } from '@/lib/supabase';

export type Lesson = Tables<'lessons'>;

export async function getPublishedLessons(moduleId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getLessonById(lessonId: string): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}
