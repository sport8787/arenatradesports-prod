/**
 * Modal para validação da Maleta Fundador
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, X, Loader2, Check, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import GoldButton from './GoldButton';

interface FounderCaseModalProps {
  open: boolean;
  onValidate: (success: boolean) => void;
  onClose: () => void;
  validateCode: (code: string) => Promise<boolean>;
}

export function FounderCaseModal({ open, onValidate, onClose, validateCode }: FounderCaseModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleValidate = async () => {
    if (code.length < 6) {
      setError('Código deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isValid = await validateCode(code);
      if (isValid) {
        setSuccess(true);
        setTimeout(() => {
          onValidate(true);
        }, 1500);
      } else {
        setError('Código inválido ou já em uso');
      }
    } catch (err) {
      setError('Erro ao validar código');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-card border-2 border-gold/30 rounded-2xl p-6 w-full max-w-md space-y-6 relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-b from-gold/10 via-transparent to-transparent pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Header */}
          <div className="text-center relative z-10">
            <motion.div
              animate={{ 
                rotate: success ? [0, -10, 10, -10, 0] : 0,
                scale: success ? [1, 1.2, 1] : 1
              }}
              transition={{ duration: 0.5 }}
              className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center border-2 border-gold/50"
            >
              {success ? (
                <Check className="w-10 h-10 text-gold" />
              ) : (
                <Briefcase className="w-10 h-10 text-gold" />
              )}
            </motion.div>
            
            <h2 className="font-orbitron text-2xl font-bold text-gold mb-2">
              Maleta Fundador
            </h2>
            <p className="text-sm text-muted-foreground">
              Insira o código exclusivo para desbloquear o Modo Apresentador
            </p>
          </div>

          {/* Form */}
          {!success && (
            <div className="space-y-4 relative z-10">
              <div>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="CÓDIGO DA MALETA"
                  className="text-center font-orbitron text-xl tracking-widest h-14 bg-background/50 border-gold/30 focus:border-gold"
                  maxLength={12}
                  disabled={loading}
                />
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-destructive text-sm text-center mt-2"
                  >
                    {error}
                  </motion.p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <GoldButton
                  onClick={handleValidate}
                  disabled={loading || code.length < 6}
                  className="flex-1"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Validar
                    </>
                  )}
                </GoldButton>
              </div>
            </div>
          )}

          {/* Success state */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 relative z-10"
            >
              <p className="text-gold font-semibold text-lg">Maleta Desbloqueada!</p>
              <p className="text-muted-foreground text-sm mt-2">Redirecionando...</p>
            </motion.div>
          )}

          {/* Info */}
          <div className="text-center text-xs text-muted-foreground relative z-10 pt-2 border-t border-border/50">
            <p>Não tem uma Maleta Fundador?</p>
            <button className="text-gold hover:underline mt-1">
              Saiba como adquirir
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
