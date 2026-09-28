import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppTick } from '@/components/app-tick';
import { BricBar, UpdateBanner } from '@/components/bric-bar';
import { LockGate } from '@/components/lock-gate';
import { Tour } from '@/components/tour';
import { useStore } from '@/lib/store';
import { color } from '@/theme/tokens';

/** Sends first-time users to setup, once the persisted store has rehydrated. */
function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.settings.onboarded);

  // useSegments() returns a fresh array every render, so depend on the part
  // that actually matters rather than the array itself.
  const atOnboarding = segments[0] === 'onboarding';

  useEffect(() => {
    if (!hydrated || onboarded || atOnboarding) return;
    router.replace('/onboarding');
  }, [hydrated, onboarded, atOnboarding, router]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: color.bg }}>
          <StatusBar style="light" />
          <OnboardingGate />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: color.bg },
              animation: 'fade',
            }}>
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            {/* Subsystems slide in from the mainframe and back out to it. */}
            <Stack.Screen name="bank" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="desk" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'none' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="statement" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="sync" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen
              name="add"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="bric"
              options={{ presentation: 'modal', animation: 'fade_from_bottom' }}
            />
            <Stack.Screen
              name="task"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack>
          <AppTick />
          <BricBar />
          <UpdateBanner />
          <Tour />
          <LockGate />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
