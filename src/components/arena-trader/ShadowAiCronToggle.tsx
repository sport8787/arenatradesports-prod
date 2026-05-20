import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brain, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ShadowAiCronToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('cron_settings')
        .select('is_enabled')
        .eq('setting_key', 'shadow_ai_cron')
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
      .eq('setting_key', 'shadow_ai_cron');

    if (error) {
      toast.error('Erro ao alterar configuração');
    } else {
      setEnabled(newValue);
      toast.success(
        newValue
          ? '🤖 Shadow AI ATIVADO — análise paralela com Gemini'
          : '⏸️ Shadow AI DESATIVADO — economizando créditos Lovable AI',
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
          ? 'border-violet-500/60 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20'
          : 'border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground',
      )}
      title="Ativa/desativa análise paralela com IA Gemini (Lovable AI)"
    >
      {enabled ? (
        <>
          <Brain className="w-3.5 h-3.5 animate-pulse" />
          SHADOW AI ON
        </>
      ) : (
        <>
          <Pause className="w-3.5 h-3.5" />
          SHADOW AI OFF
        </>
      )}
    </button>
  );
}
