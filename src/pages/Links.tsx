import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MessageCircle, Send, Youtube, Music2, Info } from 'lucide-react';
import horusAvatar from '@/assets/horus-avatar.png';

const links = [
  {
    label: 'Testar 7 dias grátis',
    sub: 'Acesso total ao Oráculo Mycroft',
    href: 'https://oraculo-mycroft.com',
    icon: Sparkles,
    primary: true,
  },
  {
    label: 'WhatsApp',
    sub: 'Falar com a equipe',
    href: 'https://wa.me/5581973278848',
    icon: MessageCircle,
  },
  {
    label: 'Telegram VIP',
    sub: 'Grupo de sinais',
    href: 'https://t.me/oraculo_mycroft',
    icon: Send,
  },
  {
    label: 'YouTube',
    sub: '@OraculoMycroft',
    href: 'https://youtube.com/@OraculoMycroft',
    icon: Youtube,
  },
  {
    label: 'TikTok',
    sub: '@israelfideles',
    href: 'https://tiktok.com/@israelfideles',
    icon: Music2,
  },
  {
    label: 'Como funciona o Oráculo Mycroft',
    sub: 'Conheça a metodologia',
    href: 'https://oraculo-mycroft.com',
    icon: Info,
  },
];

export default function Links() {
  useEffect(() => {
    document.title = 'Oráculo Mycroft — Links Oficiais';
    const meta =
      document.querySelector('meta[name="description"]') ||
      Object.assign(document.createElement('meta'), { name: 'description' });
    meta.setAttribute(
      'content',
      'Links oficiais do Oráculo Mycroft: trial 7 dias grátis, WhatsApp, Telegram VIP, YouTube e TikTok.',
    );
    if (!meta.parentNode) document.head.appendChild(meta);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-amber-950/10 text-foreground">
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-5"
        >
          <div className="relative">
            <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-amber-500/20 blur-2xl" />
            <img
              src={horusAvatar}
              alt="Hórus — Oráculo Mycroft"
              className="h-28 w-28 rounded-full border-2 border-amber-500/60 object-cover shadow-[0_0_40px_rgba(245,158,11,0.35)]"
            />
          </div>
        </motion.div>

        <h1 className="text-center text-2xl font-bold tracking-tight">
          Oráculo Mycroft
        </h1>
        <p className="mt-1 text-center text-sm italic text-muted-foreground">
          "O Mycroft não torce. Ele calcula."
        </p>

        <div className="mt-8 flex w-full flex-col gap-3">
          {links.map((link, i) => {
            const Icon = link.icon;
            return (
              <motion.a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className={
                  link.primary
                    ? 'group relative overflow-hidden rounded-2xl border border-amber-400/60 bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4 text-amber-950 shadow-[0_0_30px_rgba(245,158,11,0.35)] transition hover:scale-[1.02]'
                    : 'group flex items-center gap-4 rounded-2xl border border-border/60 bg-card/60 px-5 py-4 backdrop-blur transition hover:scale-[1.02] hover:border-amber-500/40 hover:bg-card'
                }
              >
                <div className="flex items-center gap-4">
                  <div
                    className={
                      link.primary
                        ? 'flex h-11 w-11 items-center justify-center rounded-xl bg-amber-950/20'
                        : 'flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400'
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="leading-tight">
                    <div className={link.primary ? 'text-base font-bold' : 'text-base font-semibold'}>
                      {link.label}
                    </div>
                    <div className={link.primary ? 'text-xs font-medium text-amber-900/80' : 'text-xs text-muted-foreground'}>
                      {link.sub}
                    </div>
                  </div>
                </div>
                {link.primary && (
                  <span className="absolute inset-0 -z-10 animate-pulse bg-gradient-to-r from-amber-400/0 via-white/20 to-amber-400/0" />
                )}
              </motion.a>
            );
          })}
        </div>

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Oráculo Mycroft
        </footer>
      </main>
    </div>
  );
}
