import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Screen, H1, P, Field, Button, Err } from '../../src/ui';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { theme } from '../../src/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [isNew, setIsNew] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (fn: () => Promise<any>) => {
    setErr('');
    setLoading(true);
    try { await fn(); } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <Screen>
      <H1>{isNew ? 'Create account' : 'Welcome back'}</H1>
      <P>Do accounts, ek journey.</P>

      <Field
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {mode === 'password' ? (
        <>
          {isNew && <Field value={name} onChangeText={setName} placeholder="Your name" />}
          <Field
            value={password}
            onChangeText={setPassword}
            placeholder="Password (8+ characters)"
            secureTextEntry
          />
          <Button
            title={isNew ? 'Create account' : 'Sign in'}
            loading={loading}
            onPress={() =>
              run(async () => {
                const s = isNew
                  ? await api.register({ email, name, password })
                  : await api.login({ email, password });
                await signIn(s);
              })
            }
          />
          <Pressable onPress={() => setIsNew(!isNew)}>
            <Text style={{ color: theme.peach, textAlign: 'center', marginTop: 18 }}>
              {isNew ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          {!sent ? (
            <Button
              title="Send code"
              loading={loading}
              onPress={() => run(async () => { await api.otpStart(email); setSent(true); })}
            />
          ) : (
            <>
              <Field
                value={code}
                onChangeText={setCode}
                placeholder="6-digit code"
                keyboardType="number-pad"
              />
              <P style={{ marginTop: 8, fontSize: 13 }}>
                Dev mode: code backend console me print hota hai.
              </P>
              <Button
                title="Verify & sign in"
                loading={loading}
                onPress={() =>
                  run(async () => {
                    const s = await api.otpVerify({ email, code, name });
                    await signIn(s);
                  })
                }
              />
            </>
          )}
        </>
      )}

      <Err>{err}</Err>
      <View style={{ flex: 1 }} />
      <Pressable onPress={() => { setMode(mode === 'password' ? 'otp' : 'password'); setSent(false); }}>
        <Text style={{ color: theme.muted, textAlign: 'center' }}>
          {mode === 'password' ? 'Sign in with a code instead' : 'Use a password instead'}
        </Text>
      </Pressable>
    </Screen>
  );
}
