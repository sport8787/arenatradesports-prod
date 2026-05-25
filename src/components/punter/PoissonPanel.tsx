import { useState } from 'react';
import { poissonService, type PoissonInput, type PoissonResult } from '@/services/poissonService';
import { Calculator, RefreshCw, Target, Info, HelpCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Info className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-[10px] font-mono leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function PoissonPanel() {
  const [result, setResult] = useState<PoissonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeXg, setHomeXg] = useState(1.5);
  const [awayXg, setAwayXg] = useState(1.2);
  const [explainOpen, setExplainOpen] = useState(false);

  async function calculate() {
    if (!homeTeam || !awayTeam) return;
    setLoading(true);
    setError('');
    try {
      const data = await poissonService.calculate({
        home_team: homeTeam,
        away_team: awayTeam,
        home_xg: homeXg,
        away_xg: awayXg,
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Erro no cálculo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold text-foreground">POISSON / DIXON-COLES</span>
        </div>
        <button
          onClick={() => setExplainOpen(true)}
          className="flex items-center gap-1 px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-md transition-colors"
        >
          <HelpCircle className="w-3 h-3" />
          EXPLICAR
        </button>
      </div>

      <div className="bg-muted/20 border border-border/60 rounded-lg p-2.5">
        <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
          <span className="text-foreground font-semibold">Como ler:</span> os percentuais abaixo são as
          <span className="text-foreground"> probabilidades estimadas do RESULTADO FINAL do jogo</span> (90 min),
          calculadas a partir dos gols esperados (xG). Não representam o que está acontecendo ao vivo.
          Cada <span className="text-foreground">Odd</span> exibida é a <span className="text-foreground">odd justa</span> (= 100 ÷ probabilidade): se a casa pagar acima dela, há valor.
        </p>
      </div>

      {/* Value bet quick example */}
      <div className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-mono font-bold text-foreground">EXEMPLO RÁPIDO — VALUE BET</span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
          Probabilidade do modelo: <span className="text-foreground font-bold">50%</span> → Odd justa = 100 ÷ 50 = <span className="text-foreground font-bold">2.00</span>.
        </p>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          <div className="flex items-start gap-1.5 bg-green-500/10 border border-green-500/30 rounded px-2 py-1.5">
            <TrendingUp className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
            <p className="text-[9px] font-mono text-foreground leading-snug">
              Casa paga <span className="font-bold text-green-400">2.20</span> → <span className="font-bold">+10% de valor</span>. Entrada com edge.
            </p>
          </div>
          <div className="flex items-start gap-1.5 bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5">
            <TrendingDown className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
            <p className="text-[9px] font-mono text-foreground leading-snug">
              Casa paga <span className="font-bold text-red-400">1.80</span> → <span className="font-bold">-10% de valor</span>. Não aposte.
            </p>
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <input value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder="Time Casa"
          className="bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <input value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="Time Fora"
          className="bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">xG Casa (gols esperados)</label>
          <input type="number" value={homeXg} onChange={e => setHomeXg(Number(e.target.value))} step={0.1} min={0}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">xG Fora (gols esperados)</label>
          <input type="number" value={awayXg} onChange={e => setAwayXg(Number(e.target.value))} step={0.1} min={0}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      <button onClick={calculate} disabled={loading || !homeTeam || !awayTeam}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50">
        <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
        {loading ? 'CALCULANDO...' : 'CALCULAR POISSON'}
      </button>

      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* 1X2 */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <p className="text-[10px] font-mono text-muted-foreground">
                RESULTADO FINAL (1X2) — <span className="text-foreground/80">probabilidade de cada desfecho ao fim dos 90 min</span>
              </p>
              <InfoTip text="Chance estimada de cada desfecho final (90 min). Soma ≈ 100%. A 'odd justa' é o preço mínimo que a casa deveria pagar para a entrada valer a pena (= 100 ÷ probabilidade)." />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="VITÓRIA CASA" value={`${result.home_win}%`} sub={`Odd justa ${(100 / result.home_win).toFixed(2)}`} color="text-green-400" tip={`Probabilidade de o time da casa vencer ao fim dos 90 min. Se a casa pagar acima de ${(100 / result.home_win).toFixed(2)}, há valor.`} />
              <Stat label="EMPATE" value={`${result.draw}%`} sub={`Odd justa ${(100 / result.draw).toFixed(2)}`} color="text-yellow-400" tip={`Probabilidade de empate no tempo regulamentar. Odd justa = ${(100 / result.draw).toFixed(2)}.`} />
              <Stat label="VITÓRIA FORA" value={`${result.away_win}%`} sub={`Odd justa ${(100 / result.away_win).toFixed(2)}`} color="text-red-400" tip={`Probabilidade de o visitante vencer no tempo regulamentar. Odd justa = ${(100 / result.away_win).toFixed(2)}.`} />
            </div>
          </div>

          {/* Totals */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <p className="text-[10px] font-mono text-muted-foreground">
                TOTAL DE GOLS — <span className="text-foreground/80">probabilidade do jogo terminar com mais que X gols somados</span>
              </p>
              <InfoTip text="Chance de o total de gols (casa + fora) ultrapassar a linha indicada ao fim dos 90 min." />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Mais de 1.5 gols" value={`${result.over_1_5}%`} sub={`Odd justa ${(100 / result.over_1_5).toFixed(2)}`} tip="Chance de o jogo terminar com 2 ou mais gols somados." />
              <Stat label="Mais de 2.5 gols" value={`${result.over_2_5}%`} sub={`Odd justa ${(100 / result.over_2_5).toFixed(2)}`} tip="Chance de o jogo terminar com 3 ou mais gols somados." />
              <Stat label="Mais de 3.5 gols" value={`${result.over_3_5}%`} sub={`Odd justa ${(100 / result.over_3_5).toFixed(2)}`} tip="Chance de o jogo terminar com 4 ou mais gols somados." />
            </div>
          </div>

          {/* BTTS + Lambda */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <p className="text-[10px] font-mono text-muted-foreground">
                AMBOS MARCAM (BTTS) & MÉDIA DE GOLS (λ)
              </p>
              <InfoTip text="BTTS = chance de cada time marcar pelo menos 1 gol. λ = média de gols esperados por time, base do cálculo de Poisson." />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Ambos marcam: SIM" value={`${result.btts_yes}%`} tip="Chance de os DOIS times marcarem ao menos 1 gol no jogo." />
              <Stat label="Ambos marcam: NÃO" value={`${result.btts_no}%`} tip="Chance de pelo menos um dos times NÃO marcar (placar tipo 1-0, 0-0, 2-0...)." />
              <Stat label="λ Casa (gols esp.)" value={String(result.home_lambda)} color="text-primary" tip="Média de gols esperados do time da casa nos 90 min, já ajustada pela força da liga." />
              <Stat label="λ Fora (gols esp.)" value={String(result.away_lambda)} color="text-accent" tip="Média de gols esperados do visitante nos 90 min, já ajustada pela força da liga." />
            </div>
            <p className="text-[9px] font-mono text-muted-foreground/70 mt-1.5 leading-relaxed">
              λ (lambda) é a média de gols esperados por time já ajustada pela liga. É o que alimenta a fórmula de Poisson para gerar todas as probabilidades acima.
            </p>
          </div>

          {/* Most Likely Scores */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[10px] font-mono text-muted-foreground">
                PLACARES EXATOS MAIS PROVÁVEIS — <span className="text-foreground/80">probabilidade de o jogo terminar exatamente nesse resultado</span>
              </p>
              <InfoTip text="Top placares com maior probabilidade segundo o modelo. Mesmo o mais provável costuma ter <15% — placar exato é mercado de odd alta." />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.most_likely_scores.slice(0, 8).map((s, i) => (
                <span key={i} className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-mono border",
                  i === 0 ? "bg-primary/10 border-primary/30 text-primary font-bold" : "bg-muted/30 border-border text-foreground"
                )}>
                  {s.home}-{s.away} ({s.probability}%)
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              COMO LER POISSON / DIXON-COLES
            </DialogTitle>
            <DialogDescription className="text-[11px] font-mono">
              Probabilidade, odd justa e onde está o valor da entrada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-[11px] font-mono leading-relaxed">
            <div className="bg-muted/30 border border-border rounded-lg p-3">
              <p className="text-foreground font-bold mb-1">1. O que é o percentual?</p>
              <p className="text-muted-foreground">
                É a <span className="text-foreground">probabilidade estimada do desfecho</span> ao final dos 90 minutos, calculada pela distribuição de Poisson a partir dos gols esperados (xG) de cada time.
              </p>
            </div>

            <div className="bg-muted/30 border border-border rounded-lg p-3">
              <p className="text-foreground font-bold mb-1">2. O que é a odd justa?</p>
              <p className="text-muted-foreground">
                É o preço mínimo que a entrada deveria pagar para ser neutra (sem lucro nem prejuízo no longo prazo):
              </p>
              <p className="text-center text-primary font-bold my-2">Odd justa = 100 ÷ probabilidade (%)</p>
            </div>

            <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/30 rounded-lg p-3 space-y-2">
              <p className="text-foreground font-bold">3. Exemplo prático</p>
              <p className="text-muted-foreground">
                Modelo diz: vitória da casa = <span className="text-foreground font-bold">50%</span>.<br />
                Odd justa = 100 ÷ 50 = <span className="text-foreground font-bold">2.00</span>.
              </p>
              <div className="space-y-1.5 mt-2">
                <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded p-2">
                  <TrendingUp className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                  <p className="text-foreground">
                    Casa paga <span className="font-bold text-green-400">2.20</span>: <span className="font-bold">há valor (+10%)</span>. A cada R$100 apostados, expectativa é ganhar R$10 no longo prazo.
                  </p>
                </div>
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded p-2">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-foreground">
                    Casa paga <span className="font-bold text-red-400">1.80</span>: <span className="font-bold">não há valor (-10%)</span>. Mesmo se o time vencer, no longo prazo essa entrada perde dinheiro.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 border border-border rounded-lg p-3">
              <p className="text-foreground font-bold mb-1">4. Regra de ouro</p>
              <p className="text-muted-foreground">
                <span className="text-primary font-bold">Aposte apenas quando a odd da casa &gt; odd justa.</span> Esse excedente é o seu <span className="text-foreground">edge</span> — a vantagem matemática que separa apostadores profissionais de apostadores comuns.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, sub, color, tip }: { label: string; value: string; sub?: string; color?: string; tip?: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-2 border border-border text-center relative">
      <div className="flex items-center justify-center gap-1">
        <p className="text-[8px] font-mono text-muted-foreground">{label}</p>
        {tip && <InfoTip text={tip} />}
      </div>
      <p className={cn("text-sm font-mono font-bold", color || "text-foreground")}>{value}</p>
      {sub && <p className="text-[8px] font-mono text-muted-foreground">{sub}</p>}
    </div>
  );
}
