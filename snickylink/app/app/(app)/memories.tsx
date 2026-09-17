import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Field, Button, Err, P } from '../../src/ui';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

export default function Memories() {
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => api.memories().then((r) => setItems(r.items)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr(''); setLoading(true);
    try {
      let mediaIds: string[] = [];
      if (photo) mediaIds = [(await api.uploadPhoto(photo)).mediaId];
      await api.createMemory({ title, note, mediaIds });
      setTitle(''); setNote(''); setPhoto(null); setAdding(false);
      load();
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '700' }}>Our moments</Text>
      <P>Jo rakhna hai wahi rakho. Sab kuch apne aap save nahi hota.</P>

      {adding ? (
        <View style={{ marginTop: 16 }}>
          <Field value={title} onChangeText={setTitle} placeholder="Title" />
          <Field
            value={note}
            onChangeText={setNote}
            placeholder="Kya hua tha?"
            multiline
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />
          {photo && <Image source={{ uri: photo }} style={{ height: 180, borderRadius: 14, marginTop: 12 }} />}
          <Button
            title={photo ? 'Change photo' : 'Add photo'}
            variant="ghost"
            onPress={async () => {
              const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
              if (!r.canceled) setPhoto(r.assets[0].uri);
            }}
          />
          <Button title="Save memory" loading={loading} onPress={save} />
          <Button title="Cancel" variant="ghost" onPress={() => setAdding(false)} />
          <Err>{err}</Err>
        </View>
      ) : (
        <Button title="Add a memory" onPress={() => setAdding(true)} />
      )}

      <View style={{ height: 24 }} />

      {items.map((m) => (
        <View
          key={m.id}
          style={{
            padding: 16, borderRadius: 16, marginBottom: 12,
            backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line,
          }}
        >
          <Text style={{ color: theme.muted, fontSize: 12 }}>{m.happened_on}</Text>
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 6 }}>
            {m.title}
          </Text>
          {!!m.note && <Text style={{ color: theme.muted, marginTop: 6 }}>{m.note}</Text>}
          {m.media?.map((id: string) => (
            <Image
              key={id}
              source={{ uri: api.mediaUrl(id) }}
              style={{ height: 180, borderRadius: 12, marginTop: 10 }}
            />
          ))}
          <Pressable onPress={async () => { await api.deleteMemory(m.id); load(); }}>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 10 }}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {!items.length && <P>Abhi kuch nahi. Pehla moment add karo.</P>}
    </ScrollView>
  );
}
