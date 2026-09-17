import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, H1, P, Button } from '../../src/ui';
import { theme } from '../../src/theme';

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <Text style={{ color: theme.peach, fontSize: 13, letterSpacing: 2, marginBottom: 12 }}>
        SNICKYLINK
      </Text>
      <H1>More than a chat.</H1>
      <P>
        Har din paanch chhote Snicks. Do ghante ka window. Saath karo, confirm karo, aur
        apni jodi ki kahani banao.
      </P>
      <View style={{ height: 24 }} />
      <Button title="Get started" onPress={() => router.push('/(auth)/login')} />
      <Button
        title="Server settings"
        variant="ghost"
        onPress={() => router.push('/(auth)/server-settings')}
      />
    </Screen>
  );
}
