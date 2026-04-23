import { motion } from 'framer-motion';
import { Flame, Users } from 'lucide-react';
import { usePromoSlots } from '@/hooks/usePromoSlots';

interface Props {
  variant?: 'hero' | 'inline' | 'compact';
}

export default function PromoSlotsCounter({ variant = 'inline' }: Props) {
  const { slots_remaining, slots_total, is_active, loading } = usePromoSlots();

  if (loading) return null;

  const taken = slots_total - slots_remaining;
  const pct = Math.min(100, Math.round((taken / slots_total) * 100));
  const urgent = slots_remaining <= 30;
  const critical = slots_remaining <= 10;

  if (!is_active || slots_remaining === 0) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-sm font-bold">
        <Flame className="w-4 h-4" /> VAGAS ESGOTADAS — Entre na lista de espera
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${urgent ? 'text-red-400' : 'text-yellow-400'}`}>
        <Users className="w-3.5 h-3.5" />
        {slots_remaining}/{slots_total} vagas
      </span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative w-full max-w-md mx-auto rounded-xl border p-4 ${
        critical
          ? 'bg-red-500/10 border-red-500/50'
          : urgent
          ? 'bg-orange-500/10 border-orange-500/50'
          : 'bg-yellow-500/10 border-yellow-500/40'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Flame className={`w-4 h-4 ${critical ? 'text-red-400 animate-pulse' : urgent ? 'text-orange-400' : 'text-yellow-400'}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${critical ? 'text-red-400' : urgent ? 'text-orange-400' : 'text-yellow-400'}`}>
            {critical ? 'ÚLTIMAS VAGAS' : urgent ? 'POUCAS VAGAS' : 'LOTE EXTRA LIBERADO — +300 VAGAS'}
          </span>
        </div>
        <span className="text-xs text-gray-400">{pct}% preenchido</span>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-3xl font-black ${critical ? 'text-red-400' : urgent ? 'text-orange-400' : 'text-yellow-400'}`}>
          {slots_remaining}
        </span>
        <span className="text-sm text-gray-300">de {slots_total} vagas restantes</span>
      </div>

      <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${
            critical
              ? 'bg-gradient-to-r from-red-500 to-red-400'
              : urgent
              ? 'bg-gradient-to-r from-orange-500 to-yellow-400'
              : 'bg-gradient-to-r from-yellow-500 to-yellow-400'
          }`}
        />
      </div>
      <p className="text-[11px] text-gray-300 mt-2 text-center">
        Devido à grande procura, liberamos <span className="font-bold text-yellow-300">+300 vagas extras</span>. Após esgotar, o acesso volta ao valor cheio (R$ 299/mês).
      </p>
    </motion.div>
  );
}
