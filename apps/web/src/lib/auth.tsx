'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, refreshAccessToken, setAccessToken, setAuthFailureHandler } from './api';
import type { Me } from './types';

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const loadMe = useCallback(async () => {
    const me = await api<Me>('/auth/me');
    setUser(me);
  }, []);

  // Restore the session from the httpOnly refresh cookie on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const refreshed = await refreshAccessToken();
        if (refreshed && !cancelled) await loadMe();
      } catch {
        /* not logged in */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  useEffect(() => {
    setAuthFailureHandler(() => {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
      router.replace('/login');
    });
    return () => setAuthFailureHandler(null);
  }, [router, queryClient]);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') router.replace('/login');
  }, [loading, user, pathname, router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ accessToken: string }>('/auth/login', { method: 'POST', body: { email, password } });
      setAccessToken(res.accessToken);
      await loadMe();
      router.replace('/dashboard');
    },
    [loadMe, router],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
    }
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
    router.replace('/login');
  }, [queryClient, router]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The signed-in user; only call inside the authenticated app shell. */
export function useMe(): Me {
  const { user } = useAuth();
  if (!user) throw new Error('Not authenticated');
  return user;
}
