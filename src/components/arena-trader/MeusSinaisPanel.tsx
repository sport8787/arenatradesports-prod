import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, ChevronRight, Settings2 } from 'lucide-react';
import { useLiveMatches } from '@/hooks/useLiveMatches';
import { loadUserPlans, evaluatePlan, logUserPlanSignal, type UserMarket, type UserPlan } from '@/lib/userTraderPlan';
import { onRevalidate } from '@/utils/visibilityManager';

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
  const [plans, setPlans] = useState<UserPlan[]>([]);

  useEffect(() => {
    let cancel = false;
    const syncPlans = async () => {
      const rows = await loadUserPlans();
      if (!cancel) setPlans(rows);
    };
    void syncPlans();
    const stopRevalidate = onRevalidate(() => {
      void syncPlans();
    });
    return () => {
      cancel = true;
      stopRevalidate();
    };
  }, []);

  const activePlans = useMemo(() => plans.filter((p) => p.enabled), [plans]);

  const hits = useMemo(() => {
    if (activePlans.length === 0) return [];
    const out: Array<{
      key: string; matchId: string; home: string; away: string; minute: number; score: string; league: string;
      market: UserMarket; label: string; odd: number | null; reasons: string[]; outcome: string; line: number | null;
      commence_time?: string | null; tier: 'APROVADO' | 'APROVADO_CONF_REDUZIDA'; missing: string[];
      planId: string; planName: string;
    }> = [];
    for (const lm of matches) {
      if (lm.status !== 'live' && lm.status !== 'halftime') continue;
      if ((lm.match_id || '').startsWith('sim_')) continue;
      for (const plan of activePlans) {
        const res = evaluatePlan(lm, plan);
        if (res.passed) {
          out.push({
            key: `${lm.match_id}-${plan.id}`,
            matchId: lm.match_id,
            home: lm.home_team,
            away: lm.away_team,
            minute: lm.minute ?? 0,
            score: `${lm.score_home ?? 0}x${lm.score_away ?? 0}`,
            league: lm.championship,
            market: plan.market,
            label: res.market_label,
            odd: res.selected_odd,
            reasons: res.reasons,
            outcome: plan.outcome,
            line: plan.line ?? null,
            commence_time: (lm as any).commence_time ?? null,
            tier: res.tier,
            missing: res.missing_stats,
            planId: plan.id,
            planName: plan.name,
          });
        }
      }
    }
    return out;
  }, [matches, activePlans]);

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
        reasons: h.tier === 'APROVADO_CONF_REDUZIDA'
          ? [...h.reasons, `⚠ conf. reduzida: dados ausentes (${h.missing.join(', ')})`]
          : h.reasons,
        commence_time: h.commence_time ?? null,
        plan_id: h.planId,
        plan_name: h.planName,
      });
    }
  }, [hits]);

  if (activePlans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Meus Métodos (método pessoal)</p>
            <p className="text-[12px] text-muted-foreground">
              {plans.length === 0
                ? 'Crie seus próprios métodos de operar e o Mycroft filtra ao vivo só para você.'
                : `Você tem ${plans.length} método(s) salvo(s), mas nenhum está ativo.`}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/arena-trader-sports/meu-plano')}
          className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
        >
          <Settings2 className="w-3.5 h-3.5" /> {plans.length === 0 ? 'Criar método' : 'Gerenciar'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-card/60">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-foreground">Meus Métodos</span>
          <span className="text-[11px] text-muted-foreground">
            ({activePlans.length} plano{activePlans.length > 1 ? 's' : ''} ativo{activePlans.length > 1 ? 's' : ''} · {hits.length} aprovaç{hits.length === 1 ? 'ão' : 'ões'})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowDetails((v) => !v)} className="text-[11px] text-muted-foreground hover:text-foreground">
            {showDetails ? 'Ocultar critérios' : 'Ver critérios'}
          </button>
          <button onClick={() => navigate('/arena-trader-sports/meu-plano')} className="text-[11px] text-primary hover:underline flex items-center gap-1">
            <Settings2 className="w-3 h-3" /> Gerenciar
          </button>
        </div>
      </div>

      {hits.length === 0 ? (
        <div className="px-4 py-4 space-y-2">
          <p className="text-sm font-medium text-foreground">⏳ Ainda não há operações aprovadas pelos seus métodos.</p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Varrendo {matches.filter(m => (m.status === 'live' || m.status === 'halftime') && !(m.match_id || '').startsWith('sim_')).length} jogo(s) ao vivo.
            Nenhum atendeu aos critérios dos métodos: {activePlans.map((p) => p.name).join(', ')}.
          </p>
          <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
            <li>A lista atualiza sozinha a cada 30s.</li>
            <li>Se estiver muito restritivo, edite em <button onClick={() => navigate('/arena-trader-sports/meu-plano')} className="text-primary hover:underline">Meus Métodos</button>.</li>
          </ul>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {hits.map((h) => (
            <button
              key={h.key}
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
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] uppercase font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded" title={h.planName}>
                    {h.planName}
                  </span>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                    {MARKET_LABEL[h.market]} · {h.label}
                  </span>
                  {h.tier === 'APROVADO' ? (
                    <span className="text-[10px] uppercase font-mono text-success bg-success/10 px-1.5 py-0.5 rounded">✓ APROVADO</span>
                  ) : (
                    <span className="text-[10px] uppercase font-mono text-warning bg-warning/10 px-1.5 py-0.5 rounded" title={`Dados ausentes: ${h.missing.join(', ')}`}>
                      ⚠ APROVADO · CONF. REDUZIDA
                    </span>
                  )}
                  {h.odd != null && <span className="text-[10px] font-mono text-success">@ {h.odd.toFixed(2)}</span>}
                  <span className="text-[10px] text-muted-foreground truncate">{h.league}</span>
                </div>
                {showDetails && h.reasons.length > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                    {h.reasons.join(' · ')}
                    {h.missing.length > 0 && <span className="text-warning"> · faltando: {h.missing.join(', ')}</span>}
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
