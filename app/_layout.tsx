import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthGate } from '@/components/auth-gate';
import { AuthProvider } from '@/contexts/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#faf9f8' } }} />
      </AuthGate>
      <StatusBar style="dark" />
    </AuthProvider>
  );
}
