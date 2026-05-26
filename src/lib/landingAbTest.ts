// A/B Test do H1 da landing — variante persistida em localStorage e tracking PostHog
import posthog from "posthog-js";

const KEY = "om_h1_variant";

export type H1Variant = "A" | "B";

export const H1_VARIANTS: Record<H1Variant, { line1: string; highlight: string; line3: string }> = {
  A: {
    line1: "INTELIGÊNCIA ESTATÍSTICA",
    highlight: "PARA ANÁLISE ESPORTIVA",
    line3: "EM TEMPO REAL",
  },
  B: {
    line1: "ANÁLISE QUANTITATIVA",
    highlight: "DE EVENTOS ESPORTIVOS",
    line3: "COM IA E GESTÃO DE RISCO",
  },
};

export function getH1Variant(): H1Variant {
  if (typeof window === "undefined") return "A";
  try {
    const cached = localStorage.getItem(KEY) as H1Variant | null;
    if (cached === "A" || cached === "B") return cached;
    const v: H1Variant = Math.random() < 0.5 ? "A" : "B";
    localStorage.setItem(KEY, v);
    // Super-property para PostHog (todos os eventos seguintes carregam a variante)
    try {
      posthog?.register?.({ landing_h1_variant: v });
      posthog?.capture?.("landing_h1_assigned", { variant: v });
    } catch { /* posthog ainda não inicializado */ }
    return v;
  } catch {
    return "A";
  }
}

export function trackH1Conversion(eventName: string, extra: Record<string, unknown> = {}) {
  try {
    const v = (typeof window !== "undefined" && (localStorage.getItem(KEY) as H1Variant)) || "A";
    posthog?.capture?.(eventName, { ...extra, landing_h1_variant: v });
  } catch { /* noop */ }
}
