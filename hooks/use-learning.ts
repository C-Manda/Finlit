import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { newLessonRecord, type LessonContent, type LessonRecord } from '@/content/learning';
import { blankSnapshot, loadLearning, saveLesson } from '@/services/learning';

export function useLearning() {
  const { user } = useAuth(); const userId = user?.id;
  const [state, setState] = useState({ owner: userId, progress: blankSnapshot(), loading: true, error: '' });
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [reload, setReload] = useState(0);
  const failed = useRef<{ lesson: LessonContent; record: LessonRecord; expected: LessonRecord } | null>(null);
  const requestId = JSON.stringify([userId, reload]);
  const activeRequest = useRef(requestId); activeRequest.current = requestId;
  const busy = useRef(false), generation = useRef(0), owner = useRef(userId); owner.current = userId;
  useFocusEffect(useCallback(() => {
    if (activeRequest.current !== requestId) return;
    const token = ++generation.current; failed.current = null; setSaveError('');
    setState({ owner: userId, progress: blankSnapshot(), loading: true, error: '' });
    if (!userId) { setState({ owner: userId, progress: blankSnapshot(), loading: false, error: 'Sign in to load your learning record.' }); return; }
    loadLearning().then(progress => { if (token === generation.current && owner.current === userId) setState({ owner: userId, progress, loading: false, error: '' }); })
      .catch(() => { if (token === generation.current && owner.current === userId) setState({ owner: userId, progress: blankSnapshot(), loading: false, error: 'We could not load your account progress. Check your connection and retry.' }); });
    return () => { generation.current++; };
  }, [userId, requestId]));
  const persist = async (lesson: LessonContent, record: LessonRecord, expected: LessonRecord) => {
    if (!userId || busy.current || state.owner !== userId || state.loading || state.error) return false;
    busy.current = true; setSaving(true); const token = generation.current;
    try {
      const saved = await saveLesson(lesson.id, record, expected);
      if (token !== generation.current || owner.current !== userId) return false;
      failed.current = null; setSaveError('');
      setState(current => ({ ...current, progress: { ...current.progress, lessons: { ...current.progress.lessons, [lesson.id]: saved } } })); return true;
    } catch (error) {
      if (token === generation.current && owner.current === userId) { failed.current = { lesson, record, expected }; setSaveError(error instanceof Error && error.message.includes('another view') ? error.message : 'Progress was not saved. Your answer is still here. Please retry before leaving.'); }
      return false;
    } finally { busy.current = false; setSaving(false); }
  };
  const save = (lesson: LessonContent, record: LessonRecord) => failed.current ? Promise.resolve(false) : persist(lesson, record, state.progress.lessons[lesson.id] ?? newLessonRecord(lesson.version));
  return { progress: state.owner === userId ? state.progress : blankSnapshot(), loading: state.loading || state.owner !== userId, error: state.error, saving, saveError, save,
    retrySave: () => { const last = failed.current; return last ? persist(last.lesson,last.record,last.expected) : Promise.resolve(false); }, retry: () => setReload(n => n+1) };
}
