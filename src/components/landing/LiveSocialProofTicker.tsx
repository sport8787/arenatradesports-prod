import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';

const NAMES = ['João', 'Pedro', 'Lucas', 'Rafael', 'Gabriel', 'Bruno', 'Felipe', 'Carlos', 'Marcos', 'André', 'Thiago', 'Diego', 'Matheus', 'Vinícius', 'Rodrigo', 'Eduardo', 'Mariana', 'Camila', 'Fernanda', 'Juliana'];
const CITIES = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre', 'Salvador', 'Recife', 'Brasília', 'Fortaleza', 'Goiânia', 'Manaus', 'Campinas', 'Florianópolis', 'Vitória', 'Natal'];
const ACTIONS = [
  'ativou o trial gratuito',
  'assinou o plano Professional',
  'entrou no grupo VIP',
  'recebeu entrada aprovado',
  'fechou green com Mycroft',
];

interface Notification {
  id: number;
  name: string;
  city: string;
  action: string;
  minutesAgo: number;
}

const random = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const generate = (): Notification => ({
  id: Date.now() + Math.random(),
  name: random(NAMES),
  city: random(CITIES),
  action: random(ACTIONS),
  minutesAgo: Math.floor(Math.random() * 8) + 1,
});

export default function LiveSocialProofTicker() {
  const [current, setCurrent] = useState<Notification | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showOne = () => {
      setCurrent(generate());
      setVisible(true);
      setTimeout(() => setVisible(false), 5000);
    };
    const initial = setTimeout(showOne, 4000);
    const interval = setInterval(showOne, 12000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: -20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.4 }}
          className="fixed bottom-20 sm:bottom-6 left-4 z-40 max-w-xs"
        >
          <div className="bg-[#1a1f36] border border-green-500/40 rounded-lg shadow-2xl p-3 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  <span className="font-semibold">{current.name}</span> de {current.city}
                </p>
                <p className="text-xs text-gray-400">
                  {current.action} • há {current.minutesAgo} min
                </p>
              </div>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0 mt-2" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
