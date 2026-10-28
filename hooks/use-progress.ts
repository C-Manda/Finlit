import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  completeLesson, getLessonProgress, getModuleProgress, getUserLessonProgress, getUserModuleProgress,
} from '@/services/progress';

function useProgressQuery<T>(key: string, enabled: boolean, load: () => Promise<T>) {
  const [state, setState] = useState<{ key: string; data: T | null; loading: boolean; error: Error | null }>({
    key, data: null, loading: enabled, error: null,
  });
  useFocusEffect(useCallback(() => {
    let active = true;
    setState({ key, data: null, loading: enabled, error: null });
    if (!enabled) return;
    load().then(data => {
      if (active) setState({ key, data, loading: false, error: null });
    }).catch(error => {
      if (active) setState({ key, data: null, loading: false, error: error instanceof Error ? error : new Error('Unable to load progress.') });
    });
    return () => { active = false; };
  }, [enabled, key, load]));
  return {
    data: state.key === key ? state.data : null,
    isLoading: state.key !== key ? enabled : state.loading,
    error: state.key === key ? state.error : null,
  };
}
export function useUserLessonProgress(userId: string | null) {
  const load = useCallback(() => getUserLessonProgress(userId!), [userId]);
  const state = useProgressQuery(JSON.stringify(['lessons', userId]), !!userId, load);
  return { progress: state.data ?? [], isLoading: state.isLoading, error: state.error };
}
export function useLessonProgress(userId: string | null, lessonId: string | null) {
  const load = useCallback(() => getLessonProgress(userId!, lessonId!), [userId, lessonId]);
  const state = useProgressQuery(JSON.stringify(['lesson', userId, lessonId]), !!userId && !!lessonId, load);
  return { lessonProgress: state.data, isLoading: state.isLoading, error: state.error };
}
export function useUserModuleProgress(userId: string | null) {
  const load = useCallback(() => getUserModuleProgress(userId!), [userId]);
  const state = useProgressQuery(JSON.stringify(['modules', userId]), !!userId, load);
  return { progress: state.data ?? [], isLoading: state.isLoading, error: state.error };
}
export function useModuleProgress(userId: string | null, moduleId: string | null) {
  const load = useCallback(() => getModuleProgress(userId!, moduleId!), [userId, moduleId]);
  const state = useProgressQuery(JSON.stringify(['module', userId, moduleId]), !!userId && !!moduleId, load);
  return { moduleProgress: state.data, isLoading: state.isLoading, error: state.error };
}
export function useCompleteLessonMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const busy = useRef(false);
  const mutate = async (userId: string, lessonId: string) => {
    if (busy.current) throw new Error('A lesson save is already in progress.');
    busy.current = true;
    setIsLoading(true);
    setError(null);
    try { return await completeLesson(userId, lessonId); }
    catch (error) {
      const normalized = error instanceof Error ? error : new Error('Unable to save progress.');
      setError(normalized);
      throw normalized;
    } finally { busy.current = false; setIsLoading(false); }
  };
  return { mutate, isLoading, error };
}
