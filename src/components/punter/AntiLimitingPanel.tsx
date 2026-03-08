import { useState } from 'react';
import { antiLimitingService, type AntiLimitInput, type AntiLimitResult } from '@/services/antiLimitingService';
import { ShieldAlert, RefreshCw, Clock, DollarSign, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const BOOKMAKERS = ['bet365', 'betfair', 'pinnacle', '1xbet', 'betway', 'novibet', 'sportingbet', 'pixbet', 'estrelabet'];

export default function AntiLimitingPanel() {
  const [result, setResult] = useState<AntiLimitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    original_stake: 50,
    market: 'Over 2.5',
    odd: 1.90,
    bookmaker: 'bet365',
    asset_score: 75,
    recent_bets_same_bookmaker: 3,
  });

  async function analyze() {
    setLoading(true);
    setError('');
    try {
      const data = await antiLimitingService.analyze({
        ...form,
        bookmakers_available: BOOKMAKERS,
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-primary" />
        <span className="font-mono text-xs font-bold text-foreground">ANTI-LIMITING ENGINE</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">STAKE (R$)</label>
          <input type="number" value={form.original_stake} onChange={e => setForm(f => ({ ...f, original_stake: Number(e.target.value) }))}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">ODD</label>
          <input type="number" value={form.odd} onChange={e => setForm(f => ({ ...f, odd: Number(e.target.value) }))} step={0.01}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">BOOKMAKER</label>
          <select value={form.bookmaker} onChange={e => setForm(f => ({ ...f, bookmaker: e.target.value }))}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            {BOOKMAKERS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">BETS RECENTES (SAME BOOK)</label>
          <input type="number" value={form.recent_bets_same_bookmaker}
            onChange={e => setForm(f => ({ ...f, recent_bets_same_bookmaker: Number(e.target.value) }))}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      <button onClick={analyze} disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50">
        <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
        {loading ? 'ANALISANDO...' : 'ANALISAR RISCO'}
      </button>

      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Stealth + Risk */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
              <Eye className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-[9px] font-mono text-muted-foreground">STEALTH SCORE</p>
              <p className={cn("text-2xl font-mono font-bold", antiLimitingService.getStealthColor(result.stealth_score))}>
                {result.stealth_score}
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
              <ShieldAlert className="w-5 h-5 mx-auto mb-1 text-accent" />
              <p className="text-[9px] font-mono text-muted-foreground">RISCO LIMITING</p>
              <p className={cn("text-sm font-mono font-bold", antiLimitingService.getRiskColor(result.risk_profile.limiting_risk))}>
                {result.risk_profile.limiting_risk}
              </p>
              <p className="text-[9px] text-muted-foreground">Score: {result.risk_profile.risk_score}</p>
            </div>
          </div>

          {/* Delay */}
          <div className="bg-muted/30 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-mono font-bold text-foreground">DELAY RECOMENDADO</span>
            </div>
            <p className="text-lg font-mono font-bold text-primary">
              {Math.round(result.delay.recommended_delay_seconds / 60)} min
            </p>
            <p className="text-[9px] font-mono text-muted-foreground">{result.delay.reason}</p>
          </div>

          {/* Stake */}
          <div className="bg-muted/30 rounded-lg p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-mono font-bold text-foreground">STAKE CAMUFLADO</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-muted-foreground line-through">R${result.stake.original_stake}</span>
              <span className="text-lg font-mono font-bold text-primary">R${result.stake.adjusted_stake}</span>
              <span className="text-[9px] font-mono text-muted-foreground">
                (range: R${result.stake.noise_range[0]} – R${result.stake.noise_range[1]})
              </span>
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-1">{result.stake.reason}</p>
          </div>

          {/* Diversification */}
          <div className="bg-muted/30 rounded-lg p-3 border border-border">
            <p className="text-[10px] font-mono font-bold text-foreground mb-2">DIVERSIFICAÇÃO</p>
            {result.diversification.alternative_bookmakers.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {result.diversification.alternative_bookmakers.map((b, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[9px] font-mono text-primary">{b}</span>
                ))}
              </div>
            )}
            <p className="text-[9px] font-mono text-muted-foreground">{result.diversification.bet_frequency_advice}</p>
            {result.diversification.mug_bet_suggestion && (
              <div className="mt-2 p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
                <p className="text-[9px] font-mono text-yellow-400">🎭 MUG BET: {result.diversification.mug_bet_suggestion.market}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{result.diversification.mug_bet_suggestion.reason}</p>
              </div>
            )}
          </div>

          {/* Risk Factors */}
          {result.risk_profile.risk_factors.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground">FATORES DE RISCO</p>
              {result.risk_profile.risk_factors.map((f, i) => (
                <p key={i} className="text-[9px] font-mono text-red-400/80">⚠ {f}</p>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {result.risk_profile.recommendations.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground">RECOMENDAÇÕES</p>
              {result.risk_profile.recommendations.map((r, i) => (
                <p key={i} className="text-[9px] font-mono text-primary/80">💡 {r}</p>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
