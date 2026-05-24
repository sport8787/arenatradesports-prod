import { Button } from "@/components/ui/button";
import { X, Zap, AlertTriangle, Flame } from "lucide-react";
import { track } from "@/lib/analytics";
import { useEffect } from "react";
import type { UpsellTrigger } from "@/hooks/useDayPassUpsell";

interface Props {
  trigger: NonNullable<UpsellTrigger>;
  msLeft: number;
  onClick: () => void;
  onDismiss: () => void;
}

const COPY: Record<NonNullable<UpsellTrigger>, { title: string; cta: string; icon: any; cls: string }> = {
  green: {
    title: "Você acaba de ver o Oráculo trabalhar. Continue por R$ 47/mês.",
    cta: "Continuar acesso →",
    icon: Zap,
    cls: "bg-emerald-600 text-white border-emerald-700",
  },
  "4h": {
    title: "Faltam menos de 4h do seu Day Pass — garanta acesso contínuo por R$ 47/mês",
    cta: "Continuar acesso →",
    icon: AlertTriangle,
    cls: "bg-amber-500 text-black border-amber-600",
  },
  "1h": {
    title: "ÚLTIMA HORA do seu acesso. Não perca o ritmo — R$ 47/mês.",
    cta: "ASSINAR AGORA →",
    icon: Flame,
    cls: "bg-red-600 text-white border-red-700",
  },
};

export function UpsellBanner({ trigger, msLeft, onClick, onDismiss }: Props) {
  const { title, cta, icon: Icon, cls } = COPY[trigger];
  const hoursLeft = Math.max(0, Math.floor(msLeft / 3600_000));
  const minsLeft = Math.max(0, Math.floor((msLeft % 3600_000) / 60_000));

  useEffect(() => {
    track.custom("upsell_banner_viewed", { trigger });
  }, [trigger]);

  return (
    <div className={`sticky top-0 z-50 w-full border-b-2 ${cls} shadow-lg`}>
      <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-3">
        <Icon className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold leading-tight truncate">{title}</div>
          {msLeft > 0 && trigger !== "green" && (
            <div className="text-xs opacity-90">Resta: {hoursLeft}h {minsLeft}min</div>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => { track.custom("upsell_cta_clicked", { trigger, location: "banner" }); onClick(); }}
          className="shrink-0 font-bold"
        >
          {cta}
        </Button>
        <button
          aria-label="Dispensar"
          onClick={onDismiss}
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
