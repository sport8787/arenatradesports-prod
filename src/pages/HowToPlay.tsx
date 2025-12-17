import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Target, 
  Theater, 
  Bot, 
  Coins, 
  ChevronRight,
  Shield,
  Eye,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import GoldButton from '@/components/game/GoldButton';

const sections = [
  {
    icon: Target,
    title: "O OBJETIVO",
    emoji: "🎯",
    content: (
      <p className="text-muted-foreground leading-relaxed">
        Acumule o máximo de <span className="text-gold font-semibold">BluffCoins (B$)</span>. 
        Use sua habilidade para enganar a mesa ou detectar mentiras.
      </p>
    )
  },
  {
    icon: Theater,
    title: "OS PAPÉIS",
    emoji: "🎭",
    content: (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-gold/5 border border-gold/20">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-gold" />
            <span className="font-orbitron text-gold font-bold">O JOGADOR DA VEZ</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Recebe uma pergunta e a resposta secreta. Deve escolher uma opção e convencer o grupo.
          </p>
          <div className="mt-2 p-2 rounded bg-secondary/50 border-l-2 border-mycroft-cyan">
            <p className="text-xs text-mycroft-cyan italic">
              💡 Dica: Se não souber, minta. Se souber, fale a verdade (ou finja que está mentindo).
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-mycroft-cyan/5 border border-mycroft-cyan/20">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-mycroft-cyan" />
            <span className="font-orbitron text-mycroft-cyan font-bold">O JÚRI (DESAFIANTES)</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed mb-3">
            Ouve a justificativa e vota:
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 p-2 rounded bg-success/10 border border-success/30">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-success font-semibold text-sm">CLARO</span>
              <span className="text-muted-foreground text-xs">— Acredito no Jogador</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/30">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span className="text-destructive font-semibold text-sm">BLEFE</span>
              <span className="text-muted-foreground text-xs">— O Jogador está mentindo</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    icon: Bot,
    title: "A TECNOLOGIA BAKER-X",
    emoji: "🤖",
    content: (
      <div className="space-y-3">
        <p className="text-muted-foreground leading-relaxed">
          Use o botão <span className="text-mycroft-green font-semibold">CONSULTAR MYCROFT</span> para 
          receber ajuda da IA.
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-mycroft-green/5 border border-mycroft-green/20">
            <Sparkles className="w-4 h-4 text-mycroft-green mt-0.5" />
            <div>
              <span className="text-mycroft-green font-semibold text-sm">Modo Jogador</span>
              <p className="text-muted-foreground text-xs mt-1">
                A IA cria o roteiro da mentira perfeita.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-mycroft-cyan/5 border border-mycroft-cyan/20">
            <AlertTriangle className="w-4 h-4 text-mycroft-cyan mt-0.5" />
            <div>
              <span className="text-mycroft-cyan font-semibold text-sm">Modo Júri</span>
              <p className="text-muted-foreground text-xs mt-1">
                A IA analisa padrões para detectar o blefe.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    icon: Coins,
    title: "A ECONOMIA",
    emoji: "💰",
    content: (
      <div className="space-y-3">
        <p className="text-muted-foreground leading-relaxed">
          Cada vitória rende <span className="text-gold font-semibold">B$</span>. 
          Acumule para trocar por prêmios reais no{' '}
          <span className="text-destructive font-semibold">Mercado Negro</span>.
        </p>
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <p className="text-destructive/90 text-sm">
            Cuidado: Votos errados custam moedas.
          </p>
        </div>
      </div>
    )
  }
];

export default function HowToPlay() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-gold/20"
      >
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-2 h-2 rounded-full bg-mycroft-green animate-pulse" />
            <h1 className="font-orbitron text-lg md:text-xl font-black text-gold tracking-wider">
              MANUAL DO AGENTE
            </h1>
            <div className="w-2 h-2 rounded-full bg-mycroft-green animate-pulse" />
          </div>
          <p className="text-center text-xs text-muted-foreground mt-1 font-mono">
            DOCUMENTO CONFIDENCIAL • NÍVEL ALPHA
          </p>
        </div>
      </motion.header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {sections.map((section, index) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * (index + 1) }}
              className="relative"
            >
              {/* Section number indicator */}
              <div className="absolute -left-2 top-0 w-8 h-8 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center">
                <span className="font-orbitron text-gold text-xs font-bold">{index + 1}</span>
              </div>

              <div className="ml-8 p-4 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm">
                {/* Section header */}
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border/50">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center">
                    <span className="text-lg">{section.emoji}</span>
                  </div>
                  <div>
                    <h2 className="font-orbitron text-foreground font-bold tracking-wide">
                      {section.title}
                    </h2>
                  </div>
                </div>

                {/* Section content */}
                <div className="text-sm">
                  {section.content}
                </div>
              </div>

              {/* Connector line */}
              {index < sections.length - 1 && (
                <div className="absolute left-[0.4rem] top-10 w-px h-[calc(100%-1rem)] bg-gradient-to-b from-gold/30 to-transparent" />
              )}
            </motion.section>
          ))}
        </motion.div>
      </main>

      {/* Fixed bottom CTA */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent"
      >
        <div className="max-w-2xl mx-auto">
          <GoldButton 
            onClick={() => navigate('/')} 
            className="w-full" 
            size="lg"
          >
            <span className="mr-2">ENTENDI. INICIAR MISSÃO.</span>
            <ChevronRight className="w-5 h-5" />
          </GoldButton>
        </div>
      </motion.div>
    </div>
  );
}
