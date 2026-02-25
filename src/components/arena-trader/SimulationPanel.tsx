import { useState, useEffect, useCallback, useRef } from 'react';
import { FlaskConical, RefreshCw, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import GoldButton from '@/components/game/GoldButton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SimulationPanelProps {
  onFetched?: () => void;
}

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function SimulationPanel({ onFetched }: SimulationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [nextFetchIn, setNextFetchIn] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSimulation = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-simulation-matches');
      if (error) throw error;
      toast.success(`${data.total_matches} jogos sincronizados, ${data.analyzed} analisados`);
      setLastFetch(new Date());
      onFetched?.();
    } catch (e) {
      console.error('Simulation fetch error:', e);
      toast.error('Erro ao buscar jogos simulados');
    } finally {
      setLoading(false);
    }
  }, [onFetched]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      // Fetch immediately when toggled on
      fetchSimulation();
      setNextFetchIn(AUTO_REFRESH_INTERVAL / 1000);

      intervalRef.current = setInterval(() => {
        fetchSimulation();
        setNextFetchIn(AUTO_REFRESH_INTERVAL / 1000);
      }, AUTO_REFRESH_INTERVAL);

      countdownRef.current = setInterval(() => {
        setNextFetchIn(prev => (prev && prev > 0 ? prev - 1 : AUTO_REFRESH_INTERVAL / 1000));
      }, 1000);
    } else {
      setNextFetchIn(null);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, fetchSimulation]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-xl border border-border bg-card/50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-orbitron text-sm font-bold text-foreground">Modo Simulado</h2>
          <p className="text-xs text-muted-foreground">
            Dados da API Futebol DEV — mesma lógica do modo ao vivo
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Auto-refresh toggle */}
        <div className="flex items-center gap-2">
          <Switch
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
            aria-label="Auto-refresh a cada 5 minutos"
          />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">Auto (5min)</span>
            {autoRefresh && nextFetchIn !== null && (
              <span className="text-[10px] text-muted-foreground font-mono">
                Próx: {formatCountdown(nextFetchIn)}
              </span>
            )}
          </div>
          {autoRefresh && (
            <span className="text-[10px] text-success font-bold uppercase tracking-wider animate-pulse">
              ATIVO
            </span>
          )}
        </div>

        {/* Manual fetch button */}
        <GoldButton size="sm" onClick={fetchSimulation} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
          {loading ? 'Buscando...' : 'Buscar Jogos'}
        </GoldButton>

        {lastFetch && (
          <span className="text-[10px] text-muted-foreground hidden md:inline">
            Último: {lastFetch.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
