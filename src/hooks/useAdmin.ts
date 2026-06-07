import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Cache module-level: resultado do check admin sobrevive navegação entre rotas.
// Evita múltiplas chamadas RPC redundantes e race conditions onde isAdmin=false
// durante loading causa redirect prematuro nos componentes filhos.
let _adminCache: { isAdmin: boolean; userId: string | null } | null = null;

export function useAdmin() {
  const cached = _adminCache;
  const [isAdmin, setIsAdmin] = useState(cached?.isAdmin ?? false);
  const [loading, setLoading] = useState(cached === null); // já tem cache → não loading
  const [userId, setUserId] = useState<string | null>(cached?.userId ?? null);

  useEffect(() => {
    let cancelled = false;
    // Safety net: nunca deixar admin loading travado por mais de 6s
    const safety = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 6000);

    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // Se cache já tem resultado para este usuário, não chama RPC de novo
        if (_adminCache && user && _adminCache.userId === user.id) {
          if (!cancelled) {
            setIsAdmin(_adminCache.isAdmin);
            setLoading(false);
          }
          return;
        }

        if (!user) {
          _adminCache = null; // limpa cache ao sair
          if (!cancelled) {
            setIsAdmin(false);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) setUserId(user.id);

        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin',
        });

        if (cancelled) return;
        if (error) {
          console.error('Error checking admin role:', error);
          setIsAdmin(false);
          _adminCache = { isAdmin: false, userId: user.id };
        } else {
          const result = !!data;
          setIsAdmin(result);
          _adminCache = { isAdmin: result, userId: user.id };
        }
      } catch (e) {
        console.error('checkAdmin threw:', e);
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) {
          setLoading(false);
          clearTimeout(safety);
        }
      }
    };

    checkAdmin();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });

    return () => {
      cancelled = true;
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, loading, userId };
}
