import { supabase } from "@/integrations/supabase/client";

export const extraMarketsService = {
  async runExtraMarkets() {
    const { data, error } = await supabase.functions.invoke("mycroft-extra-markets", {
      body: { source: "manual" },
    });
    if (error) throw error;
    return data;
  },

  async runCards() {
    const { data, error } = await supabase.functions.invoke("mycroft-cards-punter", {
      body: { source: "manual" },
    });
    if (error) throw error;
    return data;
  },

  async runAll() {
    const [extra, cards] = await Promise.allSettled([
      this.runExtraMarkets(),
      this.runCards(),
    ]);
    return {
      extra: extra.status === "fulfilled" ? extra.value : { error: (extra as any).reason?.message },
      cards: cards.status === "fulfilled" ? cards.value : { error: (cards as any).reason?.message },
    };
  },
};
