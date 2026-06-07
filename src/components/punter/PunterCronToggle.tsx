import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Target, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PunterCronToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('cron_settings')
        .select('is_enabled')
        .eq('setting_key', 'punter_cron')
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
      .eq('setting_key', 'punter_cron');

    if (error) {
      toast.error('Erro ao alterar configuração');
    } else {
      setEnabled(newValue);
      toast.success(
        newValue
          ? '▶️ Crons Punter ATIVADOS — análise automática pré-jogo ligada'
          : '⏸️ Crons Punter DESATIVADOS — use os botões manuais para analisar'
      );
    }
    setToggling(false);
  };

  if (loading) return null;

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      title={
        enabled
          ? 'Crons Punter ativos: prelive-favorito + prelive-geral + extra-markets + cards. Clique para pausar.'
          : 'Crons Punter pausados. Análise manual disponível nos botões abaixo. Clique para ativar.'
      }
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
        enabled
          ? 'border-yellow-500/60 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
          : 'border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground'
      )}
    >
      {enabled ? (
        <>
          <Target className="w-3.5 h-3.5 animate-pulse" />
          PUNTER ON
        </>
      ) : (
        <>
          <Pause className="w-3.5 h-3.5" />
          PUNTER OFF
        </>
      )}
    </button>
  );
}
