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
      toast.success('Sinal copiado!');
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
        {copied ? 'Copiado' : 'Copiar sinal'}
      </Button>

      <div className="flex flex-wrap gap-1.5">
        {BOOKMAKERS.map((b) => (
          <a
            key={b.name}
            href={b.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex-1 min-w-[90px] inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${b.color}`}
            aria-label={`Abrir ${b.name}`}
          >
            {b.name}
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/80 italic leading-tight">
        💡 Copie o sinal, abra a casa e cole/insira a aposta no bilhete.
      </p>
    </div>
  );
}
