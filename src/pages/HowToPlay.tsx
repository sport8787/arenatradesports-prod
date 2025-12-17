import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Target, 
  Crown, 
  Bot, 
  ChevronRight,
  Shield,
  Skull,
  Sparkles,
  AudioWaveform,
  Mic,
  BadgeCheck,
  LogOut,
  Scan,
  Drama,
  CheckCircle,
  XCircle
} from 'lucide-react';
import GoldButton from '@/components/game/GoldButton';

const sections = [
  {
    icon: Target,
    title: "O OBJETIVO",
    emoji: "🎯",
    content: (
      <div className="space-y-3">
        <p className="text-muted-foreground leading-relaxed">
          Sobreviva a <span className="text-gold font-semibold">15 rodadas</span>. 
          A cada rodada, o prêmio aumenta exponencialmente.
        </p>
        <div className="p-3 rounded-lg bg-gold/10 border border-gold/30 text-center">
          <p className="font-orbitron text-gold font-bold text-lg">
            Seu objetivo final: 1 MILHÃO de BluffCoins
          </p>
        </div>
      </div>
    )
  },
  {
    icon: Drama,
    title: "OS PAPÉIS",
    emoji: "🎭",
    content: (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-gold/10 border border-gold/30">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-orbitron text-gold font-bold text-sm">O JOGADOR DA VEZ</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed mb-2">
            Recebe uma pergunta e a <span className="text-gold font-semibold">resposta secreta</span>. 
            Deve escolher uma opção e convencer o grupo.
          </p>
          <div className="p-2 rounded bg-gold/5 border border-gold/20">
            <p className="text-gold/80 text-xs italic">
              💡 Dica: Se não souber, minta. Se souber, fale a verdade (ou finja que está mentindo).
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-mycroft-cyan/10 border border-mycroft-cyan/30">
          <div className="flex items-center gap-2 mb-2">
            <Scan className="w-4 h-4 text-mycroft-cyan" />
            <span className="font-orbitron text-mycroft-cyan font-bold text-sm">O JÚRI (DESAFIANTES)</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed mb-3">
            Ouve a justificativa e vota:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 rounded bg-success/10 border border-success/30">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-success font-semibold text-sm">CLARO (Verde):</span>
              <span className="text-muted-foreground text-xs">Acredito no Jogador.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/30">
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="text-destructive font-semibold text-sm">BLEFE (Vermelho):</span>
              <span className="text-muted-foreground text-xs">O Jogador está mentindo.</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    icon: Crown,
    title: "A SUCESSÃO (KING OF THE HILL)",
    emoji: "🔄",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed italic">
          "Aqui, a cadeira do rei é disputada."
        </p>
        
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
          <div className="flex items-center gap-2 mb-2">
            <Skull className="w-4 h-4 text-destructive" />
            <span className="font-orbitron text-destructive font-bold text-sm">MORTE SÚBITA</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Se o Jogador mentir e <span className="text-destructive font-semibold">TODOS</span> os 
            desafiantes votarem <span className="text-destructive font-semibold">'BLEFE'</span> (Leitura Perfeita), 
            o Jogador é eliminado imediatamente.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-gold/10 border border-gold/30">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-orbitron text-gold font-bold text-sm">O NOVO REI</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            O Desafiante com maior pontuação no Ranking assume o lugar de Host e herda a mesa.
          </p>
        </div>
      </div>
    )
  },
  {
    icon: Shield,
    title: "CARTAS BÔNUS & CASHOUT",
    emoji: "🃏",
    content: (
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed italic">
          "Mentir bem traz recompensas além de moedas:"
        </p>
        
        <div className="p-4 rounded-lg bg-mycroft-cyan/10 border border-mycroft-cyan/30">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-mycroft-cyan" />
            <span className="font-orbitron text-mycroft-cyan font-bold text-sm">IMUNIDADE</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Se <span className="text-mycroft-cyan font-semibold">3 desafiantes</span> acreditarem 
            na sua mentira (Voto CLARO), você evita uma eliminação futura.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-success/10 border border-success/30">
          <div className="flex items-center gap-2 mb-2">
            <LogOut className="w-4 h-4 text-success" />
            <span className="font-orbitron text-success font-bold text-sm">CASHOUT (RETIRADA)</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Se pelo menos <span className="text-success font-semibold">2 desafiantes</span> acreditarem, 
            você desbloqueia o botão de <span className="text-success font-semibold">CASHOUT</span> para 
            parar o jogo e garantir seu lucro atual.
          </p>
        </div>
      </div>
    )
  },
  {
    icon: Bot,
    title: "A TECNOLOGIA BAKER-X (IA)",
    emoji: "🤖",
    content: (
      <div className="space-y-3">
        <p className="text-muted-foreground leading-relaxed">
          Use o botão <span className="text-mycroft-green font-semibold">CONSULTAR MYCROFT</span> para 
          receber suporte tático.
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-mycroft-green/5 border border-mycroft-green/20">
            <Sparkles className="w-4 h-4 text-mycroft-green mt-0.5" />
            <div>
              <span className="text-mycroft-green font-semibold text-sm">Jogador</span>
              <p className="text-muted-foreground text-xs mt-1">
                Receba roteiros de mentira via Teleprompter.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-mycroft-cyan/5 border border-mycroft-cyan/20">
            <Scan className="w-4 h-4 text-mycroft-cyan mt-0.5" />
            <div>
              <span className="text-mycroft-cyan font-semibold text-sm">Júri</span>
              <p className="text-muted-foreground text-xs mt-1">
                Ative a Análise Forense de Áudio para detectar padrões vocais suspeitos.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    icon: Mic,
    title: "A JUSTIFICATIVA",
    emoji: "🎙️",
    content: (
      <div className="space-y-3">
        <p className="text-muted-foreground leading-relaxed italic">
          "Não há câmeras. Sua única arma é a voz."
        </p>
        <div className="p-4 rounded-lg bg-gold/5 border border-gold/20">
          <div className="flex items-center gap-3">
            <AudioWaveform className="w-6 h-6 text-gold" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              O Jogador tem <span className="text-gold font-semibold">60 segundos</span> para gravar uma defesa. 
              O Júri deve ouvir atentamente antes de votar.
            </p>
          </div>
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
      <main className="max-w-2xl mx-auto px-4 py-6 pb-40">
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
                    <h2 className="font-orbitron text-foreground font-bold tracking-wide text-sm md:text-base">
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

          {/* Footer quote */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 p-4 rounded-xl bg-gradient-to-r from-gold/5 via-gold/10 to-gold/5 border border-gold/20 text-center"
          >
            <p className="text-gold/80 italic text-sm font-medium">
              "A confiança é a moeda mais cara deste jogo. Use-a com sabedoria."
            </p>
          </motion.div>
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
