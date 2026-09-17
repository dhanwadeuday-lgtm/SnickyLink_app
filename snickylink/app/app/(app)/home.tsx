import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

const pad = (n: number) => String(n).padStart(2, '0');

function countdown(ms: number) {
  if (ms <= 0) return '00:00';
  const m = Math.floor(ms / 60000);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

const STATE_LABEL: any = {
  LOCKED: 'Locked', ACTIVE: 'Open now', SUBMITTED: 'Waiting',
  VERIFIED: 'Done', EXPIRED: 'Missed', FAILED: 'Missed',
};

export default function Home() {
  const router = useRouter();
  const [snicks, setSnicks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [d, s] = await Promise.all([api.dailySnicks(), api.stats()]);
      setSnicks(d.snicks);
      setStats(s);
    } catch {}
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const scheduled = snicks.filter((s) => !s.isMystery);
  const scheduledDone = scheduled.filter((s) => s.state === 'VERIFIED').length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 24, paddingTop: 64 }}
      refreshControl={
        <RefreshControl
          refreshing={busy}
          tintColor={theme.peach}
          onRefresh={async () => { setBusy(true); await load(); setBusy(false); }}
        />
      }
    >
      <Text style={{ color: theme.peach, fontSize: 12, letterSpacing: 2 }}>TODAY</Text>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '700', marginTop: 6 }}>
        {scheduledDone} of 3 done
      </Text>

      {stats && (
        <Pressable
          onPress={() => router.push('/(app)/profile')}
          style={{
            flexDirection: 'row', gap: 20, marginTop: 18, padding: 16,
            borderRadius: 16, backgroundColor: theme.card,
            borderWidth: 1, borderColor: theme.line,
          }}
        >
          <Stat label="Streak" value={`${stats.currentStreak}d`} />
          <Stat label="Couple XP" value={stats.totalXp} />
          <Stat label="Level" value={stats.level?.name} />
        </Pressable>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {[
          ['Chat', '/(app)/chat'],
          ['Moments', '/(app)/memories'],
          ['Dates', '/(app)/calendar'],
          ['Community', '/(app)/community'],
        ].map(([label, href]) => (
          <Pressable
            key={label}
            onPress={() => router.push(href as any)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
              borderWidth: 1, borderColor: theme.line,
            }}
          >
            <Text style={{ color: theme.peach, fontSize: 13 }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: 24 }} />

      {snicks.map((s) => {
        const locked = s.state === 'LOCKED';
        const dim = ['EXPIRED', 'FAILED'].includes(s.state);
        return (
          <Pressable
            key={s.id}
            disabled={locked}
            onPress={() => router.push(`/(app)/snick/${s.id}`)}
            style={({ pressed }) => ({
              padding: 18, borderRadius: 18, marginBottom: 12,
              backgroundColor: s.state === 'ACTIVE' ? 'rgba(232,185,156,0.12)' : theme.card,
              borderWidth: 1,
              borderColor: s.state === 'ACTIVE' ? theme.peach : theme.line,
              opacity: pressed ? 0.7 : dim ? 0.45 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.muted, fontSize: 12 }}>
                {s.isMystery ? 'MYSTERY' : (s.category || '').toUpperCase()}
              </Text>
              <Text style={{ color: s.state === 'ACTIVE' ? theme.peach : theme.muted, fontSize: 12 }}>
                {s.state === 'ACTIVE'
                  ? `${countdown(s.windowEnd - now)} left`
                  : s.locked
                    ? `${3 - scheduledDone} to go`
                    : STATE_LABEL[s.state]}
              </Text>
            </View>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 8 }}>
              {locked && s.isMystery ? 'Mystery Snick' : s.title}
            </Text>
            <Text style={{ color: theme.muted, marginTop: 6, fontSize: 14 }} numberOfLines={2}>
              {s.locked
                ? s.prompt
                : locked
                  ? `Opens at ${new Date(s.windowStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : s.prompt}
            </Text>
            {s.state === 'VERIFIED' && (
              <Text style={{ color: theme.good, marginTop: 8, fontSize: 13 }}>+{s.xp} XP</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const Stat = ({ label, value }: any) => (
  <View>
    <Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text>
    <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
      {value ?? '-'}
    </Text>
  </View>
);
