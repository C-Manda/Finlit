import type { Tables } from '@/types/database.types';

import { supabase } from '@/lib/supabase';

export type Module = Tables<'modules'>;

export async function getPublishedModules(): Promise<Module[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getModuleById(moduleId: string): Promise<Module | null> {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .eq('id', moduleId)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}
