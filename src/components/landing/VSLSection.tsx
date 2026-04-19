import { motion } from 'framer-motion';
import { Play, ArrowRight } from 'lucide-react';

interface VSLSectionProps {
  onCTA: () => void;
  videoUrl?: string;
}

export default function VSLSection({ onCTA, videoUrl }: VSLSectionProps) {
  return (
    <section className="py-20 bg-gradient-to-b from-[#0a0f1e] via-[#0f1729] to-[#0a0f1e] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/5 via-transparent to-transparent" />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-sm text-red-400 mb-4">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="font-semibold">ASSISTA ANTES DE DECIDIR</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-4">
            COMO O MYCROFT TRANSFORMOU
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              APOSTAS EM INVESTIMENTO
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Em 3 minutos você entende exatamente como funciona — e por que 1.200+ apostadores já trocaram o "feeling" pela matemática.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-yellow-500/20 via-blue-500/20 to-purple-500/20 rounded-2xl blur-2xl" />
          <div className="relative aspect-video bg-[#0a0f1e] rounded-2xl overflow-hidden border-2 border-yellow-500/30 shadow-2xl shadow-yellow-500/10">
            {videoUrl ? (
              <video
                src={videoUrl}
                controls
                playsInline
                poster="/og-image.png"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0f1729] to-[#0a0f1e] text-center p-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center mb-4 shadow-xl shadow-yellow-500/40">
                  <Play className="w-10 h-10 text-black ml-1" fill="currentColor" />
                </div>
                <p className="text-yellow-400 font-bold text-lg mb-2">VSL EM PRODUÇÃO</p>
                <p className="text-gray-400 text-sm max-w-md">
                  O vídeo de apresentação está sendo finalizado e estará disponível em breve.
                  Enquanto isso, comece seu teste grátis abaixo.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-center mt-10"
        >
          <button
            onClick={onCTA}
            className="px-10 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition shadow-xl shadow-yellow-500/30 inline-flex items-center gap-2 group text-lg"
          >
            QUERO TESTAR GRÁTIS POR 7 DIAS
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </button>
          <p className="text-sm text-gray-400 mt-3">Sem cartão • Cancele em 2 cliques • Acesso imediato</p>
        </motion.div>
      </div>
    </section>
  );
}
