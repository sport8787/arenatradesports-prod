import { motion } from 'framer-motion';
import { Zap, AlertTriangle, Clock, ShoppingCart } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import GoldButton from './GoldButton';

interface InsufficientEnergyModalProps {
  open: boolean;
  onClose: () => void;
  requiredNT: number;
  currentNT: number;
  onBuyTokens?: () => void;
}

export function InsufficientEnergyModal({
  open,
  onClose,
  requiredNT,
  currentNT,
  onBuyTokens,
}: InsufficientEnergyModalProps) {
  const deficit = requiredNT - currentNT;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="luxury-card border-destructive/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-orbitron text-xl">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            Energia Insuficiente!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current vs Required */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Você tem</div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <Zap className="w-5 h-5 text-blue-400" />
                <span className="font-orbitron text-xl font-bold text-blue-400">
                  {currentNT}
                </span>
              </div>
            </div>
            <div className="text-2xl text-muted-foreground">/</div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Necessário</div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/30">
                <Zap className="w-5 h-5 text-destructive" />
                <span className="font-orbitron text-xl font-bold text-destructive">
                  {requiredNT}
                </span>
              </div>
            </div>
          </div>

          {/* Deficit */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center p-4 rounded-lg bg-destructive/10 border border-destructive/20"
          >
            <span className="text-muted-foreground">Faltam </span>
            <span className="font-orbitron font-bold text-destructive text-lg">
              {deficit} NT
            </span>
            <span className="text-muted-foreground"> para jogar</span>
          </motion.div>

          {/* Options */}
          <div className="space-y-3">
            <GoldButton 
              onClick={onBuyTokens} 
              className="w-full"
              size="lg"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Adquirir Neuro-Tokens
            </GoldButton>

            <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Ou aguarde o bônus diário</span>
            </div>

            <GoldButton 
              variant="ghost" 
              onClick={onClose}
              className="w-full"
            >
              Voltar
            </GoldButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
