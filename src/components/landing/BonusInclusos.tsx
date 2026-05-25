import { motion } from 'framer-motion';
import { Spade, LineChart, TrendingUp, MessageSquare } from 'lucide-react';

const BONUS = [
  {
    icon: TrendingUp,
    badge: '🚀 ALAVANCAGEM · PROFISSIONAL+',
    title: 'Método Hórus de Alavancagem — Hórus pilota a banca',
    desc: 'A ferramenta definitiva de crescimento de banca. O Hórus calcula automaticamente o percentual de risco usando o Método Hórus de Alavancagem em 5 ciclos progressivos (B / B / 1.5B / 2B / 3B). Banca isolada de até 10%, meta de 5% por ciclo com fator redutor 2,5% — matemática pura, sem improviso.',
    bullets: [
      '5 ciclos progressivos com stake calculado',
      'Banca isolada (no máximo 10% da banca principal)',
      'Modo Assistido ou Simulado (Hórus pilota sozinho)',
      'Pausa automática após 2 REDs consecutivos',
    ],
    warning: '🔓 Destravado a partir do plano Profissional. Sem ele, você opera no improviso.',
    accent: 'from-amber-500/15 to-amber-900/5 border-amber-500/40',
    badgeColor: 'text-amber-300 border-amber-500/40',
  },
  {
    icon: MessageSquare,
    badge: '💬 CHAT AO VIVO · EXCLUSIVO ELITE',
    title: 'Mycroft em tempo real dentro do jogo',
    desc: 'Nunca mais opere sozinho sob estresse. No plano Elite você tem um analista de dados exclusivo conversando com você ao vivo durante a partida, ditando a hora exata de entrar no mercado, segurar o trade ou bater o cash-out. Copiloto direto na Betfair Exchange.',
    bullets: [
      'Chat Mycroft dentro de cada partida ao vivo',
      'Decisão de Cash Out assistida em tempo real',
      'Leitura combinada xG + pressão + momentum',
      'Integração direta com Banca Real Betfair',
    ],
    warning: '🔐 Exclusivo do plano Trading de Elite. É o que separa amador de profissional.',
    accent: 'from-fuchsia-500/15 to-fuchsia-900/5 border-fuchsia-500/40',
    badgeColor: 'text-fuchsia-300 border-fuchsia-500/40',
  },
  {
    icon: Spade,
    badge: '🃏 BÔNUS · BANCA PEQUENA',
    title: 'Arena Blackjack — assistente matemático',
    desc: 'Não é tigrinho. Não é roleta. Blackjack é o único jogo de cassino onde a vantagem matemática pode ficar com o jogador — combinando contagem Hi-Lo, estratégia básica perfeita (Illustrious 18) e gestão Kelly Híbrido. A casa fica abaixo de 0,5%.',
    bullets: [
      'Contagem de cartas Hi-Lo automatizada',
      'Estratégia básica + Illustrious 18',
      'Progressão D\'Alembert customizada (+2/-2)',
      'Modo ao vivo com até 7 posições',
    ],
    warning: '⚠️ Gestão obrigatória: meta diária R$ 50–R$ 100, stop loss definido, sessões de no máximo 20 minutos.',
    accent: 'from-violet-500/15 to-violet-900/5 border-violet-500/40',
    badgeColor: 'text-violet-300 border-violet-500/40',
  },
  {
    icon: LineChart,
    badge: '🧪 BETA · EM CALIBRAÇÃO',
    title: 'Arena Trader Financeiro (Beta)',
    desc: 'Versão experimental. Estamos calibrando R:R, stop loss e leitura técnica para WIN, WDO e BTC. Sem garantia de paridade com o Trader Sports — use por sua conta e risco enquanto o motor é refinado.',
    bullets: [
      'WIN (mini-índice) com proxy ^BVSP',
      'WDO (mini-dólar) com proxy USD/BRL',
      'BTC escalonado em 0.01 unidades',
      'Beta: resultados não auditados, não entram na Liga Mycroft',
    ],
    warning: '⚠️ Beta em testes. Não confunda com o Trader Sports (esportivo), que já é maduro e auditado.',
    accent: 'from-sky-500/15 to-sky-900/5 border-sky-500/40',
    badgeColor: 'text-amber-300 border-amber-500/40',
  },
];

export default function BonusInclusos() {
  return (
    <section className="py-16 sm:py-20 px-4 bg-gradient-to-b from-[#0a0f1e] via-[#0f1729] to-[#0a0f1e]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs uppercase tracking-widest text-yellow-400 mb-4">
            🎁 O que cada plano destrava
          </span>
          <h2 className="text-3xl sm:text-4xl font-black mb-3 leading-tight">
            Do método pronto à <span className="text-yellow-400">copilotagem ao vivo</span>
          </h2>
          <p className="text-base text-gray-300 max-w-2xl mx-auto">
            Iniciante usa os métodos globais. Profissional cria os próprios métodos e alavanca com Hórus. Elite tem Mycroft no ouvido em tempo real.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {BONUS.map((b, i) => {
            const Icon = b.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`rounded-2xl border bg-gradient-to-br ${b.accent} p-6 sm:p-7 shadow-xl shadow-black/40`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="shrink-0 h-12 w-12 rounded-xl bg-background/40 backdrop-blur flex items-center justify-center">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className={`inline-block px-2.5 py-1 mb-2 bg-[#0a0f1e]/80 backdrop-blur border rounded-full text-[10px] font-bold tracking-wide ${b.badgeColor}`}>
                      {b.badge}
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white leading-snug">{b.title}</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed mb-4">{b.desc}</p>
                <ul className="space-y-1.5 mb-4">
                  {b.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm text-gray-200">
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-400 italic border-t border-white/10 pt-3 leading-relaxed">
                  {b.warning}
                </p>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-500 mt-8 max-w-2xl mx-auto">
          Ciclos e Blackjack: já no Profissional. Chat ao Vivo + Trader Financeiro completo: exclusivo do Elite.
        </p>
      </div>
    </section>
  );
}
