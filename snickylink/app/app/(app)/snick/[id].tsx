import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Field, Button, Err, P } from '../../../src/ui';
import { api } from '../../../src/api';
import { theme } from '../../../src/theme';

export default function SnickDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [snick, setSnick] = useState<any>(null);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { setSnick(await api.snick(id!)); } catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { load(); }, [id]);

  if (!snick) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

  const sub = snick.submission;
  const canSubmit = snick.state === 'ACTIVE' && !sub;

  const doSubmit = async () => {
    setErr(''); setLoading(true);
    try {
      let mediaId: string | undefined;
      if (snick.verification === 'photo') {
        if (!photo) throw new Error('Pehle photo choose karo.');
        const up = await api.uploadPhoto(photo);
        mediaId = up.mediaId;
      }
      await api.submit(id!, { text, mediaId });
      await load();
    } catch (e: any) {
      setErr(e.message === 'window_not_active' ? 'Is Snick ka window band ho chuka hai.' : e.message);
    } finally { setLoading(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ color: theme.peach, fontSize: 12, letterSpacing: 2 }}>
        {snick.isMystery ? 'MYSTERY SNICK' : (snick.category || '').toUpperCase()}
        {snick.rarity && snick.rarity !== 'NORMAL' ? `  ·  ${snick.rarity}` : ''}
      </Text>
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '700', marginTop: 10 }}>
        {snick.title}
      </Text>
      <P style={{ marginTop: 12, fontSize: 16, color: theme.text }}>{snick.prompt}</P>
      <Text style={{ color: theme.muted, marginTop: 12, fontSize: 13 }}>
        Worth {snick.xp} XP · window {new Date(snick.windowStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {' – '}
        {new Date(snick.windowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>

      <View style={{ height: 20 }} />

      {snick.state === 'VERIFIED' && (
        <Text style={{ color: theme.good, fontSize: 16 }}>Done. +{snick.xp} XP added.</Text>
      )}

      {['EXPIRED', 'FAILED'].includes(snick.state) && (
        <P>Ye window nikal gayi. Streak abhi bhi safe hai — agla Snick pakad lo.</P>
      )}

      {canSubmit && snick.verification === 'text' && (
        <>
          <Field
            value={text}
            onChangeText={setText}
            placeholder="Yahan likho..."
            multiline
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <Button title="Submit" loading={loading} onPress={doSubmit} />
        </>
      )}

      {canSubmit && snick.verification === 'photo' && (
        <>
          {photo && (
            <Image source={{ uri: photo }} style={{ height: 220, borderRadius: 16, marginTop: 12 }} />
          )}
          <Button
            title={photo ? 'Change photo' : 'Choose photo'}
            variant="ghost"
            onPress={async () => {
              const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
              if (!r.canceled) setPhoto(r.assets[0].uri);
            }}
          />
          <Button title="Submit" loading={loading} onPress={doSubmit} />
        </>
      )}

      {canSubmit && snick.verification === 'partner' && (
        <>
          <P>Ye Snick partner confirm karega. Kar lene ke baad yahan mark karo.</P>
          <Button title="We did it" loading={loading} onPress={doSubmit} />
        </>
      )}

      {sub && sub.status === 'AWAITING_PARTNER' && (
        <View style={{ marginTop: 8 }}>
          {sub.canConfirm ? (
            <>
              <P>Partner ne ise mark kiya hai. Confirm karoge?</P>
              <Button
                title="Confirm"
                loading={loading}
                onPress={async () => {
                  setLoading(true);
                  try { await api.confirm(sub.id); await load(); }
                  catch (e: any) { setErr(e.message); } finally { setLoading(false); }
                }}
              />
            </>
          ) : (
            <P>Partner ke confirm karne ka intezaar hai.</P>
          )}
        </View>
      )}

      {sub && sub.status === 'PENDING' && <P>Verify ho raha hai...</P>}
      {sub && sub.media_id && (
        <Image
          source={{ uri: api.mediaUrl(sub.media_id) }}
          style={{ height: 220, borderRadius: 16, marginTop: 16 }}
        />
      )}
      {sub && sub.text ? (
        <Text style={{ color: theme.text, marginTop: 16, fontSize: 16 }}>{sub.text}</Text>
      ) : null}

      <Err>{err}</Err>
      <Button title="Back" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}
