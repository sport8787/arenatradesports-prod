import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, ChevronRight, Settings2 } from 'lucide-react';
import { useLiveMatches } from '@/hooks/useLiveMatches';
import { loadUserPlans, evaluatePlan, logUserPlanSignal, type UserMarket } from '@/lib/userTraderPlan';

const MARKET_LABEL: Record<UserMarket, string> = {
  '1x2': '1X2',
  over_under: 'O/U',
  btts: 'BTTS',
  corners: 'Esc',
};

export default function MeusSinaisPanel() {
  const navigate = useNavigate();
  const { matches } = useLiveMatches();
  const [showDetails, setShowDetails] = useState(false);

  // Recarrega plans a cada render (já é localStorage, custo zero) — assim refresca quando o user edita.
  const plans = loadUserPlans();
  const activeMarkets = (Object.keys(plans) as UserMarket[]).filter((m) => plans[m]?.enabled);

  const hits = useMemo(() => {
    if (activeMarkets.length === 0) return [];
    const out: Array<{ matchId: string; home: string; away: string; minute: number; score: string; league: string; market: UserMarket; label: string; odd: number | null; reasons: string[]; outcome: string; line: number | null; commence_time?: string | null }> = [];
    for (const lm of matches) {
      if (lm.status !== 'live' && lm.status !== 'halftime') continue;
      if ((lm.match_id || '').startsWith('sim_')) continue;
      for (const m of activeMarkets) {
        const plan = plans[m]!;
        const res = evaluatePlan(lm, plan);
        if (res.passed) {
          out.push({
            matchId: lm.match_id,
            home: lm.home_team,
            away: lm.away_team,
            minute: lm.minute ?? 0,
            score: `${lm.score_home ?? 0}x${lm.score_away ?? 0}`,
            league: lm.championship,
            market: m,
            label: res.market_label,
            odd: res.selected_odd,
            reasons: res.reasons,
            outcome: plan.outcome,
            line: plan.line ?? null,
            commence_time: (lm as any).commence_time ?? null,
          });
        }
      }
    }
    return out;
  }, [matches, activeMarkets.join(','), JSON.stringify(plans)]); // refresca quando plano muda

  // Loga sinais aprovados no Supabase (idempotente por user+match+market+outcome).
  useEffect(() => {
    for (const h of hits) {
      void logUserPlanSignal({
        match_id: h.matchId,
        match_name: `${h.home} x ${h.away}`,
        league: h.league,
        market: h.market,
        outcome: h.outcome as any,
        line: h.line,
        market_label: h.label,
        selected_odd: h.odd,
        minute: h.minute,
        reasons: h.reasons,
        commence_time: h.commence_time ?? null,
      });
    }
  }, [hits]);

  if (activeMarkets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Meus Sinais (plano pessoal)</p>
            <p className="text-[12px] text-muted-foreground">Configure seus critérios e o Mycroft filtra ao vivo só para você.</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/arena-trader-sports/meu-plano')}
          className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
        >
          <Settings2 className="w-3.5 h-3.5" /> Configurar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-card/60">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-foreground">Meus Sinais</span>
          <span className="text-[11px] text-muted-foreground">
            ({activeMarkets.length} mercado{activeMarkets.length > 1 ? 's' : ''} ativo{activeMarkets.length > 1 ? 's' : ''} · {hits.length} aprovação{hits.length === 1 ? '' : 'ões'})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowDetails((v) => !v)} className="text-[11px] text-muted-foreground hover:text-foreground">
            {showDetails ? 'Ocultar critérios' : 'Ver critérios'}
          </button>
          <button onClick={() => navigate('/arena-trader-sports/meu-plano')} className="text-[11px] text-primary hover:underline flex items-center gap-1">
            <Settings2 className="w-3 h-3" /> Editar
          </button>
        </div>
      </div>

      {hits.length === 0 ? (
        <div className="px-4 py-3 text-[12px] text-muted-foreground">
          Nenhum jogo ao vivo atende seus critérios neste momento.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {hits.map((h, i) => (
            <button
              key={`${h.matchId}-${h.market}-${i}`}
              onClick={() => navigate(`/arena-trader-sports/jogo/${h.matchId}`)}
              className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-foreground truncate">{h.home}</span>
                  <span className="text-muted-foreground">{h.score}</span>
                  <span className="font-semibold text-foreground truncate">{h.away}</span>
                  <span className="ml-2 text-[10px] font-mono text-destructive">{h.minute}'</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] uppercase font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {MARKET_LABEL[h.market]} · {h.label}
                  </span>
                  {h.odd != null && (
                    <span className="text-[10px] font-mono text-success">@ {h.odd.toFixed(2)}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground truncate">{h.league}</span>
                </div>
                {showDetails && h.reasons.length > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                    {h.reasons.join(' · ')}
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
