import { useEffect } from 'react';
import { useAuthStore } from '../store';
import { supabase } from '../services/supabase';
import type { User } from '../types';

export function useAuthListener() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      return;
    }

    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            display_name: session.user.user_metadata?.display_name ?? null,
            avatar_url: session.user.user_metadata?.avatar_url ?? null,
            created_at: session.user.created_at,
          });
        } else {
          setUser(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[useAuthListener] getSession failed:', err);
        setUser(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          display_name: session.user.user_metadata?.display_name ?? null,
          avatar_url: session.user.user_metadata?.avatar_url ?? null,
          created_at: session.user.created_at,
        });
      } else {
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);
}
