'use client';

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { Session, User, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/database.types';

interface AuthContextType {
  supabase: SupabaseClient<Database>;
  session: Session | null;
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  isProUser: boolean;
  loadingSubscription: boolean;
}

// Create the context with a default value
const defaultSupabase = createClient();
const AuthContext = createContext<AuthContextType>({ 
  supabase: defaultSupabase as SupabaseClient<Database>,
  session: null, 
  user: null, 
  loading: true, 
  logout: async () => {},
  isProUser: false,
  loadingSubscription: true,
});

// Create the provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const supabase = createClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProUser, setIsProUser] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const subscriptionChannelRef = useRef<RealtimeChannel | null>(null);

  const checkSubscription = async (userId: string) => {
    setLoadingSubscription(true);
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
        .order('current_period_end', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      let isActive = false;
      if (data) {
        const now = new Date();
        const endDateStr = data.current_period_end;
        const endDate = endDateStr ? new Date(endDateStr) : null;
        if (!endDate || endDate > now) {
          isActive = true;
        }
      }
      console.log(`AuthContext: User ${userId} isProUser set to: ${isActive}`);
      setIsProUser(isActive);
    } catch (error) {
      console.error('AuthContext: Error fetching subscription:', error);
      setIsProUser(false);
    } finally {
      setLoadingSubscription(false);
    }
  };

  useEffect(() => {
    const initializeAuthAndSubscription = async () => {
      setLoading(true);
      setLoadingSubscription(true);

      const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Error getting initial session:', sessionError);
      }
      const initialUser = initialSession?.user ?? null;
      setSession(initialSession);
      setUser(initialUser);
      setLoading(false);

      if (initialUser) {
        await checkSubscription(initialUser.id);
      } else {
        setIsProUser(false);
        setLoadingSubscription(false);
      }

      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
        console.log('Auth state changed:', _event, newSession);
        const newUser = newSession?.user ?? null;
        setSession(newSession);
        setUser(newUser);

        if (subscriptionChannelRef.current) {
          console.log('AuthContext: Removing previous realtime subscription.');
          supabase.removeChannel(subscriptionChannelRef.current);
          subscriptionChannelRef.current = null;
        }

        if (newUser) {
          await checkSubscription(newUser.id);

          console.log(`AuthContext: Setting up realtime subscription for user ${newUser.id}`);
          const channel = supabase
            .channel(`subscriptions:${newUser.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'subscriptions',
                filter: `user_id=eq.${newUser.id}`,
              },
              (payload) => {
                console.log('AuthContext: Realtime subscription change detected:', payload);
                checkSubscription(newUser.id);
              }
            )
            .subscribe((status, err) => {
              if (status === 'SUBSCRIBED') {
                console.log(`AuthContext: Realtime subscribed for user ${newUser.id}`);
              }
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || err) {
                console.error('AuthContext: Realtime subscription error:', status, err);
              }
            });
          subscriptionChannelRef.current = channel;
        } else {
          setIsProUser(false);
          setLoadingSubscription(false);
        }
      });

      return () => {
        authListener?.subscription.unsubscribe();
        if (subscriptionChannelRef.current) {
          console.log('AuthContext: Unsubscribing from realtime channel on cleanup.');
          supabase.removeChannel(subscriptionChannelRef.current);
        }
      };
    }

    const cleanupPromise = initializeAuthAndSubscription();

    return () => { cleanupPromise.then(cleanup => cleanup?.()); };
  }, [supabase]);

  const logout = async () => {
    setLoading(true);
    setLoadingSubscription(true);
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
    isProUser,
    loadingSubscription,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  return context;
};
