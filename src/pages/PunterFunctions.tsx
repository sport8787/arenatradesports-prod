import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Upload, Settings, Wallet, ChevronRight, Brain } from 'lucide-react';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';

interface FunctionItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
}

const FUNCTIONS: FunctionItem[] = [
  {
    title: 'Gate Dashboard A/B/C',
    description: 'Win rate, EV e ROI por bloco, liga e faixa de odd — dia/semana',
    icon: <BarChart3 className="w-4 h-4 text-primary" />,
    to: '/punter/gate-dashboard',
  },
  {
    title: 'Análise Detalhada',
    description: 'Comparativo, horários, config Hórus, oportunidades',
    icon: <BarChart3 className="w-4 h-4 text-primary" />,
    to: '/punter/analytics',
  },
  {
    title: 'Entradas Reais Betfair',
    description: 'Sincronize, analise erros e compare com a Arena Trader Sports',
    icon: <Brain className="w-4 h-4 text-primary" />,
    to: '/punter/betfair-real',
  },
  {
    title: 'Importar & Análise',
    description: 'CSV/PDF, ROI da banca virtual Hórus, comparativo manual',
    icon: <Upload className="w-4 h-4 text-primary" />,
    to: '/punter/import',
  },
  {
    title: 'Configurar Banca Virtual',
    description: 'Painel completo da banca Hórus IA + Minha Banca',
    icon: <Wallet className="w-4 h-4 text-primary" />,
    to: '/punter/banca-virtual',
  },
  {
    title: 'Configurações',
    description: 'Betfair, alertas Hórus, conexões',
    icon: <Settings className="w-4 h-4 text-primary" />,
    to: '/punter/config',
  },
];

export default function PunterFunctionsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/punter/menu')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar para Arena Punter"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
            FUNÇÕES DA ARENA PUNTER
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-3">
        <PunterBreadcrumb items={[{ label: 'Funções' }]} className="mb-2" />
        <div className="mb-2">
          <p className="font-mono text-xs text-muted-foreground">
            Acesse aqui as funções avançadas e configurações da Arena Punter.
          </p>
        </div>

        {FUNCTIONS.map((f) => (
          <button
            key={f.to}
            onClick={() => navigate(f.to)}
            className="w-full border border-border rounded-lg bg-card p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-3">
              {f.icon}
              <div className="text-left">
                <p className="font-mono text-sm font-semibold text-foreground">{f.title}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{f.description}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
        ))}
      </main>
    </div>
  );
}
