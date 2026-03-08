import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Brain, DollarSign, Target, TrendingUp, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface HorusConfigProps {
  userId: string;
}

interface AlertConfig {
  type: 'emotional' | 'financial' | 'opportunities' | 'performance';
  enabled: boolean;
  frequency: 'always' | 'high' | 'medium' | 'low';
}

const DEFAULT_ALERTS: AlertConfig[] = [
  { type: 'emotional', enabled: true, frequency: 'high' },
  { type: 'financial', enabled: true, frequency: 'medium' },
  { type: 'opportunities', enabled: true, frequency: 'always' },
  { type: 'performance', enabled: true, frequency: 'medium' },
];

const ALERT_META = {
  emotional: { icon: Brain, label: 'Gestão Emocional', desc: 'Detectar tilt, pausar apostas', color: 'text-warning' },
  financial: { icon: DollarSign, label: 'Gestão Financeira', desc: 'Bankroll, stakes, retiradas', color: 'text-success' },
  opportunities: { icon: Target, label: 'Oportunidades', desc: 'Asset Score ≥ 80, TIER 1-2', color: 'text-primary' },
  performance: { icon: TrendingUp, label: 'Performance', desc: 'Resumos, comparações, insights', color: 'text-accent' },
} as const;

const FREQ_LABELS: Record<string, string> = {
  always: 'Sempre',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export default function HorusConfig({ userId }: HorusConfigProps) {
  const [config, setConfig] = useState<AlertConfig[]>(DEFAULT_ALERTS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('horus_alerts')
        .eq('user_id', userId)
        .single();

      if (data?.horus_alerts && Array.isArray(data.horus_alerts)) {
        setConfig(data.horus_alerts as unknown as AlertConfig[]);
      }
      setLoaded(true);
    };
    load();
  }, [userId]);

  const handleToggle = (idx: number, enabled: boolean) => {
    const next = [...config];
    next[idx] = { ...next[idx], enabled };
    setConfig(next);
  };

  const handleFreq = (idx: number, frequency: AlertConfig['frequency']) => {
    const next = [...config];
    next[idx] = { ...next[idx], frequency };
    setConfig(next);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        horus_alerts: config as any,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      toast.error('Erro ao salvar configurações');
    } else {
      toast.success('Configurações salvas!');
    }
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg bg-card overflow-hidden"
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Settings className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          CONFIGURAR HÓRUS
        </span>
      </div>

      <div className="p-4 space-y-3">
        {config.map((alert, idx) => {
          const meta = ALERT_META[alert.type];
          const Icon = meta.icon;
          return (
            <div key={alert.type} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <Icon className={cn("w-4 h-4", meta.color)} />
                  <div>
                    <p className="text-xs font-mono font-semibold text-foreground">{meta.label}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{meta.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={alert.enabled}
                  onCheckedChange={(v) => handleToggle(idx, v)}
                />
              </div>

              {alert.enabled && (
                <div className="flex gap-1.5 mt-2">
                  {(['always', 'high', 'medium', 'low'] as const).map(freq => (
                    <button
                      key={freq}
                      onClick={() => handleFreq(idx, freq)}
                      className={cn(
                        "px-2.5 py-1 rounded text-[10px] font-mono font-medium transition-colors",
                        alert.frequency === freq
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {FREQ_LABELS[freq]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="w-full font-mono text-xs"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
          Salvar Configurações
        </Button>
      </div>
    </motion.div>
  );
}
