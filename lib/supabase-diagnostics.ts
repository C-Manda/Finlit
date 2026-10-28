export function describeSupabaseError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  const normalized = message.toLowerCase();
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const status = typeof error === 'object' && error !== null && 'status' in error ? String(error.status) : '';

  if (normalized.includes('missing supabase environment')) return 'FinLit is unavailable right now. Please try again later.';
  if (normalized.includes('failed to fetch') || normalized.includes('network request failed') || normalized.includes('dns')) return 'We could not connect. Check your internet connection and try again.';
  if (normalized.includes('invalid login credentials')) return 'The email or password is incorrect.';
  if (normalized.includes('email not confirmed')) return 'Confirm your email address before logging in.';
  if (status === '401' || code === '401') return 'Please log in again to continue.';
  if (status === '403' || code === '403' || code === '42501' || normalized.includes('row-level security') || normalized.includes('permission denied')) return 'This action is unavailable right now. Please try again later.';
  if (code.startsWith('PGRST')) return 'We could not load this information. Please try again.';
  if (normalized.startsWith('lesson completion is coming soon.') || normalized.startsWith('assessment submission is coming soon.') || normalized.startsWith('this assessment has already been submitted.') || normalized.startsWith('save an answer to every assessment question') || normalized.startsWith('submission was not saved.')) return message;
  return fallback;
}
