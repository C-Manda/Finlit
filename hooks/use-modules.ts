import { useEffect, useState } from 'react';

import type { Module } from '@/services/modules';
import { getPublishedModules, getModuleById } from '@/services/modules';

export function useModules() {
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    getPublishedModules()
      .then((data) => {
        if (active) {
          setModules(data);
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
  }, []);

  return { modules, isLoading, error };
}

export function useModule(moduleId: string | null) {
  const [module, setModule] = useState<Module | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(moduleId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!moduleId) {
      setModule(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getModuleById(moduleId)
      .then((data) => {
        if (active) setModule(data);
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

  return { module, isLoading, error };
}
