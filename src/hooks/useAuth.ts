import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { identifyUser, resetAnalytics, track } from '@/lib/analytics';

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  bluff_coins: number;
  bc_balance: number;
  nt_balance: number;
  matches_played: number;
  wins: number;
  rank_title: string;
  daily_streak_count: number;
  last_streak_date: string | null;
  last_daily_bonus: string | null;
  created_at: string;
  updated_at: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id).then(setProfile);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).then((profile) => {
          setProfile(profile);
          identifyUser(session.user.id, {
            email: session.user.email,
            username: profile?.username,
            plan: 'active',
          });
          track.dailyLogin(profile?.daily_streak_count || 0);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = async (email: string, password: string, username: string) => {
    const redirectUrl = `${window.location.origin}/punter`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { username }
      }
    });
    
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    const { lovable } = await import('@/integrations/lovable/index');
    const result = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: `${window.location.origin}/punter`,
    });
    return { data: result, error: result?.error || null };
  };

  const signInWithApple = async () => {
    const { lovable } = await import('@/integrations/lovable/index');
    const result = await lovable.auth.signInWithOAuth('apple', {
      redirect_uri: `${window.location.origin}/punter`,
    });
    return { data: result, error: result?.error || null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
      setProfile(null);
      resetAnalytics();
    }
    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = 'https://futebol.blefadormilionario.com.br/auth';
    
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    return { data, error };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id)
      .select()
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    }
    return { data, error };
  };

  const addBluffCoins = async (amount: number) => {
    if (!user || !profile) return { error: new Error('No user logged in') };

    const newBalance = profile.bluff_coins + amount;
    return updateProfile({ bluff_coins: newBalance });
  };

  const refetchProfile = async () => {
    if (user) {
      const profile = await fetchProfile(user.id);
      setProfile(profile);
    }
  };

  return {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    resetPassword,
    updateProfile,
    addBluffCoins,
    refetchProfile,
    isAuthenticated: !!user
  };
};
