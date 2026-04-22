import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { authApi, getToken, setToken, clearToken } from '@/lib/api';
import type { AppRole, Profile } from '@/lib/supabase-types';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isDriver: boolean;
  isShop: boolean;
  privacyAccepted: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFromToken = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      if (!me || !me.is_active) {
        clearToken();
        setLoading(false);
        return;
      }
      setUser({ id: me.id, email: me.email });
      setRole((me.role as AppRole) ?? null);
      if (me.profile) {
        setProfile(me.profile as Profile);
      }
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromToken();
  }, [loadFromToken]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const res = await authApi.login(email, password);
      setToken(res.token);
      setUser({ id: res.user.id, email: res.user.email });
      setRole(res.user.role as AppRole);
      setProfile({
        id: res.user.profile.id,
        user_id: res.user.id,
        full_name: res.user.profile.full_name,
        phone: res.user.profile.phone,
        avatar_url: res.user.profile.avatar_url,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        shop_name: res.user.profile.shop_name,
        default_pickup_address: res.user.profile.default_pickup_address,
        default_pickup_lat: res.user.profile.default_pickup_lat,
        default_pickup_lng: res.user.profile.default_pickup_lng,
        privacy_accepted_at: res.user.profile.privacy_accepted_at,
      });
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, []);

  const signOut = useCallback(async () => {
    clearToken();
    setUser(null);
    setProfile(null);
    setRole(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getToken()) return;
    try {
      const me = await authApi.me();
      if (me.profile) setProfile(me.profile as Profile);
      if (me.role) setRole(me.role as AppRole);
    } catch {}
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    role,
    loading,
    signIn,
    signOut,
    refreshProfile,
    isAdmin: role === 'admin',
    isDriver: role === 'driver',
    isShop: role === 'shop',
    privacyAccepted: !!profile?.privacy_accepted_at,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
