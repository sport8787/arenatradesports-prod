import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, TrendingDown, Zap, Shield, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MarketAnalysis {
  id: string;
  match_id: string;
  market: string;
  prob_model: number;
  prob_market: number;
  market_inefficiency_score: number | null;
  inefficiency_level: string | null;
  odds_drift_index: number | null;
  odd_open: number | null;
  odd_current: number | null;
  analyzed_at: string | null;
}

interface SharpSignal {
  id: string;
  match_id: string;
  market: string;
  has_rlm: boolean;
  has_steam: boolean;
  has_consensus: boolean;
  sharp_activity_score: number;
  odd_movement_pct: number | null;
  detected_at: string | null;
}

export default function MarketDetectorsPanel() {
  const [marketData, setMarketData] = useState<MarketAnalysis[]>([]);
  const [sharpData, setSharpData] = useState<SharpSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [mRes, sRes] = await Promise.all([
      supabase.from('market_analysis').select('*').order('analyzed_at', { ascending: false }).limit(20),
      supabase.from('sharp_money_signals').select('*').order('detected_at', { ascending: false }).limit(20),
    ]);
    setMarketData((mRes.data as any[]) || []);
    setSharpData((sRes.data as any[]) || []);
    setLoading(false);
  }

  async function runScan() {
    setScanning(true);
    try {
      const [mmdRes, sharpRes] = await Promise.all([
        supabase.functions.invoke('market-manipulation-detector', { body: {} }),
        supabase.functions.invoke('sharp-money-detector', { body: {} }),
      ]);
      if (mmdRes.error) throw mmdRes.error;
      if (sharpRes.error) throw sharpRes.error;
      
      const mmdData = mmdRes.data;
      const sharpDataRes = sharpRes.data;
      
      toast.success(`Scan concluído: ${mmdData?.suspicious_count || 0} suspeitos, ${sharpDataRes?.steam_count || 0} steam moves`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao executar scan');
    } finally {
      setScanning(false);
    }
  }

  const misLevelConfig = (level: string | null) => {
    switch (level) {
      case 'extreme': return { color: 'text-destructive', bg: 'bg-destructive/10', label: 'EXTREMO' };
      case 'strong': return { color: 'text-warning', bg: 'bg-warning/10', label: 'FORTE' };
      case 'light': return { color: 'text-primary', bg: 'bg-primary/10', label: 'LEVE' };
      default: return { color: 'text-muted-foreground', bg: 'bg-muted/10', label: 'RUÍDO' };
    }
  };

  const sharpLevelConfig = (score: number) => {
    if (score >= 40) return { color: 'text-destructive', label: 'STEAM PRO', icon: Zap };
    if (score >= 25) return { color: 'text-warning', label: 'SHARP', icon: Activity };
    if (score >= 10) return { color: 'text-primary', label: 'ATIVIDADE', icon: TrendingDown };
    return { color: 'text-muted-foreground', label: 'NORMAL', icon: Shield };
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-24 bg-muted/20 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  const hasData = marketData.length > 0 || sharpData.length > 0;
  const strongMIS = marketData.filter(m => m.inefficiency_level === 'strong' || m.inefficiency_level === 'extreme').length;
  const suspiciousODI = marketData.filter(m => (m.odds_drift_index || 0) > 15).length;
  const sharpSignals = sharpData.filter(s => s.sharp_activity_score >= 25).length;
  const steamMoves = sharpData.filter(s => s.has_steam).length;

  return (
    <div className="space-y-4">
      {/* Scan button */}
      <button
        onClick={runScan}
        disabled={scanning}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-xs font-mono font-bold transition-all",
          scanning
            ? "border-primary/30 bg-primary/5 text-primary cursor-wait"
            : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
        )}
      >
        {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {scanning ? 'SCANNING MMD + SHARP MONEY...' : 'EXECUTAR SCAN AUTOMÁTICO'}
      </button>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SummaryCard label="MIS Forte+" value={strongMIS} icon={<AlertTriangle className="w-3 h-3" />} color="text-warning" />
        <SummaryCard label="ODI Suspeito" value={suspiciousODI} icon={<TrendingDown className="w-3 h-3" />} color="text-destructive" />
        <SummaryCard label="Sharp Money" value={sharpSignals} icon={<Zap className="w-3 h-3" />} color="text-primary" />
        <SummaryCard label="Steam Moves" value={steamMoves} icon={<Activity className="w-3 h-3" />} color="text-warning" />
      </div>

      {!hasData && (
        <div className="border border-border rounded-lg bg-card p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground font-mono">Nenhum dado de detecção ainda.</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-1">Clique em "Executar Scan" para analisar odds atuais.</p>
        </div>
      )}

      {/* MIS + ODI entries */}
      {marketData.filter(m => m.inefficiency_level !== 'noise').slice(0, 8).map((item) => {
        const cfg = misLevelConfig(item.inefficiency_level);
        const matchName = item.match_id.replace(/_/g, ' ').split(' ').slice(0, -1).join(' ');
        return (
          <motion.div key={item.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="border border-border rounded-lg bg-card p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[60%]">{matchName}</span>
              <span className={cn('text-[9px] font-mono font-bold px-1.5 py-0.5 rounded', cfg.bg, cfg.color)}>
                MIS {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-muted-foreground">MIS: </span>
                <span className={cfg.color}>{(item.market_inefficiency_score || 0).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">ODI: </span>
                <span className={(item.odds_drift_index || 0) > 15 ? 'text-destructive' : 'text-foreground'}>
                  {(item.odds_drift_index || 0).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Mercado: </span>
                <span className="text-foreground">{item.market}</span>
              </div>
            </div>
            {item.prob_model > 0 && (
              <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground mt-1">
                <span>Modelo: {item.prob_model.toFixed(1)}%</span>
                <span>Mercado: {item.prob_market.toFixed(1)}%</span>
                <span>Gap: {Math.abs(item.prob_model - item.prob_market).toFixed(1)}%</span>
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Sharp Money entries */}
      {sharpData.filter(s => s.sharp_activity_score >= 10).slice(0, 8).map((item) => {
        const cfg = sharpLevelConfig(item.sharp_activity_score);
        const Icon = cfg.icon;
        const matchName = item.match_id.replace(/_/g, ' ').split(' ').slice(0, -1).join(' ');
        return (
          <motion.div key={item.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="border border-border rounded-lg bg-card p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Icon className={cn('w-3 h-3', cfg.color)} />
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[50%]">{matchName}</span>
              </div>
              <span className={cn('text-[9px] font-mono font-bold', cfg.color)}>
                SHARP {item.sharp_activity_score}/100
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className={item.has_rlm ? 'text-warning' : 'text-muted-foreground'}>
                RLM: {item.has_rlm ? '✅' : '—'}
              </span>
              <span className={item.has_steam ? 'text-destructive' : 'text-muted-foreground'}>
                Steam: {item.has_steam ? '✅' : '—'}
              </span>
              <span className={item.has_consensus ? 'text-success' : 'text-muted-foreground'}>
                Consenso: {item.has_consensus ? '✅' : '—'}
              </span>
              {item.odd_movement_pct && (
                <span className="text-muted-foreground">
                  Mov: {item.odd_movement_pct.toFixed(1)}%
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="border border-border rounded-lg bg-card p-2.5 text-center">
      <div className={cn('flex items-center justify-center gap-1 mb-1', color)}>
        {icon}
        <span className="font-mono text-lg font-bold">{value}</span>
      </div>
      <span className="font-mono text-[9px] text-muted-foreground tracking-wider">{label}</span>
    </div>
  );
}
