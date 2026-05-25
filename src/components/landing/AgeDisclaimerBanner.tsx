import { AlertTriangle } from 'lucide-react';

export default function AgeDisclaimerBanner() {
  return (
    <div className="w-full bg-red-950/80 border-b border-red-500/30 text-center py-1.5 px-4 text-xs text-red-200/90">
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
        <strong>+18 anos.</strong> Entradas esportivas envolvem risco de dependência. Jogue com responsabilidade.
        <span className="hidden sm:inline"> Proibido para menores de 18 anos.</span>
      </span>
    </div>
  );
}
