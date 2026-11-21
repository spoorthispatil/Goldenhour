import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { resetRealtimeConnection } from './realtime';

export type UserRole = 'DISPATCHER' | 'HOSPITAL' | 'PATIENT';

export interface AuthUser {
  userId: string;
  username: string;
  role: UserRole;
  hospitalId: string | null;
  hospitalName: string | null;
  patientId: string | null;
  patientName: string | null;
}

export function homeFor(role: UserRole): string {
  if (role === 'PATIENT') return '/patient';
  return role === 'DISPATCHER' ? '/dispatcher' : '/hospital';
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then((response) => {
        if (active) setUser(response.data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // When any API call reports an expired session, drop the local user so the
  // protected routes send the visitor back to the sign-in page.
  useEffect(() => {
    const handleUnauthenticated = () => {
      resetRealtimeConnection();
      setUser(null);
    };
    window.addEventListener('goldenhour:unauthenticated', handleUnauthenticated);
    return () =>
      window.removeEventListener('goldenhour:unauthenticated', handleUnauthenticated);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post<{ user: AuthUser }>('/auth/login', {
      username,
      password,
    });
    setUser(response.data.user);
    return response.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      resetRealtimeConnection();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
