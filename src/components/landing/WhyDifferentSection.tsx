import { motion } from 'framer-motion';
import { TrendingUp, Brain, Shield, GraduationCap, Scale, ArrowRight, X, CheckCircle2 } from 'lucide-react';

interface WhyDifferentSectionProps {
  onCTA?: () => void;
}

export default function WhyDifferentSection({ onCTA }: WhyDifferentSectionProps) {
  return (
    <section className="py-20 bg-gradient-to-b from-[#0a0f1e] via-[#0f1729] to-[#0a0f1e] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(234, 179, 8, 0.4) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Bloco de Prova Brutal */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mb-20"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full text-sm text-green-400 mb-4">
              <TrendingUp className="w-4 h-4" />
              <span>RESULTADOS REAIS DO HÓRUS</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-3">
              SEM ACHISMO.
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500"> APENAS MATEMÁTICA.</span>
            </h2>
            <p className="text-lg text-gray-400">Dados auditáveis das últimas operações executadas pela IA</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <div className="relative bg-gradient-to-br from-green-500/15 to-green-700/5 border-2 border-green-500/40 rounded-2xl p-8 text-center group hover:border-green-500/70 transition">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-black text-[10px] font-black rounded-full tracking-wider">
                PERFORMANCE HISTÓRICA
              </div>
              <p className="text-5xl lg:text-6xl font-black text-green-400 mb-2">+71.0 u</p>
              <p className="text-sm text-gray-300 font-semibold">unidades estatísticas acumuladas</p>
              <p className="text-xs text-gray-500 mt-1">1 unidade = métrica de risco padrão do usuário</p>
            </div>

            <div className="relative bg-gradient-to-br from-yellow-500/15 to-yellow-700/5 border-2 border-yellow-500/40 rounded-2xl p-8 text-center group hover:border-yellow-500/70 transition">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500 text-black text-[10px] font-black rounded-full tracking-wider">
                ROI AUDITADO
              </div>
              <p className="text-5xl lg:text-6xl font-black text-yellow-400 mb-2">+71%</p>
              <p className="text-sm text-gray-300 font-semibold">de retorno sobre investimento</p>
              <p className="text-xs text-gray-500 mt-1">Verificável no dashboard</p>
            </div>

            <div className="relative bg-gradient-to-br from-blue-500/15 to-blue-700/5 border-2 border-blue-500/40 rounded-2xl p-8 text-center group hover:border-blue-500/70 transition">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-black text-[10px] font-black rounded-full tracking-wider">
                TRANSPARÊNCIA
              </div>
              <p className="text-5xl lg:text-6xl font-black text-blue-400 mb-2">138</p>
              <p className="text-sm text-gray-300 font-semibold">entradas analisadas</p>
              <p className="text-xs text-gray-500 mt-1">Cada uma com timestamp + resultado</p>
            </div>
          </div>

          <p className="text-center text-sm text-gray-400 mt-6 italic">
            "Sem achismo. Apenas matemática." — Track record 100% auditável dentro do app.
          </p>
        </motion.div>

        {/* Por que é diferente */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-sm text-yellow-400 mb-4">
              <Brain className="w-4 h-4" />
              <span>O MECANISMO ÚNICO</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              POR QUE O ORÁCULO MYCROFT
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                É DIFERENTE?
              </span>
            </h2>
          </div>

          {/* Negação dupla */}
          <div className="grid md:grid-cols-2 gap-4 mb-10 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <X className="w-6 h-6 text-red-500 flex-shrink-0" />
              <p className="text-gray-300"><span className="font-bold text-red-400">Não é</span> um tipster.</p>
            </div>
            <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <X className="w-6 h-6 text-red-500 flex-shrink-0" />
              <p className="text-gray-300"><span className="font-bold text-red-400">Não é</span> um robô de entradas.</p>
            </div>
          </div>

          <p className="text-center text-xl text-white font-semibold mb-10">
            É um <span className="text-yellow-400">sistema completo</span> que faz o que nenhum outro faz:
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {PILLARS.map((pillar, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative bg-[#1a1f36] border border-gray-700 rounded-2xl p-6 hover:border-yellow-500/40 transition group"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${pillar.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition`}>
                  {pillar.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{pillar.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{pillar.description}</p>
              </motion.div>
            ))}
          </div>

          {/* Quebra de objeção */}
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border-2 border-blue-500/30 rounded-2xl p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <CheckCircle2 className="w-6 h-6 text-blue-400" />
              <p className="text-sm font-bold text-blue-400 uppercase tracking-wider">Você não precisa ser especialista</p>
            </div>
            <p className="text-xl lg:text-2xl text-white font-semibold leading-relaxed mb-3">
              O Hórus faz a leitura por você —
              <span className="text-yellow-400"> e ainda te ensina</span> a não cometer os erros mais comuns dos operadores.
            </p>
            <p className="text-gray-400 mb-6">
              Sem matemática complexa. Sem planilhas. Sem precisar entender de odds.
              Você recebe a recomendação pronta e o sistema te protege.
            </p>
            <button
              onClick={onCTA}
              className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-xl shadow-yellow-500/30 inline-flex items-center gap-2 group"
            >
              QUERO TESTAR GRÁTIS POR 7 DIAS
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

const PILLARS = [
  {
    title: 'Leitura de Mercado',
    description: 'IA detecta entradas com vantagem real antes das casas ajustarem as odds. Você entra no momento certo.',
    icon: <Brain className="w-6 h-6 text-white" />,
    gradient: 'from-blue-600 to-blue-700',
  },
  {
    title: 'Anti-Tilt',
    description: 'Hórus monitora seu comportamento e bloqueia entradas emocionais — seu maior inimigo é você mesmo.',
    icon: <Shield className="w-6 h-6 text-white" />,
    gradient: 'from-yellow-600 to-orange-600',
  },
  {
    title: 'Treino Obrigatório',
    description: 'Você não só entrada: aprende. Cenários reais te treinam a tomar decisões frias sob pressão.',
    icon: <GraduationCap className="w-6 h-6 text-white" />,
    gradient: 'from-purple-600 to-purple-700',
  },
  {
    title: 'Banca Real vs IA',
    description: 'Comparação lado a lado: veja quanto a IA teria ganhado vs suas decisões. Métrica brutal de evolução.',
    icon: <Scale className="w-6 h-6 text-white" />,
    gradient: 'from-green-600 to-emerald-700',
  },
];
