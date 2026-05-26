import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

const OBJECTIONS = [
  {
    objection: '"Não entendo de matemática nem de odds"',
    answer: 'Você não precisa. Mycroft calcula tudo e te entrega a recomendação pronta: o que operar, quanto operar e quando operar. Você só clica.',
  },
  {
    objection: '"Já fui enganado por tipster, vai ser diferente?"',
    answer: 'Sim. Tipster mostra prints editáveis. Aqui cada uma das 1.658 posições tem timestamp, odd registrada e resultado público. Auditável por qualquer pessoa.',
  },
  {
    objection: '"Não tenho tempo para acompanhar jogos o dia todo"',
    answer: 'Mycroft trabalha 24/7. Hórus envia notificação no Telegram quando aparece oportunidade real. Você decide se entra ou não — em 2 toques no celular.',
  },
  {
    objection: '"E se eu perder dinheiro mesmo seguindo?"',
    answer: 'Garantia Dobro: se você seguir 95%+ das recomendações por 3 meses e não tiver ROI positivo, devolvemos em dobro o valor da assinatura. Sem letrinhas.',
  },
  {
    objection: '"Minha banca é pequena, vale a pena?"',
    answer: 'Sim. A partir de R$ 500 você consegue stakes adequados (2-5% por posição). O importante é gestão, não tamanho. Inclusive, banca menor exige mais disciplina — e é aí que o Hórus te protege.',
  },
  {
    objection: '"E se eu cancelar depois?"',
    answer: 'Cancela em 2 cliques no dashboard. Sem multa, sem fidelidade, sem retenção. Se cancelar no meio do mês, mantemos o acesso até o fim do período pago.',
  },
];

export default function ObjectionsSection() {
  return (
    <section className="py-20 bg-[#0f1729]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-sm text-blue-400 mb-4">
            <ShieldCheck className="w-4 h-4" />
            <span>RESPOSTAS DIRETAS</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-4">
            "MAS E SE...?"
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              VAMOS ÀS OBJEÇÕES
            </span>
          </h2>
          <p className="text-lg text-gray-400">
            Tudo que pessoas reais perguntam antes de assinar — respondido sem enrolação.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-4">
          {OBJECTIONS.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-[#1a1f36] border border-gray-700 rounded-xl p-5 hover:border-yellow-500/40 transition"
            >
              <p className="text-yellow-400 font-semibold text-sm mb-2 italic">{item.objection}</p>
              <p className="text-gray-300 text-sm leading-relaxed">{item.answer}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
