import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#faf9f8' } }} />
      <StatusBar style="dark" />
    </>
  );
}
