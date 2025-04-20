'use client';

import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { Session, User, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/database.types';

interface AuthContextType {
  supabase: SupabaseClient<Database>;
  session: Session | null;
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

// Create the context with a default value
const defaultSupabase = createClient();
const AuthContext = createContext<AuthContextType>({ 
  supabase: defaultSupabase as SupabaseClient<Database>,
  session: null, 
  user: null, 
  loading: true, 
  logout: async () => {} 
});

// Create the provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const getInitialSession = async () => {
        try {
          const { data: { session: initialSession }, error } = await supabase.auth.getSession();
          if (error) throw error;
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        } catch (error) {
          console.error('Error getting initial session:', error);
        } finally {
          setLoading(false);
        }
      };

      await getInitialSession();

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        console.log('Auth state changed:', _event, session);
        setSession(session);
        setUser(session?.user ?? null);
      });

      return () => {
        authListener?.subscription.unsubscribe();
      };
    }

    const cleanupPromise = initializeAuth();

    return () => { cleanupPromise.then(cleanup => cleanup?.()); };
  }, [supabase]);

  const logout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
    }
    setLoading(false);
  };

  const value: AuthContextType = {
    supabase,
    session,
    user,
    loading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  return context;
};
