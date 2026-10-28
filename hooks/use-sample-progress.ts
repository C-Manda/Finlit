import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { authoredLessons, emptyProgress, newLessonRecord, type LessonRecord } from '@/content/learning';
import { loadSampleProgress, saveSampleProgress } from '@/services/sample-progress';

export function useSampleProgress() {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState({ owner: userId, progress: emptyProgress(), loading: true, error: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const failed = useRef<{ id: string; record: LessonRecord; expected: LessonRecord } | null>(null);
  const busy = useRef(false), generation = useRef(0);
  const [reload, setReload] = useState(0);
  const owner = useRef(userId);
  owner.current = userId;
  const requestKey = JSON.stringify([userId, reload]);
  const activeRequest = useRef(requestKey);
  activeRequest.current = requestKey;
  useFocusEffect(useCallback(() => {
    const token = ++generation.current;
    if (activeRequest.current !== requestKey) return;
    failed.current = null;
    setSaveError('');
    setState({ owner: userId, progress: emptyProgress(), loading: true, error: '' });
    if (!userId) {
      setState({ owner: userId, progress: emptyProgress(), loading: false, error: 'Sign in to save your lesson progress.' });
      return;
    }
    loadSampleProgress(userId).then(progress => {
      if (token === generation.current && owner.current === userId) setState({ owner: userId, progress, loading: false, error: '' });
    }).catch(() => {
      if (token === generation.current && owner.current === userId) setState({ owner: userId, progress: emptyProgress(), loading: false, error: 'We couldn’t load your saved progress. Please try again.' });
    });
    return () => { generation.current++; };
  }, [userId, requestKey]));
  const persist = async (id: string, record: LessonRecord, expected: LessonRecord) => {
    if (!userId || busy.current || state.owner !== userId || state.loading || state.error) return false;
    busy.current = true;
    setSaving(true);
    const token = generation.current;
    try {
      const progress = await saveSampleProgress(userId, id, record, expected);
      if (token !== generation.current || owner.current !== userId) return false;
      failed.current = null;
      setSaveError('');
      setState({ owner: userId, progress, loading: false, error: '' });
      return true;
    } catch (error) {
      if (token === generation.current && owner.current === userId) {
        failed.current = { id, record, expected };
        setSaveError(error instanceof Error && error.message.includes('another view') ? error.message : 'Progress was not saved. Your answer is still here. Please try saving again.');
      }
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const save = (id: string, record: LessonRecord) => {
    const lesson = authoredLessons.find(item => item.id === id);
    if (!lesson || failed.current) return Promise.resolve(false);
    return persist(id, record, state.progress.lessons[id] ?? newLessonRecord(lesson.version));
  };
  const retrySave = () => {
    const last = failed.current;
    return last ? persist(last.id, last.record, last.expected) : Promise.resolve(false);
  };
  return { progress: state.owner === userId ? state.progress : emptyProgress(), loading: state.loading || state.owner !== userId,
    error: state.error, saving, saveError, save, retrySave, retry: () => setReload(value => value + 1) };
}
