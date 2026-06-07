import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { identifyUser, resetAnalytics, track } from '@/lib/analytics';

// Schema de validação para signup — garante payloads consistentes
// para a Auth do Supabase E para a edge function email-d1-boasvindas.
const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: 'E-mail é obrigatório' })
    .max(255, { message: 'E-mail muito longo' })
    .email({ message: 'E-mail inválido' }),
  password: z
    .string()
    .min(6, { message: 'Senha deve ter ao menos 6 caracteres' })
    .max(72, { message: 'Senha muito longa (máx. 72)' }),
  username: z
    .string()
    .trim()
    .min(2, { message: 'Nickname deve ter ao menos 2 caracteres' })
    .max(60, { message: 'Nickname muito longo (máx. 60)' }),
  fullName: z
    .string()
    .trim()
    .min(2, { message: 'Nome deve ter ao menos 2 caracteres' })
    .max(120, { message: 'Nome muito longo (máx. 120)' })
    .optional(),
});

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
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
    // Safety timeout: nunca deixar loading travado por mais de 8s
    // (evita tela preta de splash em conexões lentas / falhas de rede no celular)
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Não bloqueia o splash esperando o profile — libera a UI imediatamente
          // e carrega o profile em background.
          setLoading(false);
          clearTimeout(safetyTimeout);
          fetchProfile(session.user.id)
            .then((profile) => {
              setProfile(profile);
              try {
                identifyUser(session.user.id, {
                  email: session.user.email,
                  username: profile?.username,
                  plan: 'active',
                });
                track.dailyLogin(profile?.daily_streak_count || 0);
              } catch (e) {
                console.warn('analytics identify failed', e);
              }
            })
            .catch((e) => {
              console.warn('fetchProfile failed (background):', e);
            });
        } else {
          setLoading(false);
          clearTimeout(safetyTimeout);
        }
      })
      .catch((e) => {
        console.error('getSession failed:', e);
        setLoading(false);
        clearTimeout(safetyTimeout);
      });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = async (email: string, password: string, username: string, fullName?: string) => {
    // Validação client-side dos campos antes de qualquer chamada externa
    const parsed = signUpSchema.safeParse({ email, password, username, fullName });
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      const error = new Error(first?.message ?? 'Dados de cadastro inválidos');
      console.warn('[signUp] validação falhou:', parsed.error.flatten());
      return { data: null, error };
    }

    const { email: cleanEmail, password: cleanPassword, username: cleanUsername, fullName: cleanFullName } = parsed.data;
    const redirectUrl = `${window.location.origin}/lobby`;

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: cleanUsername,
          ...(cleanFullName ? { full_name: cleanFullName } : {}),
        },
      },
    });

    // Decrement promo slot on successful signup (fire-and-forget)
    if (!error && data?.user) {
      supabase.functions.invoke('decrement-promo-slot').catch((e) =>
        console.warn('promo slot decrement failed:', e)
      );

      // Disparo imediato do e-mail D1 de boas-vindas (fire-and-forget).
      // Garantimos que email e full_name vão preenchidos e validados;
      // o cron diário às 08:00 BRT cobre eventuais falhas deste invoke.
      const welcomeEmail = data.user.email ?? cleanEmail;
      const welcomeName = cleanUsername;

      if (!data.user.id || !welcomeEmail || !welcomeName) {
        console.warn('[signUp] payload D1 incompleto, abortando trigger', {
          hasId: !!data.user.id,
          hasEmail: !!welcomeEmail,
          hasName: !!welcomeName,
        });
      } else {
        supabase.functions
          .invoke('email-d1-boasvindas', {
            body: {
              user_id: data.user.id,
              email: welcomeEmail,
              full_name: welcomeName,
            },
          })
          .catch((e) => console.warn('D1 welcome email trigger failed:', e));
      }
    }

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
      redirect_uri: window.location.origin,
    });
    return { data: result, error: result?.error || null };
  };

  const signInWithApple = async () => {
    const { lovable } = await import('@/integrations/lovable/index');
    const result = await lovable.auth.signInWithOAuth('apple', {
      redirect_uri: window.location.origin,
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
    const redirectUrl = `${window.location.origin}/auth`;
    
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
