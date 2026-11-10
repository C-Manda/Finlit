import { SmsLifecycle } from '@/components/sms-lifecycle';
import { NotificationLifecycle } from '@/components/notification-lifecycle';
import { usePalette, useThemePreference } from '@/constants/finlit-theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthGate } from '@/components/auth-gate';
import { AuthProvider } from '@/contexts/auth-context';

export default function RootLayout() {
  const palette = usePalette();
  const theme = useThemePreference();
  return (
    <AuthProvider>
      <SmsLifecycle />
      <NotificationLifecycle />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.canvas } }} />
      </AuthGate>
      <StatusBar style={theme === "dark" ? "light" : theme === "light" ? "dark" : "auto"} />
    </AuthProvider>
  );
}
