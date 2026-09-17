import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Button } from '../../src/ui';
import { theme } from '../../src/theme';

export default function Profile() {
  const { signOut, user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    api.coupleStatus().then((s) => setPartner(s.partner)).catch(() => {});
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}>
        {user?.name}{partner ? ` & ${partner.name}` : ''}
      </Text>
      {stats && (
        <>
          <Text style={{ color: theme.peach, fontSize: 15, marginTop: 8 }}>
            {stats.level?.name} · {stats.totalXp} XP
          </Text>
          <Text style={{ color: theme.muted, fontSize: 13, marginTop: 4 }}>
            Next tier at {stats.level?.nextAt} XP
          </Text>

          <View style={{ marginTop: 24, gap: 10 }}>
            <Row label="Snicks completed" value={stats.snicksCompleted} />
            <Row label="Completion rate" value={`${stats.completionRate}%`} />
            <Row label="Current streak" value={`${stats.currentStreak} days`} />
            <Row label="Longest streak" value={`${stats.longestStreak} days`} />
          </View>

          <Text style={{ color: theme.text, fontWeight: '700', marginTop: 28, marginBottom: 10 }}>
            Category progress
          </Text>
          {stats.categories?.map((c: any) => (
            <Row key={c.category} label={c.category} value={c.completed} />
          ))}

          <Text style={{ color: theme.text, fontWeight: '700', marginTop: 28 }}>
            Milestones
          </Text>
          <Text style={{ color: theme.muted, marginTop: 6 }}>
            {stats.milestones?.length
              ? stats.milestones.join(' · ')
              : 'Pehla diamond 25 Snicks pe.'}
          </Text>
        </>
      )}
      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </ScrollView>
  );
}

const Row = ({ label, value }: any) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ color: theme.muted }}>{label}</Text>
    <Text style={{ color: theme.text, fontWeight: '600' }}>{value}</Text>
  </View>
);
