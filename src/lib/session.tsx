import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from './supabase';
import type { Family } from './types';

type AppState = {
  session: Session | null;
  loading: boolean;
  family: Family | null;
  refreshFamily: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<Family | null>(null);

  const loadFamily = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setFamily(null);
      return;
    }
    const { data } = await supabase
      .from('family_members')
      .select('families(id, name, invite_code)')
      .eq('user_id', userId)
      .limit(1);
    const row = data?.[0] as { families: Family | Family[] | null } | undefined;
    const f = Array.isArray(row?.families) ? row?.families[0] : row?.families;
    setFamily(f ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadFamily(data.session?.user.id).finally(() => setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      loadFamily(next?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadFamily]);

  const value = useMemo<AppState>(
    () => ({
      session,
      loading,
      family,
      refreshFamily: () => loadFamily(session?.user.id),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, family, loadFamily],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
