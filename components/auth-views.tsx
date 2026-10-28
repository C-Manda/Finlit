import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, Header, PasswordField, PrimaryButton, Screen, ToneCard } from '@/components/finlit-ui';
import { commonStyles, palette, radii, spacing } from '@/constants/finlit-theme';
import { useAuth } from '@/contexts/auth-context';
import { describeSupabaseError } from '@/lib/supabase-diagnostics';
import { validEmail, validateNewPassword } from '@/lib/password-recovery';

export function LoginView() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const submit = async () => {
    if (busy.current) return;
    setError(''); setNotice('');
    if (!validEmail(email)) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    if (creating && !fullName.trim()) { setError('Enter your full name.'); return; }
    busy.current = true; setSubmitting(true);
    try {
      const result = creating ? await signUp(email.trim(), password, fullName.trim()) : await signIn(email.trim(), password);
      if (result.error) { setError(describeSupabaseError(result.error)); return; }
      if (creating && !result.data.session) {
        setNotice('Account created. Check your email to confirm it, then log in.');
        setCreating(false);
        setPassword('');
        return;
      }
      router.replace(creating ? '/diagnostic' : '/dashboard');
    } catch (error) {
      setError(describeSupabaseError(error));
    } finally { busy.current = false; setSubmitting(false); }
  };
  return <Screen><Header title={creating ? 'Create account' : 'Welcome back'} back />
    <Text style={styles.body}>{creating ? 'Start your financial learning journey.' : 'Continue your financial learning journey.'}</Text>
    <View style={styles.form}>
      {creating && <Field label="Full name" value={fullName} onChangeText={setFullName} editable={!submitting} autoComplete="name" textContentType="name" />}
      <Field label="Email address" value={email} onChangeText={setEmail} editable={!submitting} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <PasswordField key={creating ? "new-password" : "current-password"} label="Password" value={password} onChangeText={setPassword} editable={!submitting}
        autoComplete={creating ? 'new-password' : 'current-password'} textContentType={creating ? 'newPassword' : 'password'} returnKeyType="done" onSubmitEditing={() => void submit()} />
      {!creating && <Pressable accessibilityRole="button" disabled={submitting} onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })} style={styles.forgotLink}><Text style={styles.link}>Forgot password?</Text></Pressable>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text>}
      <PrimaryButton title={submitting ? 'Please wait…' : creating ? 'Create account' : 'Log in'} disabled={submitting} onPress={() => void submit()} />
      <Pressable accessibilityRole="button" disabled={submitting} onPress={() => { setCreating(value => !value); setPassword(''); setError(''); setNotice(''); }} style={styles.switchLink}>
        <Text style={styles.center}>{creating ? 'Already have an account? ' : 'New here? '}<Text style={styles.link}>{creating ? 'Log in' : 'Create account'}</Text></Text>
      </Pressable>
    </View>
  </Screen>;
}

export function ForgotPasswordView() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const sendLink = async () => {
    if (busy.current || cooldown > 0) return;
    setError('');
    if (!validEmail(email)) { setError('Enter a valid email address.'); return; }
    busy.current = true; setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true); setCooldown(60);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'We could not send the reset link. Please try again.');
    } finally { busy.current = false; setSubmitting(false); }
  };
  return <Screen><Header title="Reset password" />
    <View style={styles.heroIcon}><Ionicons name={sent ? 'mail-open-outline' : 'lock-closed-outline'} size={30} color={palette.purple} /></View>
    <Text accessibilityRole="header" style={commonStyles.title}>{sent ? 'Check your inbox' : 'Forgot your password?'}</Text>
    {sent ? <View style={styles.form}>
      <Text style={styles.body}>If an account uses {email.trim()}, you’ll receive a link to choose a new password. Check your inbox and spam folder.</Text>
      <ToneCard tone="lilac"><Text style={styles.body}>Open the latest reset email and follow the link to choose your new password.</Text></ToneCard>
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <PrimaryButton title={submitting ? 'Sending…' : cooldown > 0 ? 'Send again in ' + cooldown + 's' : 'Send another link'} disabled={submitting || cooldown > 0} onPress={() => void sendLink()} />
      <PrimaryButton title="Use a different email" tone="outline" disabled={submitting} onPress={() => { setSent(false); setError(''); }} />
    </View> : <View style={styles.form}>
      <Text style={styles.body}>Enter the email you use for Finlit. We’ll send you a link to choose a new password.</Text>
      <Field label="Email address" value={email} onChangeText={setEmail} editable={!submitting} autoCapitalize="none" autoCorrect={false}
        keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={() => void sendLink()} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <PrimaryButton title={submitting ? 'Sending…' : cooldown > 0 ? 'Send again in ' + cooldown + 's' : 'Send reset link'} disabled={submitting || cooldown > 0} onPress={() => void sendLink()} />
    </View>}
    <PrimaryButton title="Back to log in" tone="outline" disabled={submitting} onPress={() => router.replace('/login')} />
  </Screen>;
}

export function ResetPasswordView() {
  const router = useRouter();
  const { session, recoveryStatus, recoveryError, updatePassword, clearPasswordRecovery, retryPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const save = async () => {
    if (busy.current || recoveryStatus !== 'ready') return;
    const validation = validateNewPassword(password, confirmation);
    if (validation) { setError(validation); return; }
    busy.current = true; setSubmitting(true); setError('');
    try { await updatePassword(password); setPassword(''); setConfirmation(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'We could not update your password. Please try again.'); }
    finally { busy.current = false; setSubmitting(false); }
  };
  const requestNewLink = () => { clearPasswordRecovery(); router.replace('/forgot-password'); };
  const leave = () => { clearPasswordRecovery(); router.replace(session ? '/dashboard' : '/login'); };
  return <Screen><Header title="Reset password" />
    {recoveryStatus === 'checking' ? <View style={styles.state}>
      <ActivityIndicator color={palette.purple} accessibilityLabel="Checking your reset link" />
      <Text style={styles.body}>Checking your reset link…</Text>
    </View> : recoveryStatus === 'ready' ? <>
      <View style={styles.heroIcon}><Ionicons name="key-outline" size={30} color={palette.purple} /></View>
      <Text accessibilityRole="header" style={commonStyles.title}>Choose a new password</Text>
      <View style={styles.form}><Text style={styles.body}>Use at least 8 characters. A mix of letters, numbers and symbols makes your password stronger.</Text>
        <PasswordField label="New password" value={password} onChangeText={setPassword} editable={!submitting} autoComplete="new-password" textContentType="newPassword" />
        <PasswordField label="Confirm password" value={confirmation} onChangeText={setConfirmation} editable={!submitting} autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={() => void save()} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <PrimaryButton title={submitting ? 'Updating…' : 'Save new password'} disabled={submitting} onPress={() => void save()} />
      </View>
    </> : recoveryStatus === 'complete' ? <>
      <View style={styles.heroIcon}><Ionicons name="checkmark-circle-outline" size={34} color={palette.purple} /></View>
      <Text accessibilityRole="header" style={commonStyles.title}>Password updated</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.body, styles.paragraph]}>Your new password is ready to use the next time you log in.</Text>
      <PrimaryButton title="Continue to Finlit" onPress={leave} />
    </> : <>
      <View style={styles.heroIcon}><Ionicons name="time-outline" size={32} color={palette.purple} /></View>
      <Text accessibilityRole="header" style={commonStyles.title}>Let’s get you a new link</Text>
      <Text accessibilityRole={recoveryStatus === 'error' ? 'alert' : undefined} style={[styles.body, styles.paragraph]}>{recoveryError || 'Open the password reset link from your email to choose a new password. If the link has expired, request another one.'}</Text>
      {recoveryStatus === 'error' && recoveryError.includes('connection') && <PrimaryButton title="Try again" onPress={retryPasswordRecovery} />}
      <PrimaryButton title="Request a new link" onPress={requestNewLink} />
      <PrimaryButton title={session ? 'Return to Finlit' : 'Back to log in'} tone="outline" onPress={leave} />
    </>}
  </Screen>;
}
const styles = StyleSheet.create({
  form: { marginTop: spacing.lg, gap: spacing.sm }, body: { color: palette.muted, fontSize: 15, lineHeight: 23 },
  heroIcon: { width: 68, height: 68, borderRadius: radii.lg, backgroundColor: palette.lilac, justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 24 },
  forgotLink: { minHeight: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: 4 },
  switchLink: { minHeight: 48, justifyContent: 'center' }, center: { textAlign: 'center', color: palette.muted, fontSize: 14, lineHeight: 22 },
  link: { color: palette.purple, fontSize: 14, lineHeight: 22, fontWeight: '600' }, error: { color: '#8c3026', fontSize: 14, lineHeight: 21 },
  paragraph: { marginTop: 16, marginBottom: 18 }, state: { marginTop: 70, alignItems: 'center', gap: 18 },
});
