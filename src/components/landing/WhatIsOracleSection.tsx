import { motion } from 'framer-motion';
import { Eye, Brain, Shield, TrendingUp, CheckCircle, Zap, ArrowRight } from 'lucide-react';

interface WhatIsOracleSectionProps {
  onCTA?: () => void;
}

export default function WhatIsOracleSection({ onCTA }: WhatIsOracleSectionProps) {
  return (
    <section className="py-20 bg-[#0a0f1e] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-4">
            O QUE É O
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600"> ORÁCULO MYCROFT?</span>
          </h2>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            A primeira plataforma que transforma entradas esportivas em investimento quantitativo
            usando Inteligência Artificial e proteção emocional.
          </p>
        </motion.div>

        {/* A Trilogia - 3 Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {TRILOGY.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="relative group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.glowFrom} to-transparent rounded-2xl blur-xl group-hover:blur-2xl transition-all`} />
              <div className={`relative bg-[#1a1f36] border ${card.borderColor} rounded-2xl p-8 hover:${card.borderHover} transition-all`}>
                <div className={`w-16 h-16 bg-gradient-to-br ${card.iconGradient} rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg ${card.iconShadow}`}>
                  {card.icon}
                </div>
                <div className="text-center mb-4">
                  <div className={`inline-flex items-center justify-center px-3 py-1 ${card.badgeBg} border ${card.badgeBorder} rounded-full mb-3`}>
                    <span className={`text-xs font-semibold ${card.badgeText}`}>{card.badge}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{card.title}</h3>
                  <p className={`text-sm ${card.subtitleColor} font-medium`}>{card.subtitle}</p>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed text-center">{card.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Como Funciona */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="bg-gradient-to-br from-[#1a1f36] to-[#0f1729] border border-gray-700 rounded-2xl p-8 lg:p-12 shadow-2xl"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white mb-3">COMO FUNCIONA NA PRÁTICA</h3>
            <p className="text-gray-400">Sistema completo de análise + execução + proteção</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 mb-8">
            {STEPS.map((step, i) => (
              <div key={i} className="relative">
                <div className="text-center">
                  <div className={`w-12 h-12 bg-gradient-to-br ${step.gradient} rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg shadow-lg ${step.shadow}`}>
                    {i + 1}
                  </div>
                  <div className="mb-3">
                    {step.icon}
                    <h4 className="font-semibold text-white text-sm">{step.title}</h4>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-6 -right-3 text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Resultado Destaque */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-lg blur-xl" />
            <div className="relative p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Resultado:</h4>
                  <p className="text-gray-300 leading-relaxed">
                    Você investe com a <span className="text-blue-400 font-semibold">precisão de Wall Street</span> e
                    a <span className="text-yellow-400 font-semibold">disciplina de um trader profissional</span>,
                    sem deixar emoção sabotar seus resultados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Mycroft Origin Quote */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mt-16 max-w-3xl mx-auto text-center"
        >
          <div className="relative p-8 bg-gradient-to-br from-[#1a1f36] to-[#0f1729] border border-yellow-500/20 rounded-2xl shadow-xl">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full">
              <span className="text-xs font-semibold text-yellow-400 tracking-wider">POR QUE MYCROFT?</span>
            </div>
            <p className="text-gray-300 leading-relaxed text-lg italic mt-2">
              "Todos conhecem o Sherlock Holmes. Mas o que poucos sabem é que <span className="text-yellow-400 font-semibold not-italic">Mycroft é o mais inteligente da família</span> — ele não resolve casos, ele enxerga padrões antes que aconteçam."
            </p>
            <p className="text-white font-semibold text-lg mt-4">
              É essa análise fria e dedutiva que nomeou nossa IA.<br />
              <span className="text-yellow-400">O Mycroft não torce. Ele calcula.</span>
            </p>
          </div>
        </motion.div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-400 mb-6">É assim que transformamos entradas em investimento sistemático</p>
          <button
            onClick={onCTA}
            className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-xl shadow-yellow-500/50 inline-flex items-center gap-2 group"
          >
            QUERO INVESTIR ASSIM
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </button>
        </div>
      </div>
    </section>
  );
}

const TRILOGY = [
  {
    title: 'ORÁCULO',
    badge: 'A PLATAFORMA',
    subtitle: 'O sistema que vê tudo',
    description: 'A plataforma completa que integra análise quantitativa (Mycroft) + proteção emocional (Hórus) em um único ecossistema de investimento esportivo.',
    icon: <Eye className="w-8 h-8 text-white" />,
    glowFrom: 'from-purple-600/20',
    borderColor: 'border-purple-500/30',
    borderHover: 'border-purple-500/50',
    iconGradient: 'from-purple-600 to-purple-700',
    iconShadow: 'shadow-purple-500/50',
    badgeBg: 'bg-purple-500/20',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-400',
    subtitleColor: 'text-purple-400',
  },
  {
    title: 'MYCROFT',
    badge: 'O CÉREBRO',
    subtitle: 'A inteligência analítica',
    description: 'IA que processa 1.000+ jogos/dia, calcula edge matemático, detecta sharp money e transforma cada partida em um ativo financeiro com Asset Score 0-100.',
    icon: <Brain className="w-8 h-8 text-white" />,
    glowFrom: 'from-blue-600/20',
    borderColor: 'border-blue-500/30',
    borderHover: 'border-blue-500/50',
    iconGradient: 'from-blue-600 to-blue-700',
    iconShadow: 'shadow-blue-500/50',
    badgeBg: 'bg-blue-500/20',
    badgeBorder: 'border-blue-500/30',
    badgeText: 'text-blue-400',
    subtitleColor: 'text-blue-400',
  },
  {
    title: 'HÓRUS',
    badge: 'O PROTETOR',
    subtitle: 'O guardião emocional',
    description: 'Coach de IA que detecta tilt em tempo real, bloqueia entradas emocionais e te protege do seu maior inimigo: você mesmo.',
    icon: <Shield className="w-8 h-8 text-white" />,
    glowFrom: 'from-yellow-600/20',
    borderColor: 'border-yellow-500/30',
    borderHover: 'border-yellow-500/50',
    iconGradient: 'from-yellow-600 to-yellow-700',
    iconShadow: 'shadow-yellow-500/50',
    badgeBg: 'bg-yellow-500/20',
    badgeBorder: 'border-yellow-500/30',
    badgeText: 'text-yellow-400',
    subtitleColor: 'text-yellow-400',
  },
];

const STEPS = [
  {
    title: 'Mycroft Analisa',
    description: 'IA processa milhares de jogos e encontra oportunidades com edge matemático real',
    icon: <Brain className="w-6 h-6 text-blue-400 mx-auto mb-2" />,
    gradient: 'from-blue-600 to-blue-700',
    shadow: 'shadow-blue-500/50',
  },
  {
    title: 'Você Decide',
    description: 'Recebe recomendações com Asset Score, edge calculado e stake otimizado',
    icon: <TrendingUp className="w-6 h-6 text-purple-400 mx-auto mb-2" />,
    gradient: 'from-purple-600 to-purple-700',
    shadow: 'shadow-purple-500/50',
  },
  {
    title: 'Hórus Protege',
    description: 'Monitora seu estado emocional e bloqueia entradas quando detecta tilt ou desvio',
    icon: <Shield className="w-6 h-6 text-yellow-400 mx-auto mb-2" />,
    gradient: 'from-yellow-600 to-yellow-700',
    shadow: 'shadow-yellow-500/50',
  },
  {
    title: 'Sistema Aprende',
    description: 'Cada entrada melhora o modelo. Quanto mais você usa, mais inteligente fica',
    icon: <Zap className="w-6 h-6 text-green-400 mx-auto mb-2" />,
    gradient: 'from-green-600 to-green-700',
    shadow: 'shadow-green-500/50',
  },
];
