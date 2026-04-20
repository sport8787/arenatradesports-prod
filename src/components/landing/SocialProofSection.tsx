import { motion } from 'framer-motion';
import { Quote, PlayCircle, Monitor } from 'lucide-react';

interface VideoBlockProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  videoUrl?: string;
  poster?: string;
}

function VideoBlock({ title, subtitle, icon, videoUrl, poster }: VideoBlockProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative group"
    >
      <div className="absolute -inset-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition" />
      <div className="relative bg-[#0a0f1e] rounded-2xl overflow-hidden border border-yellow-500/30 shadow-xl">
        <div className="px-5 py-3 border-b border-yellow-500/20 flex items-center gap-2">
          {icon}
          <div>
            <p className="text-yellow-400 font-bold text-sm">{title}</p>
            <p className="text-gray-400 text-xs">{subtitle}</p>
          </div>
        </div>
        <div className="aspect-video bg-black">
          {videoUrl ? (
            <video src={videoUrl} controls playsInline poster={poster} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
              <PlayCircle className="w-14 h-14 text-yellow-500/60 mb-3" />
              <p className="text-gray-300 font-semibold">Vídeo em breve</p>
              <p className="text-gray-500 text-xs mt-1">Será publicado nas próximas horas</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface Props {
  testimonialUrl?: string;
  demoUrl?: string;
}

export default function SocialProofSection({ testimonialUrl, demoUrl }: Props) {
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
            NÃO ACREDITE NA GENTE.
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              VEJA FUNCIONANDO.
            </span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Quem já usa fala por nós — e o sistema rodando ao vivo mostra exatamente o que você vai receber.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          <VideoBlock
            title="DEPOIMENTO REAL"
            subtitle="Usuário ativo do Mycroft"
            icon={<Quote className="w-5 h-5 text-yellow-400" />}
            videoUrl={testimonialUrl}
          />
          <VideoBlock
            title="SISTEMA NA PRÁTICA"
            subtitle="Demonstração ao vivo"
            icon={<Monitor className="w-5 h-5 text-yellow-400" />}
            videoUrl={demoUrl}
          />
        </div>
      </div>
    </section>
  );
}
