import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Activity, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import QuietWindowBadge from '@/components/arena-trader/QuietWindowBadge';

export default function LiveCronToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    loadSetting();
  }, []);

  const loadSetting = async () => {
    const { data } = await supabase
      .from('cron_settings')
      .select('is_enabled')
      .eq('setting_key', 'live_matches_cron')
      .maybeSingle();
    setEnabled(data?.is_enabled ?? false);
    setLoading(false);
  };

  const toggle = async () => {
    setToggling(true);
    const newValue = !enabled;
    const { error } = await supabase
      .from('cron_settings')
      .update({ is_enabled: newValue, updated_at: new Date().toISOString() })
      .eq('setting_key', 'live_matches_cron');

    if (error) {
      toast.error('Erro ao alterar configuração');
    } else {
      setEnabled(newValue);
      toast.success(newValue
        ? '▶️ Pipeline AO VIVO ATIVADO — Trader + Alavanca + Eventos Raros + Steam'
        : '⏸️ Pipeline AO VIVO DESATIVADO — todos os consumidores live pausados');
    }
    setToggling(false);
  };

  if (loading) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={toggle}
        disabled={toggling}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all",
          enabled
            ? "border-success/50 bg-success/10 text-success hover:bg-success/20"
            : "border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground"
        )}
      >
        {enabled ? (
          <>
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            LIVE ON
          </>
        ) : (
          <>
            <Pause className="w-3.5 h-3.5" />
            LIVE OFF
          </>
        )}
      </button>
      {enabled && <QuietWindowBadge />}
    </div>
  );
}
