import { useEffect, useState } from 'react';

import type { Lesson } from '@/services/lessons';
import { getLessonById, getPublishedLessons } from '@/services/lessons';

export function useLessons(moduleId: string | null) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(moduleId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!moduleId) {
      setLessons([]);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getPublishedLessons(moduleId)
      .then((data) => {
        if (active) {
          setLessons(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [moduleId]);

  return { lessons, isLoading, error };
}

export function useLesson(lessonId: string | null) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(lessonId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!lessonId) {
      setLesson(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getLessonById(lessonId)
      .then((data) => {
        if (active) setLesson(data);
      })
      .catch((err: Error) => {
        if (active) setError(err);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lessonId]);

  return { lesson, isLoading, error };
}
