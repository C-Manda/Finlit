export type RecoveryLink =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'token-hash'; tokenHash: string }
  | { kind: 'code'; code: string }
  | { kind: 'invalid' };

export type RecoveryStatus = 'idle' | 'checking' | 'ready' | 'complete' | 'error';
export const INVALID_RECOVERY_LINK = 'This password reset link has expired or is no longer valid. Request a new link to continue.';

export function validEmail(email: string) {
  return email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < 8 || password.trim().length === 0) return 'Use at least 8 characters for your new password.';
  if (password !== confirmation) return 'Your passwords do not match.';
  return null;
}
export function parseRecoveryLink(raw: string, expectedRedirect: string): RecoveryLink | null {
  try {
    const url = new URL(raw);
    const expected = new URL(expectedRedirect);
    const path = (value: string) => value.replace(/\/+$/, '');
    if (!['http:', 'https:', 'finlitmobile:', 'exp:', 'exps:'].includes(url.protocol) ||
        url.protocol !== expected.protocol || url.host !== expected.host ||
        path(url.pathname) !== path(expected.pathname) || url.username || url.password) return null;
    const params = new URLSearchParams(url.search);
    const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
    const keys = ['type', 'access_token', 'refresh_token', 'token_hash', 'code', 'error', 'error_code', 'error_description'];
    for (const key of keys) {
      if (params.getAll(key).length > 1 || fragment.getAll(key).length > 1 ||
          (params.has(key) && fragment.has(key) && params.get(key) !== fragment.get(key))) return { kind: 'invalid' };
      if (fragment.has(key)) params.set(key, fragment.get(key)!);
    }
    if (!keys.some(key => params.has(key))) return null;
    if (params.has('error') || params.has('error_code') || params.has('error_description')) return { kind: 'invalid' };
    const type = params.get('type');
    const accessToken = params.get('access_token'), refreshToken = params.get('refresh_token');
    const tokenHash = params.get('token_hash'), code = params.get('code');
    if (code && !accessToken && !refreshToken && !tokenHash && (!type || type === 'recovery')) return { kind: 'code', code };
    if (type !== 'recovery') return { kind: 'invalid' };
    if (accessToken && refreshToken && !tokenHash && !code) return { kind: 'tokens', accessToken, refreshToken };
    if (tokenHash && !accessToken && !refreshToken && !code) return { kind: 'token-hash', tokenHash };
    return { kind: 'invalid' };
  } catch {
    return null;
  }
}

export function authDestination(route: string, hasSession: boolean, recovery: RecoveryStatus): '/reset-password' | '/' | '/dashboard' | null {
  if (recovery !== 'idle' && route !== 'reset-password') return '/reset-password';
  if (route === 'forgot-password' || route === 'reset-password') return null;
  const publicRoute = route === 'index' || route === 'login';
  if (!hasSession && !publicRoute) return '/';
  if (hasSession && publicRoute) return '/dashboard';
  return null;
}
