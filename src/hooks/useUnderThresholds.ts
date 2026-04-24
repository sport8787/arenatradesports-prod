import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type RiskProfile = 'conservador' | 'moderado' | 'agressivo' | 'custom';

export interface UnderThreshold {
  id?: string;
  user_id?: string;
  under_line: number;
  risk_profile: RiskProfile;
  delta_dangerous_attacks: number;
  delta_shots_on_target: number;
  delta_xg: number;
  enabled: boolean;
}

// Presets validados a partir da regra original Under 2.5 (moderado).
// Conservador: dispara antes (deltas menores). Agressivo: deixa correr (deltas maiores).
export const RISK_PRESETS: Record<Exclude<RiskProfile, 'custom'>, Omit<UnderThreshold, 'under_line' | 'risk_profile' | 'enabled'>> = {
  conservador: { delta_dangerous_attacks: 3, delta_shots_on_target: 2, delta_xg: 0.3 },
  moderado:    { delta_dangerous_attacks: 4, delta_shots_on_target: 3, delta_xg: 0.5 },
  agressivo:   { delta_dangerous_attacks: 6, delta_shots_on_target: 5, delta_xg: 0.8 },
};

export const SUPPORTED_LINES = [1.5, 2.5, 3.5] as const;

function defaultThreshold(line: number): UnderThreshold {
  return {
    under_line: line,
    risk_profile: 'moderado',
    enabled: true,
    ...RISK_PRESETS.moderado,
  };
}

export function useUnderThresholds() {
  const { user } = useAuth();
  const [thresholds, setThresholds] = useState<UnderThreshold[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('under_cashout_thresholds')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      toast.error('Falha ao carregar thresholds');
      setLoading(false);
      return;
    }

    // Garante uma linha por mercado suportado (mescla com defaults)
    const byLine = new Map<number, UnderThreshold>();
    (data || []).forEach((row: any) => byLine.set(Number(row.under_line), { ...row, under_line: Number(row.under_line), delta_xg: Number(row.delta_xg) }));
    const merged = SUPPORTED_LINES.map(l => byLine.get(l) ?? defaultThreshold(l));
    setThresholds(merged);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const update = useCallback((line: number, patch: Partial<UnderThreshold>) => {
    setThresholds(prev => prev.map(t => t.under_line === line ? { ...t, ...patch } : t));
  }, []);

  const applyPreset = useCallback((line: number, profile: Exclude<RiskProfile, 'custom'>) => {
    update(line, { risk_profile: profile, ...RISK_PRESETS[profile] });
  }, [update]);

  const save = useCallback(async (line: number) => {
    if (!user) return false;
    const t = thresholds.find(x => x.under_line === line);
    if (!t) return false;

    setSaving(line);
    const payload = {
      user_id: user.id,
      under_line: t.under_line,
      risk_profile: t.risk_profile,
      delta_dangerous_attacks: t.delta_dangerous_attacks,
      delta_shots_on_target: t.delta_shots_on_target,
      delta_xg: t.delta_xg,
      enabled: t.enabled,
    };

    const { error } = await supabase
      .from('under_cashout_thresholds')
      .upsert(payload, { onConflict: 'user_id,under_line' });

    setSaving(null);
    if (error) {
      toast.error(`Falha ao salvar Under ${line}: ${error.message}`);
      return false;
    }
    toast.success(`Under ${line} salvo!`);
    fetchAll();
    return true;
  }, [user, thresholds, fetchAll]);

  return {
    thresholds,
    loading,
    saving,
    update,
    applyPreset,
    save,
    refetch: fetchAll,
  };
}
