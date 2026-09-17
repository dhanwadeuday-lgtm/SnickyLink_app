import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Field, Button, Err, P } from '../../src/ui';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

const REACTIONS = ['💗', '🔥', '😂', '💎'];

export default function Community() {
  const [tab, setTab] = useState<'feed' | 'ours'>('feed');
  const [items, setItems] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<'PRIVATE_COUPLE' | 'COMMUNITY'>('PRIVATE_COUPLE');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () =>
    (tab === 'feed' ? api.feed() : api.ourWall())
      .then((r) => setItems(r.items))
      .catch(() => {});
  useEffect(() => { load(); }, [tab]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['feed', 'ours'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
              borderWidth: 1, borderColor: tab === t ? theme.peach : theme.line,
            }}
          >
            <Text style={{ color: tab === t ? theme.peach : theme.muted }}>
              {t === 'feed' ? 'Community' : 'Our wall'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field
        value={body}
        onChangeText={setBody}
        placeholder="Kuch share karna hai?"
        multiline
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {(['PRIVATE_COUPLE', 'COMMUNITY'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setVisibility(v)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              borderWidth: 1, borderColor: visibility === v ? theme.peach : theme.line,
            }}
          >
            <Text style={{ color: visibility === v ? theme.peach : theme.muted, fontSize: 12 }}>
              {v === 'PRIVATE_COUPLE' ? 'Sirf hum dono' : 'Public'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Button
        title="Post"
        loading={loading}
        onPress={async () => {
          setErr(''); setLoading(true);
          try { await api.createPost({ body, visibility }); setBody(''); load(); }
          catch (e: any) { setErr(e.message); } finally { setLoading(false); }
        }}
      />
      <Err>{err}</Err>

      <View style={{ height: 20 }} />
      {items.map((p) => (
        <View
          key={p.id}
          style={{
            padding: 16, borderRadius: 16, marginBottom: 12,
            backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line,
          }}
        >
          <Text style={{ color: theme.muted, fontSize: 11 }}>
            {p.visibility === 'COMMUNITY' ? 'PUBLIC' : 'PRIVATE'}
            {p.isMine ? ' · us' : ''}
          </Text>
          <Text style={{ color: theme.text, marginTop: 8, fontSize: 15 }}>{p.body}</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            {REACTIONS.map((e) => (
              <Pressable
                key={e}
                onPress={async () => {
                  await api.reactToPost(p.id, p.myReaction === e ? null : e);
                  load();
                }}
              >
                <Text style={{ fontSize: 18, opacity: p.myReaction === e ? 1 : 0.5 }}>{e}</Text>
              </Pressable>
            ))}
            <Text style={{ color: theme.muted, fontSize: 12, alignSelf: 'center' }}>
              {p.reactions?.reduce((a: number, r: any) => a + r.n, 0) || 0}
            </Text>
            <View style={{ flex: 1 }} />
            {!p.isMine && (
              <Pressable
                onPress={() => api.report({ targetType: 'post', targetId: p.id, reason: 'user_report' })}
              >
                <Text style={{ color: theme.muted, fontSize: 12 }}>Report</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}
      {!items.length && <P>Abhi yahan kuch nahi hai.</P>}
    </ScrollView>
  );
}
