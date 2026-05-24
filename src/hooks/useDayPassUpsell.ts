// Gatilhos de upsell para usuários Day Pass:
//  A) 1º GREEN no dia
//  B) ≤ 4h restantes
//  C) ≤ 1h restantes
// Dismiss persistido em localStorage para não spammar.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

export type UpsellTrigger = "green" | "4h" | "1h" | null;

const DISMISS_KEY = (uid: string, trig: string) => `upsell:dismissed:${uid}:${trig}`;

export function useDayPassUpsell() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [hasUpsell, setHasUpsell] = useState<boolean | null>(null);
  const [greenDetected, setGreenDetected] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick a cada 60s para atualizar contagem regressiva
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Checa assinatura ativa (esconde upsell se já assinou)
  useEffect(() => {
    if (!user) { setHasUpsell(null); return; }
    let cancelled = false;
    supabase
      .from("day_pass_upsells")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setHasUpsell(data?.status === "active");
      });
    return () => { cancelled = true; };
  }, [user]);

  // Detecta 1º GREEN do usuário (subscribe + check inicial)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // Check inicial: tem algum GREEN nas últimas 24h?
    supabase
      .from("punter_sinais")
      .select("id")
      .eq("user_id", user.id)
      .eq("resultado", "GREEN")
      .gte("settled_at", new Date(Date.now() - 24 * 3600_000).toISOString())
      .limit(1)
      .then(({ data }) => {
        if (!cancelled && data && data.length > 0) setGreenDetected(true);
      });

    // Realtime
    const ch = supabase
      .channel(`upsell-green-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "punter_sinais", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if ((payload.new as any)?.resultado === "GREEN") setGreenDetected(true);
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  const trigger: UpsellTrigger = useMemo(() => {
    if (!user || hasUpsell === null || hasUpsell === true) return null;
    if (!subscription?.subscription_ends_at) return null;
    const endsAt = new Date(subscription.subscription_ends_at).getTime();
    const msLeft = endsAt - now;
    if (msLeft <= 0) return null; // já expirou

    const hoursLeft = msLeft / 3600_000;

    // Prioridade: 1h > 4h > green
    if (hoursLeft <= 1) return "1h";
    if (hoursLeft <= 4) return "4h";
    if (greenDetected) return "green";
    return null;
  }, [user, hasUpsell, subscription, now, greenDetected]);

  const dismissed = useMemo(() => {
    if (!user || !trigger) return false;
    try { return localStorage.getItem(DISMISS_KEY(user.id, trigger)) === "1"; }
    catch { return false; }
  }, [user, trigger]);

  const dismiss = () => {
    if (!user || !trigger) return;
    try { localStorage.setItem(DISMISS_KEY(user.id, trigger), "1"); } catch { /* noop */ }
  };

  const msLeft = subscription?.subscription_ends_at
    ? Math.max(0, new Date(subscription.subscription_ends_at).getTime() - now)
    : 0;

  return {
    trigger,
    shouldShow: !!trigger && !dismissed,
    dismiss,
    msLeft,
    hasActiveUpsell: hasUpsell === true,
    isDayPassUser: subscription?.plan === "premium" && !!subscription?.subscription_ends_at,
  };
}
