import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, Zap, TrendingUp } from 'lucide-react';

function useCountUp(target: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started) return;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [started, target, duration]);

  return { count, ref };
}

export default function LiveStatsCounter() {
  const analyses = useCountUp(12847);
  const signals = useCountUp(1658);
  const users = useCountUp(47);
  const winRate = useCountUp(59);

  return (
    <section className="py-12 bg-[#0a0f1e] border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={analyses.ref} className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<BarChart3 className="w-5 h-5" />}
            value={analyses.count.toLocaleString('pt-BR')}
            label="Jogos analisados"
            color="from-blue-500 to-blue-600"
            suffix="+"
          />
          <StatCard
            icon={<Zap className="w-5 h-5" />}
            value={signals.count.toLocaleString('pt-BR')}
            label="Entradas emitidos"
            color="from-yellow-500 to-yellow-600"
            suffix="+"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            value={`${winRate.count}`}
            label="Win Rate auditado"
            color="from-green-500 to-green-600"
            suffix="%"
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            value={users.count.toString()}
            label="Investidores ativos"
            color="from-purple-500 to-purple-600"
            suffix="+"
          />
        </div>
      </div>
    </section>
  );
}

function StatCard({ icon, value, label, color, suffix }: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
  suffix?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <div className={`w-10 h-10 mx-auto mb-3 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg`}>
        {icon}
      </div>
      <p className="text-3xl lg:text-4xl font-bold text-white">
        {value}<span className="text-lg text-gray-400">{suffix}</span>
      </p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </motion.div>
  );
}
