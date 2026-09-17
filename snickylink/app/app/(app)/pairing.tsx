import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Screen, H1, P, Field, Button, Err } from '../../src/ui';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { theme } from '../../src/theme';

export default function Pairing() {
  const { refresh, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [myCode, setMyCode] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.coupleStatus().then((s) => setMyCode(s.inviteCode)).catch(() => {});
    // Partner join kar le to screen apne aap aage badhe.
    const t = setInterval(() => refresh(), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <Screen>
      <H1>Pair with your person</H1>
      <P>Ek code banao aur unhe bhejo, ya unka code yahan daalo.</P>

      <View style={{ marginTop: 28, padding: 20, borderRadius: 18, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }}>
        {myCode ? (
          <>
            <Text style={{ color: theme.muted, fontSize: 13 }}>Your code</Text>
            <Text style={{ color: theme.peach, fontSize: 34, letterSpacing: 6, fontWeight: '700', marginTop: 6 }}>
              {myCode}
            </Text>
            <Text style={{ color: theme.muted, marginTop: 8, fontSize: 13 }}>
              Share it with your partner. 7 din tak valid hai.
            </Text>
          </>
        ) : (
          <Button
            title="Generate my code"
            loading={loading}
            onPress={async () => {
              setErr(''); setLoading(true);
              try { const r = await api.invite(); setMyCode(r.code); }
              catch (e: any) { setErr(e.message); } finally { setLoading(false); }
            }}
          />
        )}
      </View>

      <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 28 }}>
        Already have their code?
      </Text>
      <Field
        value={code}
        onChangeText={(t: string) => setCode(t.toUpperCase())}
        placeholder="8-character code"
        autoCapitalize="characters"
        maxLength={8}
      />
      <Button
        title="Pair up"
        loading={loading}
        onPress={async () => {
          setErr(''); setLoading(true);
          try { await api.join(code); await refresh(); }
          catch (e: any) {
            setErr(e.message === 'invalid_code'
              ? 'Pairing failed. Code check karke dobara try karo.'
              : e.message);
          } finally { setLoading(false); }
        }}
      />
      <Err>{err}</Err>
      <View style={{ flex: 1 }} />
      <Pressable onPress={signOut}>
        <Text style={{ color: theme.muted, textAlign: 'center' }}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}
