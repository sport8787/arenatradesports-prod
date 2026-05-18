import { useEffect, useState } from 'react';
import { smartOddsScannerService, type ScanResult } from '@/services/smartOddsScannerService';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function SmartOddsScannerPanel() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await smartOddsScannerService.scanLive('soccer');
        if (!cancelled) setResult(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Erro ao carregar scan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const opportunities = result?.opportunities || [];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold text-foreground">SMART ODDS SCANNER</span>
        </div>
        <button
          onClick={scanLive}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          {loading ? 'ESCANEANDO...' : 'SCAN CROSS-BOOK'}
        </button>
      </div>

      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}

      {!result && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6 font-mono">
          Detecta spreads de valor entre bookmakers em tempo real
        </p>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/30 rounded-lg p-2 border border-border text-center">
              <p className="text-[9px] font-mono text-muted-foreground">EVENTOS</p>
              <p className="text-lg font-mono font-bold text-foreground">{result.total_events || 0}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2 border border-border text-center">
              <p className="text-[9px] font-mono text-muted-foreground">OPORTUNIDADES</p>
              <p className="text-lg font-mono font-bold text-primary">{result.total_opportunities || opportunities.length}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2 border border-border text-center">
              <p className="text-[9px] font-mono text-muted-foreground">MERCADOS</p>
              <p className="text-lg font-mono font-bold text-foreground">{result.total_markets || 0}</p>
            </div>
          </div>

          {/* Best Value */}
          {result.best_value && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <p className="text-[10px] font-mono text-green-400 mb-1">🔥 MELHOR OPORTUNIDADE</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-foreground">{result.best_value.market}</span>
                <span className="text-xs font-mono font-bold text-green-400">
                  {result.best_value.best_bookmaker} @ {result.best_value.best_odd.toFixed(2)}
                </span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                Spread: {result.best_value.spread_pct.toFixed(1)}% | {result.best_value.bookmaker_count} books
              </p>
            </div>
          )}

          {/* Opportunities List */}
          {opportunities.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2">OPORTUNIDADES DETECTADAS</p>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {opportunities.slice(0, 10).map((opp, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 border border-border">
                    <div>
                      <span className="text-[10px] font-mono text-foreground">{opp.market}</span>
                      <span className={cn("ml-2 text-[9px] font-mono", smartOddsScannerService.getSignalColor(opp.signal))}>
                        {smartOddsScannerService.getSignalBadge(opp.signal)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono font-bold text-foreground">
                        {opp.best_bookmaker} @ {opp.best_odd.toFixed(2)}
                      </p>
                      <p className="text-[9px] font-mono text-muted-foreground">
                        Spread {opp.spread_pct.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {opportunities.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 font-mono">
              Nenhuma oportunidade encontrada no momento
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}
