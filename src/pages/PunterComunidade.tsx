import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, MessagesSquare, Info, ExternalLink } from 'lucide-react';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import { FOUNDERS_GROUP } from '@/config/foundersGroup';

const TELEGRAM_URL = 'https://t.me/oraculo_mycroft';
const SUPPORT_WHATSAPP =
  'https://wa.me/5581982221714?text=Preciso%20de%20ajuda%20com%20o%20Or%C3%A1culo%20Mycroft';

interface Channel {
  title: string;
  description: string;
  cta: string;
  url: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
}

const CHANNELS: Channel[] = [
  {
    title: 'Grupo VIP Telegram',
    description:
      'Sinais e alertas em tempo real. Receba todas as oportunidades aprovadas pelo Mycroft assim que forem detectadas.',
    cta: 'Entrar no Telegram',
    url: TELEGRAM_URL,
    icon: <MessageCircle className="w-5 h-5" />,
    color: '#229ED9',
  },
  {
    title: 'Grupo Fundadores',
    description:
      'Acesso direto ao fundador, voz no roadmap do produto e benefícios exclusivos da fase fundadora.',
    cta: 'Entrar no WhatsApp',
    url: FOUNDERS_GROUP.url,
    icon: <MessagesSquare className="w-5 h-5" />,
    color: '#25D366',
    badge: 'Exclusivo',
  },
  {
    title: 'Suporte e Tutorial',
    description:
      'Dúvidas, bugs e como usar a plataforma. Atendimento humano via WhatsApp.',
    cta: 'Falar com suporte',
    url: SUPPORT_WHATSAPP,
    icon: <Info className="w-5 h-5" />,
    color: 'hsl(var(--foreground))',
  },
];

export default function PunterComunidadePage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/punter')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar para Arena Punter"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
            COMUNIDADE E SUPORTE
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-4">
        <PunterBreadcrumb items={[{ label: 'Comunidade e Suporte' }]} />
        <div>
          <h2 className="text-xl font-bold text-foreground">Canais oficiais</h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Conecte-se com a comunidade do Oráculo Mycroft e fale direto com o time.
          </p>
        </div>

        <div className="space-y-3">
          {CHANNELS.map((c) => (
            <a
              key={c.title}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-border rounded-xl bg-card p-4 hover:bg-card/70 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${c.color}26`, color: c.color }}
                >
                  {c.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground text-sm">{c.title}</p>
                    {c.badge && (
                      <span
                        className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border"
                        style={{
                          color: c.color,
                          borderColor: `${c.color}55`,
                          backgroundColor: `${c.color}14`,
                        }}
                      >
                        {c.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">
                    {c.description}
                  </p>
                  <span
                    className="inline-flex items-center gap-1 mt-3 text-[11px] font-mono font-semibold"
                    style={{ color: c.color }}
                  >
                    {c.cta}
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
