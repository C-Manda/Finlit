import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { INVALID_RECOVERY_LINK, parseRecoveryLink, validEmail, validateNewPassword } from '@/lib/password-recovery';

export const passwordResetRedirect = () => Linking.createURL('reset-password');
function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
}
export function recoveryErrorMessage(error: unknown, fallback: string) {
  const code = errorCode(error);
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('network') || message.includes('fetch') || message.includes('offline')) return 'Check your connection and try again.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Please wait a minute before requesting another link.';
  if (code === 'same_password') return 'Choose a password you have not used for this account before.';
  if (code === 'weak_password') return 'Choose a stronger password with a mix of letters, numbers and symbols.';
  return fallback;
}
export async function requestPasswordReset(email: string): Promise<void> {
  if (!validEmail(email)) throw new Error('Enter a valid email address.');
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: passwordResetRedirect() });
    if (error && errorCode(error) !== 'user_not_found') throw error;
  } catch (error) {
    throw new Error(recoveryErrorMessage(error, 'We could not send the reset link. Please try again.'));
  }
}
let lastLink: string | null = null;
let lastResult: Promise<Session> | null = null;
let pending: Promise<unknown> = Promise.resolve();
let generation = 0;
let operations = 0;
export const recoveryWorkInProgress = () => operations > 0;
export function establishRecoverySession(url: string): Promise<Session> {
  if (lastLink === url && lastResult) return lastResult;
  const link = parseRecoveryLink(url, passwordResetRedirect());
  if (!link || link.kind === 'invalid') return Promise.reject(new Error(INVALID_RECOVERY_LINK));
  lastLink = url;
  const requestGeneration = generation;
  operations++;
  // Serialize different links too: an older SDK exchange cannot overwrite a newer session.
  const task = pending.catch(() => undefined).then(async () => {
    if (requestGeneration !== generation) throw new Error(INVALID_RECOVERY_LINK);
    let session: Session;
    if (link.kind === 'tokens') {
      const { data, error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
      if (error || !data.session) throw error ?? new Error(INVALID_RECOVERY_LINK);
      session = data.session;
    } else if (link.kind === 'token-hash') {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: 'recovery' });
      if (error || !data.session) throw error ?? new Error(INVALID_RECOVERY_LINK);
      session = data.session;
    } else {
      const previous = await supabase.auth.getSession();
      const { data, error } = await supabase.auth.exchangeCodeForSession(link.code);
      if (error || !data.session) throw error ?? new Error(INVALID_RECOVERY_LINK);
      if (!('redirectType' in data) || data.redirectType !== 'recovery') {
        if (previous.data.session && requestGeneration === generation) await supabase.auth.setSession(previous.data.session);
        else await supabase.auth.signOut({ scope: 'local' });
        throw new Error(INVALID_RECOVERY_LINK);
      }
      session = data.session;
    }
    if (requestGeneration !== generation) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new Error(INVALID_RECOVERY_LINK);
    }
    return session;
  }).catch(error => {
    if (lastResult === task) { lastLink = null; lastResult = null; }
    throw new Error(recoveryErrorMessage(error, INVALID_RECOVERY_LINK));
  }).finally(() => { operations--; });
  pending = task;
  lastResult = task;
  return task;
}
export function clearRecoverySessionCache() { generation++; lastLink = null; lastResult = null; }
export function updateRecoveredPassword(password: string): Promise<void> {
  const validation = validateNewPassword(password, password);
  if (validation) return Promise.reject(new Error(validation));
  const requestGeneration = generation;
  const task = pending.catch(() => undefined).then(async () => {
    if (requestGeneration !== generation) throw new Error(INVALID_RECOVERY_LINK);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }).catch(error => {
    throw new Error(recoveryErrorMessage(error, 'We could not update your password. Please try again.'));
  });
  pending = task;
  return task;
}