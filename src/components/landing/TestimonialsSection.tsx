import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Testimonial {
  id: number;
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
  highlight?: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Pedro Santana",
    role: "Streamer • 50k seguidores",
    avatar: "PS",
    content: "O Mycroft é assustadoramente preciso. Minha audiência fica maluca tentando adivinhar quem está blefando. Nunca vi um jogo tão interativo para lives!",
    rating: 5,
    highlight: "assustadoramente preciso"
  },
  {
    id: 2,
    name: "Marina Costa",
    role: "Game Designer",
    avatar: "MC",
    content: "Finalmente um quiz que não é só sobre conhecimento. A mecânica de blefe adiciona uma camada de psicologia que deixa tudo muito mais emocionante.",
    rating: 5,
    highlight: "camada de psicologia"
  },
  {
    id: 3,
    name: "Lucas Ferreira",
    role: "Top 10 Ranking Solo",
    avatar: "LF",
    content: "Cheguei até a Rodada 12 blefando quase tudo. A adrenalina de enganar o Mycroft e o júri é viciante. Já gastei mais de 100 horas aqui.",
    rating: 5,
    highlight: "adrenalina é viciante"
  },
  {
    id: 4,
    name: "Ana Beatriz",
    role: "Apresentadora de Eventos",
    avatar: "AB",
    content: "Usei o Modo Apresentador em um evento corporativo. 200 pessoas jogando ao vivo. Foi o maior sucesso que já tive em dinâmica de grupo.",
    rating: 5,
    highlight: "maior sucesso"
  },
  {
    id: 5,
    name: "Rafael Mendes",
    role: "Campeão Temporada 1",
    avatar: "RM",
    content: "O sistema de ranks e BluffCoins me mantém voltando todo dia. A sensação de subir no ranking global é muito satisfatória.",
    rating: 5,
    highlight: "muito satisfatória"
  },
];

export const TestimonialsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <section ref={ref} className="relative py-20 px-4 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-foreground mb-4">
            O Que Dizem os <span className="text-primary">Jogadores</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Milhares de jogadores já entraram na arena. Veja o que eles pensam.
          </p>
        </motion.div>

        {/* Main Testimonial Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="max-w-3xl mx-auto mb-8"
        >
          <div className="relative p-8 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
            {/* Quote icon */}
            <div className="absolute -top-4 -left-4 w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Quote className="w-6 h-6 text-primary" />
            </div>

            {/* Content */}
            <div className="relative">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonials[activeIndex].rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-lg md:text-xl text-foreground mb-6 leading-relaxed">
                  "{testimonials[activeIndex].content.split(testimonials[activeIndex].highlight || '').map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span className="text-primary font-semibold">{testimonials[activeIndex].highlight}</span>
                      )}
                    </span>
                  ))}"
                </p>

                {/* Author */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-mycroft-green/30 flex items-center justify-center font-orbitron font-bold text-foreground border border-primary/30">
                    {testimonials[activeIndex].avatar}
                  </div>
                  <div>
                    <p className="font-orbitron font-bold text-foreground">{testimonials[activeIndex].name}</p>
                    <p className="text-sm text-muted-foreground">{testimonials[activeIndex].role}</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrev}
            className="rounded-full border-border/50 hover:border-primary/50"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          {/* Dots */}
          <div className="flex gap-2">
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setIsAutoPlaying(false);
                  setActiveIndex(i);
                }}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  i === activeIndex 
                    ? "w-6 bg-primary" 
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="rounded-full border-border/50 hover:border-primary/50"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-8 mt-12"
        >
          <div className="text-center">
            <p className="font-orbitron text-2xl font-bold text-primary">10K+</p>
            <p className="text-xs text-muted-foreground">Jogadores Ativos</p>
          </div>
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div className="text-center">
            <p className="font-orbitron text-2xl font-bold text-mycroft-green">4.9</p>
            <p className="text-xs text-muted-foreground">Avaliação Média</p>
          </div>
          <div className="h-8 w-px bg-border hidden sm:block" />
          <div className="text-center">
            <p className="font-orbitron text-2xl font-bold text-foreground">50K+</p>
            <p className="text-xs text-muted-foreground">Partidas Jogadas</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
