import { motion } from 'framer-motion';
import { Bot, Youtube, Instagram, Twitter, Twitch, MessageCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const socialLinks = [
  { icon: Youtube, label: 'YouTube', href: '#', color: 'hover:text-red-500' },
  { icon: Instagram, label: 'Instagram', href: '#', color: 'hover:text-pink-500' },
  { icon: Twitter, label: 'Twitter/X', href: '#', color: 'hover:text-sky-400' },
  { icon: Twitch, label: 'Twitch', href: '#', color: 'hover:text-purple-500' },
  { icon: MessageCircle, label: 'Discord', href: '#', color: 'hover:text-indigo-400' },
];

export const SocialFooter = () => {
  return (
    <footer className="border-t border-border/50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Top section */}
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-orbitron text-xl font-bold text-primary">MILLIONAIRE</span>
              <span className="font-orbitron text-xl font-bold text-foreground">BLUFF</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              O primeiro game show com detector de mentiras por IA. 
              Responda, blufe, e engane os jurados — se conseguir.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="w-4 h-4 text-mycroft-green" />
              <span>Powered by Mycroft AI</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-orbitron text-sm font-bold text-foreground mb-4">LINKS RÁPIDOS</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/como-jogar" className="text-muted-foreground hover:text-foreground transition-colors">
                  Como Jogar
                </a>
              </li>
              <li>
                <a href="/como-ganhar-bc" className="text-muted-foreground hover:text-foreground transition-colors">
                  Ganhar BluffCoins
                </a>
              </li>
              <li>
                <a href="/rankings" className="text-muted-foreground hover:text-foreground transition-colors">
                  Rankings
                </a>
              </li>
              <li>
                <a href="/privacidade" className="text-muted-foreground hover:text-foreground transition-colors">
                  Política de Privacidade
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-orbitron text-sm font-bold text-foreground mb-4">FIQUE POR DENTRO</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Receba novidades sobre atualizações, eventos e torneios.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="seu@email.com"
                className="flex-1 px-4 py-2 rounded-lg bg-muted/30 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
              <Button size="sm" className="btn-gold">
                <Mail className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-8" />

        {/* Social Links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Social icons */}
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground mr-3">Siga-nos:</span>
            {socialLinks.map((social) => (
              <motion.a
                key={social.label}
                href={social.href}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground ${social.color} transition-colors border border-transparent hover:border-border/50`}
                aria-label={social.label}
              >
                <social.icon className="w-5 h-5" />
              </motion.a>
            ))}
          </div>

          {/* Copyright */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>© 2025 Millionaire Bluff Arena</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">Todos os direitos reservados</span>
          </div>

          {/* Language selector placeholder */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-6 h-6 rounded overflow-hidden flex items-center justify-center bg-muted/30 text-xs font-bold">
              🇧🇷
            </span>
            <span>Português (BR)</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
