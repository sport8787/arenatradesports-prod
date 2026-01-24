/**
 * Modal de Consentimento LGPD para Mycroft
 * Permite ao jogador aceitar ou recusar a análise vocal
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, Shield, Eye, Database, Lock, Settings, 
  ExternalLink, Check, X, Info, Brain, Waves
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface MycroftConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
}

export default function MycroftConsentModal({
  isOpen,
  onAccept,
  onDecline,
  onClose
}: MycroftConsentModalProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-xl border-primary/30">
        <DialogHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="p-3 rounded-full bg-primary/20 border border-primary/30"
            >
              <Mic className="w-6 h-6 text-primary" />
            </motion.div>
          </div>
          <DialogTitle className="text-xl font-bold">
            🎙️ Ativação do Mycroft
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Análise de Convicção por Voz
          </p>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Intro */}
          <p className="text-center text-muted-foreground">
            Para ativar o <span className="text-primary font-semibold">Mycroft</span>, nosso analista comportamental, 
            precisamos analisar sua voz durante as justificativas.
          </p>

          <Separator className="my-4" />

          {/* What is analyzed */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              O Que Será Analisado
            </h3>
            <ul className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Waves className="w-3 h-3 text-primary/70" />
                Ritmo e fluidez da fala
              </li>
              <li className="flex items-center gap-1.5">
                <Waves className="w-3 h-3 text-primary/70" />
                Pausas e hesitações
              </li>
              <li className="flex items-center gap-1.5">
                <Waves className="w-3 h-3 text-primary/70" />
                Variações de tom
              </li>
              <li className="flex items-center gap-1.5">
                <Waves className="w-3 h-3 text-primary/70" />
                Pitch, jitter, shimmer
              </li>
            </ul>
          </div>

          <Separator className="my-3" />

          {/* Purpose */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Para Que Usamos Esses Dados
            </h3>
            
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Durante a partida:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-success" />
                  Auxiliar o júri com análise comportamental em tempo real
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-success" />
                  Gerar feedback de performance ao final do jogo
                </li>
              </ul>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-foreground">Após a partida:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-success" />
                  Estatísticas anônimas ajudam a melhorar a precisão
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3 h-3 text-success" />
                  Com sua autorização, treinar a IA para beneficiar todos
                </li>
              </ul>
              <p className="text-[10px] text-muted-foreground italic">
                (Você decide se quer compartilhar ou não)
              </p>
            </div>
          </div>

          <Separator className="my-3" />

          {/* Data handling */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              O Que Fazemos Com Sua Gravação
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-success/10 rounded-lg p-2.5 border border-success/30">
                <p className="text-xs font-medium text-success mb-1">Durante o jogo</p>
                <p className="text-[10px] text-muted-foreground">
                  Análise em tempo real no seu dispositivo
                </p>
              </div>
              <div className="bg-primary/10 rounded-lg p-2.5 border border-primary/30">
                <p className="text-xs font-medium text-primary mb-1">Depois do jogo</p>
                <p className="text-[10px] text-muted-foreground">
                  Áudio deletado automaticamente. Guardamos apenas métricas anônimas.
                </p>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground bg-muted/20 p-2 rounded text-center">
              💡 Se quiser ajudar o Mycroft a evoluir, você pode autorizar 
              armazenamento criptografado nas configurações posteriormente.
            </p>
          </div>

          <Separator className="my-3" />

          {/* Important guarantees */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4 text-success" />
              Importante
            </h3>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-1.5">
                <Check className="w-3 h-3 text-success mt-0.5 shrink-0" />
                Sua voz <strong className="text-foreground">NÃO</strong> é usada para identificação civil
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3 h-3 text-success mt-0.5 shrink-0" />
                <strong className="text-foreground">NÃO</strong> realizamos diagnósticos médicos ou psicológicos
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3 h-3 text-success mt-0.5 shrink-0" />
                O júri humano <strong className="text-foreground">SEMPRE</strong> tem a palavra final
              </li>
              <li className="flex items-start gap-1.5">
                <Check className="w-3 h-3 text-success mt-0.5 shrink-0" />
                Você pode revogar consentimento a qualquer momento
              </li>
            </ul>
          </div>

          {/* How to change mind */}
          <div className="bg-muted/20 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Mudou de ideia?</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Desative em <span className="text-primary">Configurações → Privacidade</span>
              <br />ou solicite exclusão: <span className="text-primary">privacidade@blefador.com.br</span>
            </p>
          </div>

          {/* Privacy Policy link */}
          <a 
            href="/privacidade" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Política de Privacidade completa
          </a>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={onDecline}
              className="w-full border-muted-foreground/30"
            >
              <X className="w-4 h-4 mr-2" />
              Jogar Sem Mycroft
            </Button>
            <Button
              onClick={onAccept}
              className="w-full bg-success hover:bg-success/90 text-success-foreground"
            >
              <Check className="w-4 h-4 mr-2" />
              Aceito e Ativar
            </Button>
          </div>
          
          <p className="text-[10px] text-center text-muted-foreground">
            Você pode jogar normalmente sem Mycroft.
            <br />
            Ao aceitar, ele será ativado nesta e nas próximas partidas.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Button component to trigger the modal
export function MycroftConsentButton({ 
  onClick,
  hasConsented,
  className
}: { 
  onClick: () => void;
  hasConsented: boolean | null;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
        hasConsented === true 
          ? "bg-success/20 text-success border border-success/30 hover:bg-success/30" 
          : hasConsented === false 
            ? "bg-muted/30 text-muted-foreground border border-muted hover:bg-muted/50"
            : "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 animate-pulse",
        className
      )}
    >
      <Shield className="w-3.5 h-3.5" />
      {hasConsented === true 
        ? "Mycroft Ativo" 
        : hasConsented === false 
          ? "Mycroft Desativado"
          : "Ativar Mycroft"}
    </button>
  );
}
