import type { Session, User } from '@supabase/supabase-js';
import { useCallback, useContext, useEffect, useRef, useState, createContext, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { getSession, onAuthStateChange, signIn, signOut, signUp } from '@/services/auth';
import { clearRecoverySessionCache, establishRecoverySession, passwordResetRedirect, requestPasswordReset, recoveryWorkInProgress, updateRecoveredPassword } from '@/services/password-recovery';
import { INVALID_RECOVERY_LINK, parseRecoveryLink, type RecoveryStatus } from '@/lib/password-recovery';

type AuthContextValue = {
  session: Session | null; user: User | null; isLoading: boolean;
  signIn: (email: string, password: string) => ReturnType<typeof signIn>;
  signUp: (email: string, password: string, fullName?: string) => ReturnType<typeof signUp>;
  signOut: () => ReturnType<typeof signOut>;
  recoveryStatus: RecoveryStatus; recoveryError: string;
  requestPasswordReset: typeof requestPasswordReset;
  updatePassword: (password: string) => Promise<void>;
  clearPasswordRecovery: () => void;
  retryPasswordRecovery: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>('idle');
  const [recoveryError, setRecoveryError] = useState('');
  const recoveryGeneration = useRef(0);
  const lastRecoveryUrl = useRef<string | null>(null);
  const readyGeneration = useRef<number | null>(null);
  const mounted = useRef(false);
  const invalidateRecovery = useCallback(() => { recoveryGeneration.current++; }, []);
  const clearPasswordRecovery = useCallback(() => {
    recoveryGeneration.current++;
    lastRecoveryUrl.current = null;
    readyGeneration.current = null;
    clearRecoverySessionCache();
    setRecoveryStatus('idle');
    setRecoveryError('');
  }, []);
  const handleRecoveryUrl = useCallback((url: string) => {
    const link = parseRecoveryLink(url, passwordResetRedirect());
    if (!link) return;
    readyGeneration.current = null;
    lastRecoveryUrl.current = url;
    const generation = ++recoveryGeneration.current;
    setRecoveryStatus('checking');
    setRecoveryError('');
    const cleanAddress = () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const current = new URL(window.location.href);
        if (parseRecoveryLink(current.href, passwordResetRedirect())) {
          window.history.replaceState(window.history.state, '', current.pathname);
        }
      }
    };
    establishRecoverySession(url).then(nextSession => {
      if (mounted.current && generation === recoveryGeneration.current) {
        setSession(nextSession);
        readyGeneration.current = generation;
        setRecoveryStatus('ready');
        cleanAddress();
      }
    }).catch(error => {
      if (mounted.current && generation === recoveryGeneration.current) {
        setRecoveryStatus('error');
        setRecoveryError(error instanceof Error ? error.message : INVALID_RECOVERY_LINK);
        cleanAddress();
      }
    });
  }, []);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    let authEventSeen = false;
    getSession().then(({ data }) => {
      if (active && !authEventSeen) setSession(data.session);
    }).catch(() => {
      if (active && !authEventSeen) setSession(null);
    }).finally(() => { if (active) setIsLoading(false); });
    const { data: subscription } = onAuthStateChange((event, nextSession) => {
      authEventSeen = true;
      if (!active) return;
      setSession(nextSession);
      setIsLoading(false);
      // Link verification controls readiness; SDK events can arrive from an older queued link.
      if (event === 'SIGNED_OUT' && !recoveryWorkInProgress()) clearPasswordRecovery();
    });
    const links = Linking.addEventListener('url', ({ url }) => handleRecoveryUrl(url));
    // Web Linking emits message events, not hash changes in an already-open tab.
    const browserLink = () => handleRecoveryUrl(window.location.href);
    const listenInBrowser = Platform.OS === 'web' && typeof window !== 'undefined';
    if (listenInBrowser) {
      window.addEventListener('hashchange', browserLink);
      window.addEventListener('popstate', browserLink);
    }
    void Linking.getInitialURL().then(url => { if (active && url) handleRecoveryUrl(url); }).catch(() => undefined);
    return () => {
      active = false;
      mounted.current = false;
      invalidateRecovery();
      subscription.subscription.unsubscribe();
      links.remove();
      if (listenInBrowser) {
        window.removeEventListener('hashchange', browserLink);
        window.removeEventListener('popstate', browserLink);
      }
    };
  }, [clearPasswordRecovery, handleRecoveryUrl, invalidateRecovery]);
  const updatePassword = async (password: string) => {
    if (recoveryStatus !== 'ready' || readyGeneration.current !== recoveryGeneration.current) throw new Error(INVALID_RECOVERY_LINK);
    const generation = recoveryGeneration.current;
    await updateRecoveredPassword(password);
    if (mounted.current && generation === recoveryGeneration.current) {
      clearRecoverySessionCache();
      readyGeneration.current = null;
      lastRecoveryUrl.current = null;
      setRecoveryStatus('complete');
    }
  };
  const value: AuthContextValue = {
    session, user: session?.user ?? null, isLoading,
    signIn, signUp: (email, password, fullName) => signUp({ email, password, options: { data: { full_name: fullName } } }), signOut: () => { clearPasswordRecovery(); return signOut(); },
    recoveryStatus, recoveryError, requestPasswordReset, updatePassword, clearPasswordRecovery,
    retryPasswordRecovery: () => { if (lastRecoveryUrl.current) handleRecoveryUrl(lastRecoveryUrl.current); },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
