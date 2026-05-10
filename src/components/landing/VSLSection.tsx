import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';

interface VSLSectionProps {
  onCTA: () => void;
  videoUrl?: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'vturb-smartplayer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { id: string }, HTMLElement>;
    }
  }
}

const VTURB_PLAYER_ID = '6a00acb708dd22f8e61508b7';
const VTURB_ACCOUNT_ID = '425e46be-1934-41ee-ac61-375afed6531f';
const VTURB_SCRIPT_SRC = `https://scripts.converteai.net/${VTURB_ACCOUNT_ID}/players/${VTURB_PLAYER_ID}/v4/player.js`;

export default function VSLSection({ onCTA, videoUrl }: VSLSectionProps) {
  useEffect(() => {
    // Remove qualquer script VTurb antigo (de outros player IDs) para evitar cache de player anterior
    document
      .querySelectorAll('script[src*="scripts.converteai.net"]')
      .forEach((el) => {
        if (!el.getAttribute('src')?.includes(VTURB_PLAYER_ID)) {
          el.remove();
        }
      });

    if (document.querySelector(`script[data-vturb-player="${VTURB_PLAYER_ID}"]`)) return;
    const s = document.createElement('script');
    s.src = VTURB_SCRIPT_SRC;
    s.async = true;
    s.setAttribute('data-vturb-player', VTURB_PLAYER_ID);
    document.head.appendChild(s);
  }, []);

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
            <span className="font-semibold">ASSISTA ANTES QUE AS VAGAS ACABEM</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-4">
            NÃO FOI AZAR.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              AS CASAS AJUSTARAM ANTES DE VOCÊ PERCEBER.
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            +73% de ROI auditado em 1.658 posições. Veja o sistema rodando ao vivo dentro do vídeo — e o contador de vagas caindo enquanto você assiste.
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
          <div className="relative mx-auto w-full max-w-[400px] sm:max-w-[420px] md:max-w-[460px] aspect-[9/16] rounded-2xl overflow-hidden border-2 border-yellow-500/30 shadow-2xl shadow-yellow-500/10 bg-[#0a0f1e]">
            <vturb-smartplayer
              id={`vid-${VTURB_PLAYER_ID}`}
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
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
            GARANTIR MINHA VAGA — 7 DIAS GRÁTIS
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
          </button>
          <p className="text-sm text-gray-400 mt-3">Sem cartão hoje • Cancele em 2 cliques • O risco é todo meu</p>
        </motion.div>
      </div>
    </section>
  );
}
