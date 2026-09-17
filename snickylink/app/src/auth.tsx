import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, loadSession, saveSession, clearSession } from './api';

type Ctx = {
  ready: boolean;
  user: any;
  couple: any;
  signIn: (s: any) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [couple, setCouple] = useState<any>(null);

  const refresh = async () => {
    try {
      const me = await api.me();
      setUser(me.user);
      setCouple(me.couple);
    } catch {
      setUser(null);
      setCouple(null);
    }
  };

  useEffect(() => {
    (async () => {
      const s = await loadSession();
      if (s?.accessToken) await refresh();
      setReady(true);
    })();
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        ready,
        user,
        couple,
        signIn: async (s) => {
          await saveSession(s);
          await refresh();
        },
        signOut: async () => {
          try { await api.logout(); } catch {}
          await clearSession();
          setUser(null);
          setCouple(null);
        },
        refresh,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
