import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, MessagesSquare, Info, ExternalLink, BookOpen, CheckCircle2, Clock, LayoutGrid, Wallet, LineChart, Download, Sparkles } from 'lucide-react';
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

        {/* Tutorial: Principais funcionalidades */}
        <section className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Tutorial — Como usar o Oráculo Mycroft</h2>
          </div>
          <p className="font-mono text-xs text-muted-foreground mb-4">
            Guia rápido das principais funcionalidades da Arena Punter. Leia uma vez e domine a plataforma.
          </p>

          <div className="space-y-3">
            <TutorialItem
              icon={<Sparkles className="w-4 h-4" />}
              color="hsl(var(--primary))"
              title="1. Visão geral"
              body="O Oráculo Mycroft é uma plataforma de inteligência esportiva que entrega sinais aprovados, análises ao vivo e ferramentas de gestão de banca. Cada módulo (Punter, Trader Sports, Múltiplas) trabalha em conjunto para maximizar seu ROI com gestão profissional de risco."
            />
            <TutorialItem
              icon={<LayoutGrid className="w-4 h-4" />}
              color="hsl(var(--primary))"
              title="2. Menu de Funções"
              body='Toque em "Funções" no topo da tela para abrir o menu central (/punter/menu). Lá você encontra atalhos para todas as áreas: Apostas Aprovadas, Arena Trader Sports, Múltiplas, Banca, Desempenho, Importação e Comunidade.'
            />
            <TutorialItem
              icon={<CheckCircle2 className="w-4 h-4" />}
              color="hsl(var(--success))"
              title="3. Apostas Aprovadas"
              body="A página principal (/punter) lista todos os sinais ativos aprovados pelo Mycroft, com mercado, odd, edge, confiança e stake recomendada. Os sinais são liquidados automaticamente quando o jogo termina."
            />
            <TutorialItem
              icon={<Clock className="w-4 h-4" />}
              color="hsl(var(--destructive))"
              title="4. Arena Trader Sports"
              body="Análises ao vivo durante a partida, com leitura situacional do Mycroft. Use para identificar entradas in-play (LABAREDA, APROVADO SITUACIONAL) com gestão automática de cashout."
            />
            <TutorialItem
              icon={<LayoutGrid className="w-4 h-4" />}
              color="hsl(var(--primary))"
              title="5. Gerador de Múltiplas (Beta)"
              body="Construa múltiplas otimizadas pela IA usando Critério de Kelly e correlação entre mercados. O sistema sugere combinações com melhor relação risco/retorno."
            />
            <TutorialItem
              icon={<Wallet className="w-4 h-4" />}
              color="hsl(var(--warning))"
              title="6. Banca Virtual"
              body="Defina seu capital inicial e o sistema aplica gestão de stake automática (% Kelly fracionado). Simule resultados sem risco real e acompanhe a evolução."
            />
            <TutorialItem
              icon={<LineChart className="w-4 h-4" />}
              color="hsl(var(--primary))"
              title="7. Meu Desempenho"
              body="Painel completo de ROI, P&L, win rate, melhores mercados e ligas. Filtre por período e veja sua curva de banca."
            />
            <TutorialItem
              icon={<Download className="w-4 h-4" />}
              color="hsl(var(--foreground))"
              title="8. Importar Apostas"
              body="Conecte ou faça upload de extratos da Betfair (CSV/PDF) e outras casas para consolidar todo o seu histórico em um único painel."
            />
            <TutorialItem
              icon={<MessageCircle className="w-4 h-4" />}
              color="#229ED9"
              title="9. Notificações em tempo real"
              body="Ative o Telegram VIP e/ou as notificações push do navegador para receber alertas instantâneos quando um sinal for APROVADO ou liquidado (GREEN/RED)."
            />
            <TutorialItem
              icon={<Info className="w-4 h-4" />}
              color="hsl(var(--foreground))"
              title="10. Suporte"
              body="Dúvidas, bugs ou sugestões? Fale com o time pelo WhatsApp acima. Resposta humana, normalmente em poucos minutos."
            />
          </div>

          <div className="mt-4 p-3 rounded-lg border border-primary/30 bg-primary/5">
            <p className="text-[11px] font-mono text-muted-foreground leading-relaxed">
              💡 <span className="text-foreground font-semibold">Dica:</span> comece configurando sua banca virtual,
              acompanhe os sinais aprovados por 7 dias, e só depois aumente o stake real. A disciplina é o que separa
              o apostador do investidor.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function TutorialItem({
  icon,
  color,
  title,
  body,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 border border-border/60 rounded-lg bg-card p-3">
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-foreground text-sm leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-snug">{body}</p>
      </div>
    </div>
  );
}
