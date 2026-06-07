import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brain, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Kill switch global das análises automáticas do Punter.
 * Espelha o padrão do LiveCronToggle (Arena Trader).
 * Lê/escreve cron_settings.punter_analyses_cron.
 * Bypass manual: passe { force: true } no body ao invocar as edges.
 */
export default function PunterAnalysesCronToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('cron_settings')
        .select('is_enabled')
        .eq('setting_key', 'punter_analyses_cron')
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
      .eq('setting_key', 'punter_analyses_cron');

    if (error) {
      toast.error('Erro ao alterar configuração');
    } else {
      setEnabled(newValue);
      toast.success(
        newValue
          ? '▶️ Análises ATIVADAS — pré-live Punter (Favorito + AH + Geral + Anthropic) liberadas'
          : '⏸️ Análises DESATIVADAS — crons pré-live do Punter pausados',
      );
    }
    setToggling(false);
  };

  if (loading) return null;

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      title={enabled
        ? 'Kill switch GLOBAL ligado: crons pré-live do Punter ativos. Clique para pausar.'
        : 'Kill switch GLOBAL desligado: crons pré-live do Punter pausados. Clique para ativar.'}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
        enabled
          ? 'border-success/50 bg-success/10 text-success hover:bg-success/20'
          : 'border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground',
      )}
    >
      {enabled ? (
        <>
          <Brain className="w-3.5 h-3.5 animate-pulse" />
          ANÁLISES ON
        </>
      ) : (
        <>
          <Pause className="w-3.5 h-3.5" />
          ATIVAR ANÁLISES
        </>
      )}
    </button>
  );
}
