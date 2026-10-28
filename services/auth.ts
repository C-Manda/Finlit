import type {
  AuthChangeEvent,
  AuthResponse,
  AuthTokenResponsePassword,
  Session,
  SignUpWithPasswordCredentials,
} from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export function signUp(credentials: SignUpWithPasswordCredentials): Promise<AuthResponse> {
  return supabase.auth.signUp(credentials);
}

export function signIn(email: string, password: string): Promise<AuthTokenResponsePassword> {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signOut() {
  return supabase.auth.signOut();
}

export function getSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(callback);
}