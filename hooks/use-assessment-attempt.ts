import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAssessmentAttempt, getAssessmentResults, saveAssessmentAnswer, submitAssessmentAttempt,
  type AssessmentAttempt, type AssessmentResult,
} from '@/services/assessment-attempts';

export function useAssessmentAttempt(userId: string | null, assessmentId: string | null) {
  const scope = JSON.stringify([userId, assessmentId]);
  const [state, setState] = useState<{
    scope: string; attempt: AssessmentAttempt | null; answers: Record<string, string>;
    result: AssessmentResult | null; loading: boolean; error: Error | null;
  }>({ scope, attempt: null, answers: {}, result: null, loading: true, error: null });
  const [operation, setOperation] = useState<'save' | 'submit' | null>(null);
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const busy = useRef<number | null>(null);
  useEffect(() => {
    const token = ++generation.current;
    setOperation(null);
    busy.current = null;
    setState({ scope, attempt: null, answers: {}, result: null, loading: true, error: null });
    if (!userId || !assessmentId) {
      setState({ scope, attempt: null, answers: {}, result: null, loading: false, error: new Error('Sign in and open a valid assessment.') });
      return;
    }
    (async () => {
      const attempt = await createAssessmentAttempt(userId, assessmentId);
      const result = await getAssessmentResults(userId, attempt.id);
      if (!result) throw new Error('Unable to restore this assessment.');
      const answers = Object.fromEntries(result.answers.map(answer => [answer.question_id, answer.selected_option_id]));
      if (generation.current === token) setState({ scope, attempt, answers, result: null, loading: false, error: null });
    })().catch(error => {
      if (generation.current === token) setState(current => ({ ...current, loading: false, error: error instanceof Error ? error : new Error('Unable to start assessment.') }));
    });
    return () => { generation.current = token + 1; };
  }, [userId, assessmentId, scope, reload]);

  const saveAnswer = useCallback(async (questionId: string, selectedOptionId: string) => {
    const token = generation.current;
    if (!userId || state.scope !== scope || !state.attempt || state.loading || busy.current === token) return;
    busy.current = token;
    setOperation('save');
    setState(current => ({ ...current, error: null }));
    try {
      const answer = await saveAssessmentAnswer(userId, { attempt_id: state.attempt.id, question_id: questionId, selected_option_id: selectedOptionId });
      if (generation.current === token) setState(current => ({ ...current, answers: { ...current.answers, [questionId]: answer.selected_option_id } }));
    } catch (error) {
      if (generation.current === token) setState(current => ({ ...current, error: error instanceof Error ? error : new Error('Unable to save answer.') }));
    } finally {
      if (generation.current === token) { busy.current = null; setOperation(null); }
    }
  }, [scope, state, userId]);

  const submit = useCallback(async () => {
    const token = generation.current;
    if (!userId || state.scope !== scope || !state.attempt || state.loading || busy.current === token) return null;
    busy.current = token;
    setOperation('submit');
    setState(current => ({ ...current, error: null }));
    try {
      const attempt = await submitAssessmentAttempt(userId, state.attempt.id);
      const result = await getAssessmentResults(userId, attempt.id);
      if (!result) throw new Error('Unable to retrieve the submitted result. Retry submission.');
      if (generation.current !== token) return null;
      setState(current => ({ ...current, attempt, result }));
      return result;
    } catch (error) {
      if (generation.current === token) setState(current => ({ ...current, error: error instanceof Error ? error : new Error('Unable to submit assessment.') }));
      return null;
    } finally {
      if (generation.current === token) { busy.current = null; setOperation(null); }
    }
  }, [scope, state, userId]);
  const visible = state.scope === scope;
  return {
    attempt: visible ? state.attempt : null, answers: visible ? state.answers : {},
    result: visible ? state.result : null, isStarting: !visible || state.loading,
    isSaving: operation === 'save', isSubmitting: operation === 'submit',
    error: visible ? state.error : null, retry: () => setReload(value => value + 1), saveAnswer, submit,
  };
}
