// Quota guard global para The Odds API.
// - recordOddsApiUsage(headers): atualiza public.the_odds_api_quota a partir dos
//   headers `x-requests-remaining` / `x-requests-used` retornados pela API.
// - canCallOddsApi(min): bloqueia chamadas quando remaining < min (default 200).
// - Telegram alert quando remaining cair abaixo de 500 (throttle 1h via last_alert_at).
import { createClient } from "npm:@supabase/supabase-js@2";

const QUOTA_CACHE_TTL_MS = 5 * 60 * 1000;
let memCache: { remaining: number | null; ts: number } = { remaining: null, ts: 0 };

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function sendTelegramAlert(remaining: number) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chat = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: `⚠️ <b>The Odds API</b> — quota baixa: <b>${remaining}</b> requests restantes (limiar 500).`,
        parse_mode: "HTML",
      }),
    });
  } catch (e) {
    console.warn("[oddsApiQuota] telegram alert falhou:", (e as Error).message);
  }
}

export async function recordOddsApiUsage(headers: Headers): Promise<number | null> {
  const remStr = headers.get("x-requests-remaining");
  const usedStr = headers.get("x-requests-used");
  if (remStr == null) return null;
  const remaining = Number(remStr);
  const used = usedStr != null ? Number(usedStr) : null;
  if (!Number.isFinite(remaining)) return null;

  memCache = { remaining, ts: Date.now() };

  try {
    const sb = admin();
    const { data: prev } = await sb
      .from("the_odds_api_quota")
      .select("last_alert_at")
      .eq("id", 1)
      .maybeSingle();

    const patch: Record<string, any> = {
      id: 1,
      remaining,
      used,
      updated_at: new Date().toISOString(),
    };

    const shouldAlert = remaining < 500 && (
      !prev?.last_alert_at ||
      Date.now() - new Date(prev.last_alert_at).getTime() > 60 * 60 * 1000
    );
    if (shouldAlert) {
      patch.last_alert_at = new Date().toISOString();
      await sendTelegramAlert(remaining);
    }

    await sb.from("the_odds_api_quota").upsert(patch, { onConflict: "id" });
  } catch (e) {
    console.warn("[oddsApiQuota] persist falhou:", (e as Error).message);
  }
  return remaining;
}

export async function getOddsApiRemaining(): Promise<number | null> {
  if (memCache.remaining != null && Date.now() - memCache.ts < QUOTA_CACHE_TTL_MS) {
    return memCache.remaining;
  }
  try {
    const sb = admin();
    const { data } = await sb
      .from("the_odds_api_quota")
      .select("remaining")
      .eq("id", 1)
      .maybeSingle();
    const rem = data?.remaining ?? null;
    memCache = { remaining: rem, ts: Date.now() };
    return rem;
  } catch {
    return null;
  }
}

export async function canCallOddsApi(minRemaining = 200): Promise<boolean> {
  const rem = await getOddsApiRemaining();
  if (rem == null) return true; // sem leitura ainda — permite
  return rem >= minRemaining;
}
