import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../src/auth';
import { theme } from '../src/theme';

function Gate({ children }: any) {
  const { ready, user, couple } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/welcome');
    else if (user && couple?.state !== 'ACTIVE') router.replace('/(app)/pairing');
    else if (user && inAuth) router.replace('/(app)/home');
  }, [ready, user, couple, segments]);

  if (!ready)
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.peach} />
      </View>
    );
  return children;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Gate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.peach,
            headerTitleStyle: { color: theme.text },
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="(auth)/welcome" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/login" options={{ title: 'Sign in' }} />
          <Stack.Screen name="(auth)/server-settings" options={{ title: 'Server' }} />
          <Stack.Screen name="(app)/pairing" options={{ title: 'Pair up' }} />
          <Stack.Screen name="(app)/home" options={{ headerShown: false }} />
          <Stack.Screen name="(app)/snick/[id]" options={{ title: 'Snick' }} />
          <Stack.Screen name="(app)/profile" options={{ title: 'Us' }} />
          <Stack.Screen name="(app)/chat" options={{ title: 'Chat' }} />
          <Stack.Screen name="(app)/memories" options={{ title: 'Our moments' }} />
          <Stack.Screen name="(app)/calendar" options={{ title: 'Dates' }} />
          <Stack.Screen name="(app)/community" options={{ title: 'Community' }} />
        </Stack>
      </Gate>
    </AuthProvider>
  );
}
