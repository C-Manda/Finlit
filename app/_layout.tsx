import { SmsLifecycle } from '@/components/sms-lifecycle';
import { usePalette } from '@/constants/finlit-theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthGate } from '@/components/auth-gate';
import { AuthProvider } from '@/contexts/auth-context';

export default function RootLayout() {
  const palette = usePalette();
  return (
    <AuthProvider>
      <SmsLifecycle />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.canvas } }} />
      </AuthGate>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
