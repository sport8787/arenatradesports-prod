import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Vault, Gift, Smartphone, Briefcase, Banknote, Gamepad2, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRankings } from '@/hooks/useRankings';
import BluffCoinDisplay from '@/components/game/BluffCoinDisplay';
import GoldButton from '@/components/game/GoldButton';
import { toast } from '@/hooks/use-toast';

interface PrizeCard {
  id: number;
  name: string;
  price: string;
  priceValue: number;
  icon: React.ReactNode;
  gradient: string;
}

const prizes: PrizeCard[] = [
  {
    id: 1,
    name: 'iPhone 16 Pro',
    price: '1M Coins',
    priceValue: 1000000,
    icon: <Smartphone className="w-10 h-10" />,
    gradient: 'from-blue-500/20 to-purple-500/20',
  },
  {
    id: 2,
    name: 'Maleta Física Oficial',
    price: '500k Coins',
    priceValue: 500000,
    icon: <Briefcase className="w-10 h-10" />,
    gradient: 'from-gold/20 to-primary/20',
  },
  {
    id: 3,
    name: 'Pix de R$ 1.000',
    price: '200k Coins',
    priceValue: 200000,
    icon: <Banknote className="w-10 h-10" />,
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  {
    id: 4,
    name: 'PlayStation 5',
    price: '800k Coins',
    priceValue: 800000,
    icon: <Gamepad2 className="w-10 h-10" />,
    gradient: 'from-blue-600/20 to-indigo-500/20',
  },
  {
    id: 5,
    name: 'GiftCard R$ 500',
    price: '100k Coins',
    priceValue: 100000,
    icon: <CreditCard className="w-10 h-10" />,
    gradient: 'from-yellow-500/20 to-orange-500/20',
  },
  {
    id: 6,
    name: 'Título Exclusivo',
    price: '10k Coins',
    priceValue: 10000,
    icon: <Gift className="w-10 h-10" />,
    gradient: 'from-cyan-500/20 to-blue-500/20',
  },
];

export default function BlackMarket() {
  const { myRanking } = useRankings();
  const userCoins = myRanking?.total_points || 0;

  const handleRedeemClick = () => {
    toast({
      title: '🔒 Cofre Bloqueado',
      description: 'Aguarde a abertura oficial da temporada.',
      duration: 3000,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Voltar</span>
          </Link>
          
          <h1 className="font-orbitron font-black text-xl md:text-2xl text-gold text-glow-gold">
            MERCADO NEGRO
          </h1>
          
          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-2 rounded-lg border border-border">
            <BluffCoinDisplay amount={userCoins} size="sm" showChange={false} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="relative inline-block"
          >
            <div className="w-32 h-32 mx-auto rounded-2xl bg-gradient-to-br from-gold/20 via-primary/10 to-gold-dark/20 border-2 border-gold/30 flex items-center justify-center">
              <Vault className="w-16 h-16 text-gold" />
            </div>
            <motion.div
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1 rounded-full"
            >
              <Lock className="w-3 h-3 inline mr-1" />
              FECHADO
            </motion.div>
          </motion.div>

          <div className="space-y-3">
            <h2 className="font-orbitron text-3xl md:text-4xl font-black text-foreground">
              O COFRE AINDA ESTÁ FECHADO.
            </h2>
            <p className="text-lg md:text-xl text-gold max-w-lg mx-auto">
              Em breve suas <span className="font-bold">BLUFFCOINS</span> valerão prêmios reais. 
              <br />
              <span className="text-muted-foreground">Continue acumulando.</span>
            </p>
          </div>
        </motion.section>

        {/* Showcase Grid */}
        <section className="space-y-6">
          <h3 className="font-orbitron text-xl text-muted-foreground text-center">
            VITRINE DE PRÊMIOS
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {prizes.map((prize, index) => (
              <motion.div
                key={prize.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 0.5, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="relative group"
              >
                <div className={`
                  p-6 rounded-xl bg-gradient-to-br ${prize.gradient}
                  border border-border/50 
                  pointer-events-none select-none
                  transition-all duration-300
                `}>
                  {/* EM BREVE Badge */}
                  <div className="absolute top-3 right-3 bg-gold/90 text-background text-xs font-bold px-2 py-1 rounded">
                    EM BREVE
                  </div>
                  
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="text-muted-foreground">
                      {prize.icon}
                    </div>
                    <div>
                      <h4 className="font-orbitron font-bold text-foreground/70">
                        {prize.name}
                      </h4>
                      <p className="text-gold/70 font-orbitron text-sm mt-1">
                        {prize.price}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Locked CTA Button */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center pb-8"
        >
          <button
            onClick={handleRedeemClick}
            className="
              w-full max-w-md mx-auto
              px-8 py-4 rounded-xl
              bg-muted/50 
              border border-border
              text-muted-foreground
              font-orbitron font-bold text-lg
              opacity-50 cursor-not-allowed
              flex items-center justify-center gap-3
              transition-all hover:opacity-60
            "
          >
            <Lock className="w-5 h-5" />
            LIBERAR RESGATE
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            O resgate será liberado quando a temporada oficial iniciar
          </p>
        </motion.section>
      </main>
    </div>
  );
}
