// Centralized Telegram sender with unified deduplication.
// All Telegram dispatches MUST go through this function so that the same
// (match_id + market + verdict + channel) never gets sent twice.
//
// Even when no chat_id is provided (Telegram disabled period), the dedupe key
// is still recorded so that, when sends are reactivated, retro-broadcast won't
// flood the group with old messages.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendPayload {
  text: string;
  match_id?: string | null;
  market?: string | null;
  verdict?: string | null;     // APROVADO | GREEN | RED | CANCELADO | etc.
  channel?: string;            // 'main' | 'live-signals' | etc. default: 'main'
  source?: string;             // function name that triggered
  chat_id?: string | null;     // optional override; falls back to TELEGRAM_CHAT_ID
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  force?: boolean;             // bypass dedupe (rare; e.g. manual ops)
  dedupe_key?: string | null;  // optional explicit key
  enabled?: boolean;           // if false, only records dedupe row, doesn't send
}

function buildKey(p: SendPayload): string {
  if (p.dedupe_key) return p.dedupe_key;
  const parts = [
    p.channel || 'main',
    p.match_id || 'no-match',
    (p.market || 'no-market').toLowerCase().trim(),
    (p.verdict || 'no-verdict').toUpperCase().trim(),
  ];
  return parts.join('::');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json()) as SendPayload;
    if (!payload?.text) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const channel = payload.channel || 'main';
    const dedupeKey = buildKey(payload);

    // Dedupe check (unless force)
    if (!payload.force) {
      const { data: existing } = await supabase
        .from('telegram_dedupe')
        .select('id, sent_at')
        .eq('dedupe_key', dedupeKey)
        .maybeSingle();
      if (existing) {
        console.log(`[telegram-send-dedupe] 🔁 SKIP duplicate key=${dedupeKey} (sent_at=${existing.sent_at})`);
        return new Response(JSON.stringify({
          skipped: true, reason: 'duplicate', dedupe_key: dedupeKey,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Determine if we should actually hit Telegram API
    const cfgEnabled = (Deno.env.get('TELEGRAM_ENABLED') ?? 'false').toLowerCase() === 'true';
    const enabled = payload.enabled ?? cfgEnabled;
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = payload.chat_id || Deno.env.get('TELEGRAM_CHAT_ID');

    let telegramOk = false;
    let telegramError: string | null = null;

    if (enabled && botToken && chatId) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: payload.text,
            parse_mode: payload.parse_mode || 'HTML',
            disable_web_page_preview: true,
          }),
        });
        const tgJson = await tgRes.json().catch(() => ({}));
        telegramOk = tgRes.ok && tgJson?.ok === true;
        if (!telegramOk) {
          telegramError = `status=${tgRes.status} body=${JSON.stringify(tgJson)}`;
          console.error('[telegram-send-dedupe] Telegram API error:', telegramError);
        }
      } catch (e) {
        telegramError = e instanceof Error ? e.message : String(e);
        console.error('[telegram-send-dedupe] fetch error:', telegramError);
      }
    } else {
      console.log(`[telegram-send-dedupe] ⏸️ send disabled (enabled=${enabled}, hasToken=${!!botToken}, hasChat=${!!chatId}). Recording dedupe only.`);
    }

    // Record dedupe row (always — even if send disabled — to prevent backlog floods on reactivation)
    const { error: insErr } = await supabase.from('telegram_dedupe').insert({
      dedupe_key: dedupeKey,
      match_id: payload.match_id ?? null,
      market: payload.market ?? null,
      verdict: payload.verdict ?? null,
      channel,
      source: payload.source ?? null,
    });
    if (insErr) {
      // Race: another concurrent call won the unique constraint — treat as duplicate
      if ((insErr as any).code === '23505') {
        return new Response(JSON.stringify({
          skipped: true, reason: 'duplicate_race', dedupe_key: dedupeKey,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.error('[telegram-send-dedupe] dedupe insert error:', insErr);
    }

    return new Response(JSON.stringify({
      success: true,
      telegram_sent: telegramOk,
      enabled,
      dedupe_key: dedupeKey,
      telegram_error: telegramError,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[telegram-send-dedupe] error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
