import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Signal } from '@/pages/Historico';

interface SignalCardProps {
  signal: Signal;
  index: number;
}

const verdictConfig = {
  APROVADO: { bg: 'bg-success/15', border: 'border-success/30', text: 'text-success', label: '✅ APROVADO' },
  VETADO: { bg: 'bg-muted/15', border: 'border-muted/30', text: 'text-muted-foreground', label: '💀 JOGO MORTO' },
  JOGO_MORTO: { bg: 'bg-muted/15', border: 'border-muted/30', text: 'text-muted-foreground', label: '💀 JOGO MORTO' },
  LABAREDA: { bg: 'bg-[#7C2D12]/15', border: 'border-[#F97316]/30', text: 'text-[#FB923C]', label: '⚡ LABAREDA' },
  CUIDADO: { bg: 'bg-primary/15', border: 'border-primary/30', text: 'text-primary', label: '⚠️ CUIDADO' },
  AGUARDAR: { bg: 'bg-primary/15', border: 'border-primary/30', text: 'text-primary', label: '⏸️ AGUARDAR' },
};

export default function SignalCard({ signal, index }: SignalCardProps) {
  const v = verdictConfig[signal.verdict];
  const date = new Date(signal.date);
  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card border border-border rounded-xl p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold', v.bg, v.border, v.text, 'border')}>
          {v.label}
        </span>
        <span className="text-xs text-muted-foreground">{dateStr} {timeStr}</span>
      </div>

      {/* Match Info */}
      <div>
        <p className="font-bold text-foreground">⚽ {signal.match}</p>
        <p className="text-sm text-muted-foreground">📊 {signal.market} @ {signal.odd.toFixed(2)}</p>
        <p className="text-sm text-muted-foreground">💪 Confiança: {signal.confidence}%</p>
      </div>

      <div className="border-t border-border pt-3 space-y-1">
        {signal.verdict === 'VETADO' ? (
          <>
            <p className="text-xs text-muted-foreground">Mycroft VETOU esta entrada.</p>
            {signal.reason && <p className="text-xs text-muted-foreground">Motivo: {signal.reason}</p>}
            {signal.followedAdvice !== undefined && (
              <p className="text-xs">
                Você seguiu? {signal.followedAdvice
                  ? <span className="text-success font-medium">SIM ✅ (Não entrou = correto)</span>
                  : <span className="text-destructive font-medium">NÃO ❌ (Entrou contra o veto)</span>
                }
              </p>
            )}
          </>
        ) : signal.verdict === 'AGUARDAR' ? (
          <p className="text-xs text-primary font-medium">⏳ Jogo em andamento...</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Você entrou? {signal.userEntered
                ? <span className="text-success font-medium">SIM ✅ (R$ {signal.stakeAmount?.toFixed(2)})</span>
                : <span className="text-destructive font-medium">NÃO ❌</span>
              }
            </p>
            {signal.result && signal.result !== 'PENDING' && (
              <div className="flex items-center gap-3">
                <span className={cn('text-sm font-bold', signal.result === 'GREEN' ? 'text-success' : 'text-destructive')}>
                  Resultado: {signal.result} {signal.result === 'GREEN' ? '🎉' : '😞'}
                </span>
                {signal.userEntered && signal.profit !== undefined && (
                  <span className={cn('text-sm font-orbitron font-bold', signal.profit >= 0 ? 'text-success' : 'text-destructive')}>
                    {signal.profit >= 0 ? '+' : ''}R$ {signal.profit.toFixed(2)} ({signal.profitPercent}%)
                  </span>
                )}
              </div>
            )}
            {!signal.userEntered && signal.result === 'GREEN' && signal.missedProfit !== undefined && signal.missedProfit > 0 && (
              <p className="text-xs text-destructive font-medium mt-1">
                ⚠️ Oportunidade perdida: -R$ {signal.missedProfit.toFixed(2)}
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
