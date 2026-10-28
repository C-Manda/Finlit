import { useEffect, useState } from 'react';

import {
  getAssessmentQuestionOptions,
  getAssessmentQuestions,
  getAvailableAssessment,
  type Assessment,
  type AssessmentOption,
  type AssessmentQuestion,
} from '@/services/assessments';

export function useAvailableAssessment() {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    getAvailableAssessment()
      .then((data) => {
        if (active) setAssessment(data);
      })
      .catch((nextError: Error) => {
        if (active) setError(nextError);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { assessment, isLoading, error };
}

export function useAssessmentQuestions(assessmentId: string | null) {
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [optionsByQuestion, setOptionsByQuestion] = useState<Record<string, AssessmentOption[]>>({});
  const [isLoading, setIsLoading] = useState(Boolean(assessmentId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!assessmentId) {
      setQuestions([]);
      setOptionsByQuestion({});
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getAssessmentQuestions(assessmentId)
      .then(async (nextQuestions) => {
        const nextOptions = await getAssessmentQuestionOptions(nextQuestions.map((question) => question.id));
        if (active) {
          setQuestions(nextQuestions);
          setOptionsByQuestion(nextOptions);
        }
      })
      .catch((nextError: Error) => {
        if (active) setError(nextError);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [assessmentId]);

  return { questions, optionsByQuestion, isLoading, error };
}
