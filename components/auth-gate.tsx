import { Redirect, useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { authDestination } from '@/lib/password-recovery';

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, session, recoveryStatus } = useAuth();
  const segments = useSegments();
  const route = segments[0] ?? 'index';
  if (isLoading) return null;
  const destination = authDestination(route, !!session, recoveryStatus);
  return destination ? <Redirect href={destination} /> : children;
}
