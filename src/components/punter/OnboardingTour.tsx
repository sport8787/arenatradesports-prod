import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Brain, Target, TrendingUp, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    icon: <Brain className="w-8 h-8 text-blue-400" />,
    title: 'Bem-vindo ao Oráculo Mycroft!',
    description: 'O Mycroft é sua IA de análise esportiva. Ele processa milhares de jogos e encontra oportunidades com vantagem matemática real.',
    color: 'from-blue-600/20 to-blue-700/10',
    border: 'border-blue-500/30',
  },
  {
    icon: <Target className="w-8 h-8 text-yellow-400" />,
    title: 'Entradas Inteligentes',
    description: 'Clique em "Analisar Jogos" para o Mycroft varrer as odds do mercado. Ele classifica cada oportunidade como Entrada Forte, Bom ou Moderado.',
    color: 'from-yellow-600/20 to-yellow-700/10',
    border: 'border-yellow-500/30',
  },
  {
    icon: <TrendingUp className="w-8 h-8 text-green-400" />,
    title: 'Gestão de Banca Automática',
    description: 'Configure sua banca e o Mycroft calcula automaticamente o stake ideal para cada entrada usando o critério de Kelly.',
    color: 'from-green-600/20 to-green-700/10',
    border: 'border-green-500/30',
  },
  {
    icon: <Zap className="w-8 h-8 text-purple-400" />,
    title: 'Trading Esportivo Ao Vivo',
    description: 'Acesse o Trading Esportivo para análises em tempo real durante os jogos. O Mycroft monitora e reclassifica oportunidades a cada minuto.',
    color: 'from-purple-600/20 to-purple-700/10',
    border: 'border-purple-500/30',
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
}

export default function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('onboarding_completed', 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onComplete();
  };

  const current = STEPS[step];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`relative w-full max-w-md bg-gradient-to-br ${current.color} border ${current.border} rounded-2xl p-8 shadow-2xl`}
          style={{ background: 'linear-gradient(135deg, #1a1f36, #0f1729)' }}
        >
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br ${current.color} ${current.border} border flex items-center justify-center`}>
              {current.icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{current.title}</h3>
            <p className="text-gray-300 text-sm leading-relaxed">{current.description}</p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === step ? 'w-6 bg-yellow-500' : i < step ? 'bg-yellow-500/50' : 'bg-gray-600'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            {step < STEPS.length - 1 && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="flex-1 text-gray-400 hover:text-white"
              >
                Pular
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-bold hover:from-yellow-600 hover:to-yellow-700"
            >
              {step < STEPS.length - 1 ? (
                <>Próximo <ArrowRight className="w-4 h-4 ml-1" /></>
              ) : (
                'Começar a usar!'
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
