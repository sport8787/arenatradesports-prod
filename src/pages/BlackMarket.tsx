import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Vault, Coins, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEconomy } from '@/hooks/useEconomy';
import BluffCoinDisplay from '@/components/game/BluffCoinDisplay';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

import prizeGiftcard from '@/assets/prize-giftcard.jpg';
import prizePix from '@/assets/prize-pix.jpg';
import prizePix50 from '@/assets/prize-pix-50.jpg';
import prizeMaleta from '@/assets/prize-maleta.jpg';
import prizePs5 from '@/assets/prize-ps5.jpg';
import prizeIphone from '@/assets/prize-iphone.jpg';

interface PrizeCard {
  id: number;
  name: string;
  price: string;
  priceValue: number;
  image: string;
  description: string;
}

// Sorted from cheapest to most expensive
const prizes: PrizeCard[] = [
  {
    id: 1,
    name: 'PIX R$ 50',
    price: '50k BC',
    priceValue: 50000,
    image: prizePix50,
    description: 'Dinheiro direto na sua conta',
  },
  {
    id: 2,
    name: 'GiftCard R$ 500',
    price: '100k BC',
    priceValue: 100000,
    image: prizeGiftcard,
    description: 'Use em qualquer loja online',
  },
  {
    id: 3,
    name: 'Pix de R$ 1.000',
    price: '200k BC',
    priceValue: 200000,
    image: prizePix,
    description: 'Dinheiro direto na sua conta',
  },
  {
    id: 4,
    name: 'Maleta Física Oficial',
    price: '500k BC',
    priceValue: 500000,
    image: prizeMaleta,
    description: 'Edição limitada do jogo',
  },
  {
    id: 5,
    name: 'PlayStation 5',
    price: '800k BC',
    priceValue: 800000,
    image: prizePs5,
    description: 'Console de última geração',
  },
  {
    id: 6,
    name: 'iPhone 16 Pro',
    price: '1M BC',
    priceValue: 1000000,
    image: prizeIphone,
    description: 'O smartphone mais avançado',
  },
];

export default function BlackMarket() {
  const { bcBalance, loading } = useEconomy();
  const userCoins = bcBalance;

  const formatCoins = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
    return amount.toString();
  };

  const getCoinsNeeded = (priceValue: number) => {
    const needed = priceValue - userCoins;
    return needed > 0 ? needed : 0;
  };

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
          
          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-2 rounded-lg border border-border min-w-[80px] justify-center">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gold" />
                <Skeleton className="h-4 w-12" />
              </div>
            ) : (
              <BluffCoinDisplay amount={userCoins} size="sm" showChange={false} />
            )}
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
                animate={{ opacity: 0.7, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={{ opacity: 1, scale: 1.02 }}
                className="relative group cursor-pointer"
              >
                <div className="rounded-xl bg-secondary/30 border border-border/50 overflow-hidden select-none transition-all duration-300 group-hover:border-gold/50 group-hover:shadow-lg group-hover:shadow-gold/10">
                  {/* EM BREVE Badge */}
                  <div className="absolute top-3 right-3 z-10 bg-gold/90 text-background text-xs font-bold px-2 py-1 rounded">
                    EM BREVE
                  </div>
                  
                  {/* Product Image */}
                  <div className="w-full h-40 overflow-hidden relative">
                    <img 
                      src={prize.image} 
                      alt={prize.name}
                      className="w-full h-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-110"
                    />
                    {/* Hover Overlay with Description */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
                      <p className="text-foreground/90 text-sm text-center font-medium">
                        {prize.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Prize Info */}
                  <div className="p-4 text-center transition-all duration-300">
                    <h4 className="font-orbitron font-bold text-foreground/70 group-hover:text-foreground transition-colors">
                      {prize.name}
                    </h4>
                    <p className="text-gold/70 font-orbitron text-sm mt-1 group-hover:text-gold transition-colors">
                      {prize.price}
                    </p>
                    {/* Coins Needed Counter */}
                    {getCoinsNeeded(prize.priceValue) > 0 ? (
                      <p className="text-xs text-muted-foreground mt-2 group-hover:text-foreground/70 transition-colors">
                        Faltam <span className="text-gold font-bold">{formatCoins(getCoinsNeeded(prize.priceValue))}</span> coins
                      </p>
                    ) : (
                      <p className="text-xs text-cyan mt-2 font-bold">
                        ✓ Saldo suficiente!
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

      {/* How to Earn BC Button */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Link to="/como-ganhar-bc">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="
                w-full max-w-md mx-auto
                px-8 py-4 rounded-xl
                bg-gradient-to-r from-gold/20 to-amber-500/20
                border-2 border-gold/50 hover:border-gold
                text-gold
                font-orbitron font-bold text-lg
                flex items-center justify-center gap-3
                transition-all hover:shadow-lg hover:shadow-gold/20
              "
            >
              <Coins className="w-5 h-5" />
              COMO CONQUISTAR BLUFFCOINS
            </motion.button>
          </Link>
        </motion.section>

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
