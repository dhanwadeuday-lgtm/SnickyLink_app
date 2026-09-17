import React, { useEffect, useState } from 'react';
import { Screen, H1, P, Field, Button, Err } from '../../src/ui';
import { api, getServer, setServer } from '../../src/api';
import { theme } from '../../src/theme';
import { Text } from 'react-native';

export default function ServerSettings() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { setUrl(getServer()); }, []);

  return (
    <Screen>
      <H1>Server</H1>
      <P>
        Backend ka address. Local dev me apne computer ka LAN IP daalo, aur phone usi
        Wi-Fi pe hona chahiye.
      </P>
      <Field value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="http://192.168.1.5:3001" />
      <Button
        title="Save & test"
        loading={loading}
        onPress={async () => {
          setErr(''); setStatus(''); setLoading(true);
          try {
            await setServer(url);
            await api.health();
            setStatus('Connected.');
          } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
        }}
      />
      {!!status && <Text style={{ color: theme.good, marginTop: 12 }}>{status}</Text>}
      <Err>{err}</Err>
    </Screen>
  );
}
