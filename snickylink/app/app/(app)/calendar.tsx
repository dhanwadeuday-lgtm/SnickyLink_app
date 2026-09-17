import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Field, Button, Err, P } from '../../src/ui';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

const KINDS = ['anniversary', 'birthday', 'date', 'plan'];

export default function Calendar() {
  const [items, setItems] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [kind, setKind] = useState('date');
  const [yearly, setYearly] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => api.calendar().then((r) => setItems(r.items)).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '700' }}>Dates that matter</Text>
      <P>Reminder ek din pehle aayega.</P>

      <Field value={title} onChangeText={setTitle} placeholder="Kya hai?" />
      <Field value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {KINDS.map((k) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
              borderWidth: 1, borderColor: kind === k ? theme.peach : theme.line,
            }}
          >
            <Text style={{ color: kind === k ? theme.peach : theme.muted, fontSize: 12 }}>{k}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setYearly(!yearly)}
          style={{
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
            borderWidth: 1, borderColor: yearly ? theme.peach : theme.line,
          }}
        >
          <Text style={{ color: yearly ? theme.peach : theme.muted, fontSize: 12 }}>repeats yearly</Text>
        </Pressable>
      </View>

      <Button
        title="Add"
        loading={loading}
        onPress={async () => {
          setErr(''); setLoading(true);
          try {
            await api.createEvent({ title, eventDate: date, kind, recursYearly: yearly });
            setTitle(''); setDate(''); load();
          } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
        }}
      />
      <Err>{err}</Err>

      <View style={{ height: 24 }} />
      {items.map((e) => (
        <View
          key={e.id}
          style={{
            padding: 16, borderRadius: 16, marginBottom: 10,
            backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line,
          }}
        >
          <Text style={{ color: theme.peach, fontSize: 12 }}>
            {e.kind.toUpperCase()}{e.recurs_yearly ? ' · yearly' : ''}
          </Text>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600', marginTop: 4 }}>
            {e.title}
          </Text>
          <Text style={{ color: theme.muted, marginTop: 4 }}>{e.nextOccurrence}</Text>
          <Pressable onPress={async () => { await api.deleteEvent(e.id); load(); }}>
            <Text style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {!items.length && <P>Koi date add nahi hui abhi.</P>}
    </ScrollView>
  );
}
