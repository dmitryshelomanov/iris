import '../global.css';

import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { CaptureSettingsProvider } from '@/features/camera';
import { RecentsProvider } from '@/features/media';
import { OnboardingGate } from '@/features/onboarding';
import { NAV_THEME } from '@/shared/lib/theme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={NAV_THEME.dark}>
        <CaptureSettingsProvider>
          <RecentsProvider>
            <OnboardingGate>
              <StatusBar style="light" />
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="settings"
                  options={{
                    presentation: 'modal',
                    title: 'Settings',
                    headerStyle: { backgroundColor: '#0A0A0A' },
                    headerTintColor: '#fff',
                  }}
                />
                <Stack.Screen
                  name="gallery"
                  options={{
                    presentation: 'modal',
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="permissions"
                  options={{
                    title: 'Permissions',
                    headerStyle: { backgroundColor: '#0A0A0A' },
                    headerTintColor: '#fff',
                  }}
                />
              </Stack>
            </OnboardingGate>
          </RecentsProvider>
        </CaptureSettingsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
