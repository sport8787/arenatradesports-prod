import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FlaskConical, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ShadowAfCronToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('cron_settings')
        .select('is_enabled')
        .eq('setting_key', 'shadow_af_cron')
        .maybeSingle();
      setEnabled(data?.is_enabled ?? false);
      setLoading(false);
    })();
  }, []);

  const toggle = async () => {
    setToggling(true);
    const newValue = !enabled;
    const { error } = await supabase
      .from('cron_settings')
      .update({ is_enabled: newValue, updated_at: new Date().toISOString() })
      .eq('setting_key', 'shadow_af_cron');

    if (error) {
      toast.error('Erro ao alterar configuração');
    } else {
      setEnabled(newValue);
      toast.success(
        newValue
          ? '🔬 Shadow AF ATIVADO — análise paralela com API-Football a cada 2 min'
          : '⏸️ Shadow AF DESATIVADO — economizando chamadas API-Football',
      );
    }
    setToggling(false);
  };

  if (loading) return null;

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
        enabled
          ? 'border-amber-500/60 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
          : 'border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground',
      )}
      title="Ativa/desativa cron paralelo (API-Football) para comparação shadow"
    >
      {enabled ? (
        <>
          <FlaskConical className="w-3.5 h-3.5 animate-pulse" />
          SHADOW AF ON
        </>
      ) : (
        <>
          <Pause className="w-3.5 h-3.5" />
          SHADOW AF OFF
        </>
      )}
    </button>
  );
}
