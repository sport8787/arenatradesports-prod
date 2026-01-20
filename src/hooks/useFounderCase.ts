/**
 * Hook para gerenciar validação de Maleta Fundador
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface FounderCaseState {
  hasFounderCase: boolean;
  loading: boolean;
  caseCode: string | null;
  expiresAt: Date | null;
}

export function useFounderCase() {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<FounderCaseState>({
    hasFounderCase: false,
    loading: true,
    caseCode: null,
    expiresAt: null
  });

  // Verificar se usuário possui Maleta Fundador
  const checkFounderCase = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setState(prev => ({ ...prev, loading: false, hasFounderCase: false }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('founder_cases')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        setState(prev => ({ ...prev, loading: false, hasFounderCase: false }));
        return;
      }

      // Verificar expiração
      const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
      const isExpired = expiresAt && expiresAt < new Date();

      setState({
        hasFounderCase: !isExpired,
        loading: false,
        caseCode: data.case_code,
        expiresAt
      });
    } catch (error) {
      console.error('[FounderCase] Error checking:', error);
      setState(prev => ({ ...prev, loading: false, hasFounderCase: false }));
    }
  }, [isAuthenticated, user?.id]);

  // Validar código de Maleta Fundador
  const validateCaseCode = useCallback(async (code: string): Promise<boolean> => {
    if (!isAuthenticated || !user?.id) {
      return false;
    }

    try {
      // Verificar se o código existe e não está em uso
      const { data: existingCase, error } = await supabase
        .from('founder_cases')
        .select('*')
        .eq('case_code', code.toUpperCase())
        .single();

      if (error || !existingCase) {
        return false;
      }

      // Se já tem dono, verificar se é o mesmo usuário
      if (existingCase.user_id && existingCase.user_id !== user.id) {
        return false;
      }

      // Se não tem dono, ativar para este usuário
      if (!existingCase.user_id) {
        const { error: updateError } = await supabase
          .from('founder_cases')
          .update({
            user_id: user.id,
            activated_at: new Date().toISOString(),
            is_active: true
          })
          .eq('id', existingCase.id);

        if (updateError) {
          console.error('[FounderCase] Error activating:', updateError);
          return false;
        }
      }

      // Recarregar estado
      await checkFounderCase();
      return true;
    } catch (error) {
      console.error('[FounderCase] Error validating:', error);
      return false;
    }
  }, [isAuthenticated, user?.id, checkFounderCase]);

  useEffect(() => {
    checkFounderCase();
  }, [checkFounderCase]);

  return {
    ...state,
    validateCaseCode,
    refresh: checkFounderCase
  };
}
