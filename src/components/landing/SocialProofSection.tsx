import { motion } from 'framer-motion';
import { Quote, PlayCircle, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Testimonial {
  /** URL de mp4 (legado). Use vturbId para players VTurb. */
  url?: string;
  /** ID do player VTurb (vid-XXXX). Renderiza <vturb-smartplayer>. */
  vturbId?: string;
  name?: string;
  role?: string;
  poster?: string;
}

const VTURB_ACCOUNT_ID = '425e46be-1934-41ee-ac61-375afed6531f';

const TESTIMONIALS: Testimonial[] = [
  {
    vturbId: '69ea210588365845bd04bfd8',
    name: 'Cliente Mycroft',
    role: 'Depoimento real',
  },
  {
    vturbId: '69ea215e88365845bd04c0c9',
    name: 'Cliente Mycroft',
    role: 'Depoimento real',
  },
  {
    vturbId: '69ea20dd05c3ed4453dee2da',
    name: 'Cliente Mycroft',
    role: 'Depoimento real',
  },
  {
    url: 'https://affquongjlhmusxzohjl.supabase.co/storage/v1/object/public/public-assets/testimonials/depoimento-01.mp4',
    name: 'Usuário verificado',
    role: 'Operador profissional',
  },
];

function useVturbScript(playerId: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!playerId || !enabled) return;
    if (document.querySelector(`script[data-vturb-player="${playerId}"]`)) return;
    const s = document.createElement('script');
    s.src = `https://scripts.converteai.net/${VTURB_ACCOUNT_ID}/players/${playerId}/v4/player.js`;
    s.async = true;
    s.setAttribute('data-vturb-player', playerId);
    document.head.appendChild(s);
  }, [playerId, enabled]);
}

function TestimonialCard({ t }: { t: Testimonial }) {
  const [activated, setActivated] = useState(false);
  useVturbScript(t.vturbId, activated);
  const isVturb = !!t.vturbId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative group w-full"
    >
      <div className="absolute -inset-2 bg-gradient-to-r from-yellow-500/30 to-orange-500/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition" />
      <div className="relative bg-[#0a0f1e] rounded-2xl overflow-hidden border border-yellow-500/30 shadow-2xl">
        <div className="px-5 py-3 border-b border-yellow-500/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
            <Quote className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="min-w-0">
            <p className="text-yellow-400 font-bold text-sm truncate">{t.name ?? 'DEPOIMENTO REAL'}</p>
            <p className="text-gray-400 text-xs truncate">{t.role ?? 'Cliente Mycroft'}</p>
          </div>
        </div>
        <div className={isVturb ? 'aspect-[9/16] bg-black relative' : 'aspect-video bg-black relative'}>
          {isVturb ? (
            activated ? (
              <vturb-smartplayer
                id={`vid-${t.vturbId}`}
                style={{ display: 'block', width: '100%', height: '100%' }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setActivated(true)}
                aria-label="Reproduzir depoimento"
                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-black/40 via-black/60 to-black/80 hover:from-black/30 hover:via-black/50 hover:to-black/70 transition group/play"
              >
                <span className="w-20 h-20 rounded-full bg-yellow-500 flex items-center justify-center shadow-2xl shadow-yellow-500/40 group-hover/play:scale-110 transition">
                  <Play className="w-9 h-9 text-black fill-black ml-1" />
                </span>
                <span className="text-white font-semibold text-sm tracking-wide">ASSISTIR DEPOIMENTO</span>
              </button>
            )
          ) : t.url ? (
            <video
              src={t.url}
              controls
              playsInline
              preload="metadata"
              poster={t.poster}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
              <PlayCircle className="w-14 h-14 text-yellow-500/60 mb-3" />
              <p className="text-gray-300 font-semibold">Vídeo em breve</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function SocialProofSection() {
  const items = TESTIMONIALS.filter((t) => !!t.url || !!t.vturbId);
  const isSingle = items.length <= 1;

  return (
    <section className="py-20 bg-gradient-to-b from-[#0a0f1e] via-[#0f1729] to-[#0a0f1e] relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-sm text-yellow-400 mb-4">
            <Quote className="w-4 h-4" />
            <span className="font-semibold">PROVA REAL</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-bold mb-3">
            QUEM JÁ USA
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              FALA POR NÓS.
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Sem ator, sem roteiro. Operador real contando o que mudou depois do Mycroft.
          </p>
        </motion.div>

        <div className={isSingle ? 'max-w-3xl mx-auto' : 'grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8'}>
          {items.map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}
