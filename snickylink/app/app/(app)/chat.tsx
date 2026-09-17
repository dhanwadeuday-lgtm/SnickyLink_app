import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Field, Button } from '../../src/ui';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { encrypt, decrypt, initKey } from '../../src/crypto';
import { theme } from '../../src/theme';

const TTLS = [
  { label: 'Keeps', v: null },
  { label: '1h', v: 3600 },
  { label: '24h', v: 86400 },
];

export default function Chat() {
  const { user, couple } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [ttl, setTtl] = useState<number | null>(null);
  const listRef = useRef<any>(null);

  const load = async () => {
    try {
      const r = await api.messages(0);
      setItems(r.items);
      api.markRead().catch(() => {});
    } catch {}
  };

  useEffect(() => {
    if (couple?.id) initKey(couple.id);
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [couple?.id]);

  const send = async () => {
    if (!draft.trim()) return;
    const { ciphertext } = encrypt(draft.trim());
    setDraft('');
    await api.sendMessage({ ciphertext, ttlSeconds: ttl });
    load();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          return (
            <View
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                backgroundColor: mine ? theme.peach : theme.card,
                borderWidth: mine ? 0 : 1,
                borderColor: theme.line,
                borderRadius: 16,
                padding: 12,
                marginBottom: 8,
                maxWidth: '80%',
              }}
            >
              <Text style={{ color: mine ? theme.wineDark : theme.text, fontSize: 15 }}>
                {decrypt(item.ciphertext)}
              </Text>
              {item.expires_at && (
                <Text style={{ color: mine ? theme.wine : theme.muted, fontSize: 11, marginTop: 4 }}>
                  disappears {new Date(item.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          );
        }}
      />

      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
        {TTLS.map((t) => (
          <Pressable
            key={t.label}
            onPress={() => setTtl(t.v)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              borderWidth: 1, borderColor: ttl === t.v ? theme.peach : theme.line,
            }}
          >
            <Text style={{ color: ttl === t.v ? theme.peach : theme.muted, fontSize: 12 }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ padding: 16, paddingTop: 4 }}>
        <Field value={draft} onChangeText={setDraft} placeholder="Message" onSubmitEditing={send} />
        <Button title="Send" onPress={send} />
      </View>
    </KeyboardAvoidingView>
  );
}
