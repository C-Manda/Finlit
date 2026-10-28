import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types';

import { supabase } from '@/lib/supabase';

export type Profile = Tables<'profiles'>;

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProfile(userId: string, values: Pick<TablesInsert<'profiles'>, 'full_name' | 'institution'> = {}) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, ...values })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, values: Pick<TablesUpdate<'profiles'>, 'full_name' | 'institution'>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
