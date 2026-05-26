import { motion } from 'framer-motion';
import { X, Check, TrendingDown, TrendingUp } from 'lucide-react';

const BEFORE = [
  'Entrada no "feeling" e na zebra do dia',
  'Stake aleatório (R$50, R$200, R$500...)',
  'Entra em tilt depois de 2 reds',
  'Persegue prejuízo com entrada dobrada',
  'Sem registro: não sabe se ganha ou perde',
  'ROI médio: -15% a -30% ao ano',
];

const AFTER = [
  'IA calcula edge matemático antes de cada entrada',
  'Stake otimizado pelo Critério de Kelly',
  'Hórus detecta tilt e bloqueia operações',
  'Gestão de risco automática (stop loss)',
  'Track record auditado de cada posição',
  'ROI auditado: +73% em 1.658 posições',
];

export default function BeforeAfterSection() {
  return (
    <section className="py-20 bg-[#0a0f1e]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl lg:text-5xl font-bold mb-4">
            ANTES vs DEPOIS DO
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              ORÁCULO MYCROFT
            </span>
          </h2>
          <p className="text-lg text-gray-400">A diferença entre operar e investir</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ANTES */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-gradient-to-br from-red-950/40 to-[#1a1f36] border border-red-500/30 rounded-2xl p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-red-400 font-bold tracking-wider">ANTES</p>
                <h3 className="text-xl font-bold text-white">Operador comum</h3>
              </div>
            </div>
            <ul className="space-y-3">
              {BEFORE.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-red-400" />
                  </div>
                  <span className="text-sm text-gray-300">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-red-500/20">
              <p className="text-3xl font-bold text-red-400">-R$ 8.450</p>
              <p className="text-xs text-gray-500">Perda média anual (simulada)</p>
            </div>
          </motion.div>

          {/* DEPOIS */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-gradient-to-br from-green-950/40 to-[#1a1f36] border border-green-500/40 rounded-2xl p-8 relative"
          >
            <div className="absolute -top-3 right-6 px-3 py-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black text-xs font-bold rounded-full">
              COM MYCROFT
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-green-400 font-bold tracking-wider">DEPOIS</p>
                <h3 className="text-xl font-bold text-white">Investidor profissional</h3>
              </div>
            </div>
            <ul className="space-y-3">
              {AFTER.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  <span className="text-sm text-gray-300">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-green-500/20">
              <p className="text-3xl font-bold text-green-400">+R$ 14.700</p>
              <p className="text-xs text-gray-500">Retorno médio anual (simulado) (banca R$ 5k)</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
