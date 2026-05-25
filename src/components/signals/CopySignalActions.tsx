import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { translateMarket } from '@/utils/marketTranslator';

export interface CopySignalData {
  match: string;
  market: string;
  odd?: number | null;
  league?: string | null;
  confidence?: number | null;
}

const BOOKMAKERS = [
  { name: 'Betano', url: 'https://www.betano.bet.br/', color: 'bg-[hsl(15,90%,55%)] hover:bg-[hsl(15,90%,50%)] text-white' },
  { name: 'Superbet', url: 'https://superbet.bet.br/', color: 'bg-[hsl(0,75%,50%)] hover:bg-[hsl(0,75%,45%)] text-white' },
  { name: 'Sportingbet', url: 'https://www.sportingbet.bet.br/pt-br/sports', color: 'bg-[hsl(140,60%,40%)] hover:bg-[hsl(140,60%,35%)] text-white' },
];

const EXTRA_BOOKMAKERS = [
  { name: 'Betfair', url: 'https://www.betfair.com', color: 'bg-[hsl(45,100%,52%)] hover:bg-[hsl(45,100%,47%)] text-black' },
  { name: 'Pinnacle', url: 'https://www.pinnacle.com', color: 'bg-[hsl(35,90%,50%)] hover:bg-[hsl(35,90%,45%)] text-white' },
  { name: 'Bet365', url: 'https://www.bet365.com', color: 'bg-[hsl(140,70%,25%)] hover:bg-[hsl(140,70%,20%)] text-white' },
];

export default function CopySignalActions({ signal, compact = false }: { signal: CopySignalData; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const formatted = [
    `🎯 SINAL APROVADO — Mycroft`,
    signal.league ? `🏆 ${signal.league}` : null,
    `⚽ ${signal.match}`,
    `📊 ${translateMarket(signal.market)}${signal.odd != null ? ` @ ${Number(signal.odd).toFixed(2)}` : ''}`,
    signal.confidence != null ? `💪 Confiança: ${signal.confidence}%` : null,
  ].filter(Boolean).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      toast.success('Entrada copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className={compact ? 'mt-2 space-y-2' : 'mt-3 space-y-2 pt-3 border-t border-border/50'}>
      <Button
        onClick={handleCopy}
        size="sm"
        variant="outline"
        className="w-full gap-1.5 h-8 text-xs"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copiado' : 'Copiar entrada'}
      </Button>

      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          {BOOKMAKERS.map((b) => (
            <a
              key={b.name}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-1 rounded-md px-1.5 ${compact ? 'py-1 text-[10px]' : 'py-1.5 text-[11px]'} font-bold uppercase tracking-wide transition-colors min-w-0 ${b.color}`}
              aria-label={`Abrir ${b.name}`}
            >
              <span className="truncate">{b.name}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {EXTRA_BOOKMAKERS.map((b) => (
            <a
              key={b.name}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-1 rounded-md px-1.5 ${compact ? 'py-1 text-[10px]' : 'py-1.5 text-[11px]'} font-bold uppercase tracking-wide transition-colors min-w-0 ${b.color}`}
              aria-label={`Abrir ${b.name}`}
            >
              <span className="truncate">{b.name}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/80 italic leading-tight">
        💡 Copie o entrada, abra a casa e cole/insira a entrada no bilhete.
      </p>
    </div>
  );
}
