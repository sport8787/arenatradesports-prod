import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  match_id: string;
  market: string;
  event_type: 'APROVADO' | 'LABAREDA' | 'CANCELADO' | 'GREEN' | 'RED' | 'CASHOUT';
  home_team: string;
  away_team: string;
  league?: string;
  odd?: number;
  confidence?: number;
  minute?: number;
  period?: string | null;
  status?: string | null;
  score_home?: number;
  score_away?: number;
  previous_market?: string; // para CANCELADO
  previous_odd?: number;
  previous_confidence?: number;
  // para GREEN / RED / CASHOUT
  pnl?: number;          // R$ ganho ou perdido (negativo se RED)
  stake_value?: number;  // R$ apostados
  new_balance?: number;  // saldo virtual após liquidação (opcional)
}

function fmtBRL(n?: number): string {
  if (n === undefined || n === null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}R$ ${Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.replace('+R$', '+ R$').replace('R$', n >= 0 ? 'R$' : '- R$');
}

// Valida se sinal de 1º tempo já expirou (espelha src/lib/signalValidity.ts)
const HT_REGEX = /\b(ht|1t|1º\s*tempo|primeiro\s*tempo|first\s*half|halftime|half\s*time|intervalo)\b/i;
function isFirstHalfMarket(market?: string | null): boolean {
  if (!market) return false;
  return HT_REGEX.test(market);
}
function isExpiredHtSignal(p: { market?: string | null; minute?: number | null; period?: string | null; status?: string | null }): boolean {
  if (!isFirstHalfMarket(p.market)) return false;
  const min = p.minute ?? 0;
  const period = (p.period || '').toLowerCase();
  const status = (p.status || '').toLowerCase();
  if (status === 'finished') return true;
  if (min >= 45) return true;
  if (period.includes('second') || period.includes('2nd') || period.includes('2t') || period.includes('2º') || period === 'ht' || period.includes('halftime') || period.includes('half_time') || period.includes('intervalo') || period.includes('extra') || period.includes('overtime') || period === 'ft' || period.includes('full_time')) return true;
  return false;
}

// 🎯 Whitelist de "principais ligas" para Telegram do grupo trader-sports-live.
// Após expansão de ligas, sinais aprovados explodiram — para evitar ruído no grupo,
// só enviamos APROVADO/LABAREDA das ligas abaixo. GREEN/RED/CASHOUT (eventos pessoais
// do usuário) continuam sendo enviados normalmente para qualquer liga.
const MAIN_LEAGUE_PATTERNS: RegExp[] = [
  // Brasil
  /\bbrasileir[aã]o\b/i,
  /\bs[ée]rie\s*a\b/i,
  /\bcopa\s*do\s*brasil\b/i,
  // Sul-América
  /\blibertadores\b/i,
  /\bsul[\s-]?americana\b/i,
  /\bcopa\s*am[ée]rica\b/i,
  // Europa - top 5 ligas
  /\bpremier\s*league\b/i,
  /\bla\s*liga\b/i,
  /\bserie\s*a\b/i, // Itália
  /\bbundesliga\b/i,
  /\bligue\s*1\b/i,
  // Europa - copas continentais
  /\bchampions\s*league\b/i,
  /\beuropa\s*league\b/i,
  /\bconference\s*league\b/i,
  // Seleções
  /\bworld\s*cup\b|\bcopa\s*do\s*mundo\b/i,
  /\beuro(?:pean)?\s*championship\b|\beurocopa\b/i,
];

function isMainLeague(league?: string | null): boolean {
  if (!league) return false;
  return MAIN_LEAGUE_PATTERNS.some((rx) => rx.test(league));
}

function buildTelegramMessage(p: Payload): string {
  const score = `${p.score_home ?? 0}:${p.score_away ?? 0}`;
  const minute = p.minute ? `${p.minute}'` : '—';
  const matchLine = `<b>${p.home_team} x ${p.away_team}</b>`;
  const leagueLine = p.league ? `🏆 ${p.league}\n` : '';
  const nowBRT = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const sentAtLine = `🕒 Enviado às <b>${nowBRT}</b> (BRT)\n`;

  if (p.event_type === 'APROVADO') {
    return (
      `✅ <b>ENTRADA APROVADA — Arena Trader Sports</b>\n\n` +
      `${matchLine}\n` +
      `${leagueLine}` +
      `📊 Placar: <b>${score}</b> • ${minute}\n` +
      `🎯 Mercado: <b>${p.market}</b>\n` +
      `💰 Odd: <b>${p.odd?.toFixed(2) ?? '—'}</b>\n` +
      `🧠 Confiança: <b>${p.confidence ?? '—'}%</b>\n` +
      sentAtLine +
      `\n<i>Acesse o app para confirmar a entrada.</i>`
    );
  }

  if (p.event_type === 'LABAREDA') {
    return (
      `⚡ <b>PLANO LABAREDA — Arena Trader Sports</b>\n\n` +
      `${matchLine}\n` +
      `${leagueLine}` +
      `📊 Placar: <b>${score}</b> • ${minute}\n` +
      `🎯 Mercado: <b>${p.market}</b>\n` +
      `💰 Odd: <b>${p.odd?.toFixed(2) ?? '—'}</b>\n` +
      `🧠 Confiança: <b>${p.confidence ?? '—'}%</b>\n\n` +
      `<i>Oportunidade tardia detectada. Janela curta — confirme rápido no app.</i>`
    );
  }

  if (p.event_type === 'CANCELADO') {
    return (
      `🚨 <b>FECHAR POSIÇÃO / FAZER CASHOUT — Arena Trader Sports</b>\n\n` +
      `${matchLine}\n` +
      `${leagueLine}` +
      `📊 Placar: <b>${score}</b> • ${minute}\n` +
      `❌ Sinal anterior: <b>${p.previous_market ?? p.market}</b> @ ${p.previous_odd?.toFixed(2) ?? '—'} (${p.previous_confidence ?? '—'}%)\n\n` +
      `<i>Mycroft detectou condição adversa. Faça cashout ou feche sua posição agora.</i>`
    );
  }

  // Liquidação (GREEN/RED/CASHOUT) — sinal virtual do usuário
  const pnl = p.pnl ?? 0;
  const pnlLine = `${pnl >= 0 ? '+' : '−'} R$ ${Math.abs(pnl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const balanceLine = p.new_balance !== undefined
    ? `💼 Banca virtual: <b>R$ ${p.new_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>\n`
    : '';

  if (p.event_type === 'GREEN') {
    return (
      `🟢 <b>SEU SINAL DEU GREEN!</b>\n\n` +
      `${matchLine}\n` +
      `${leagueLine}` +
      `📊 Placar final: <b>${score}</b>\n` +
      `🎯 Mercado: <b>${p.market}</b> @ ${p.odd?.toFixed(2) ?? '—'}\n` +
      `💰 Lucro: <b>${pnlLine}</b>\n` +
      balanceLine +
      `\n<i>Boa! Sua banca virtual foi creditada.</i>`
    );
  }

  if (p.event_type === 'RED') {
    return (
      `🔴 <b>Sinal vermelho — Arena Trader Sports</b>\n\n` +
      `${matchLine}\n` +
      `${leagueLine}` +
      `📊 Placar final: <b>${score}</b>\n` +
      `🎯 Mercado: <b>${p.market}</b> @ ${p.odd?.toFixed(2) ?? '—'}\n` +
      `📉 Resultado: <b>${pnlLine}</b>\n` +
      balanceLine +
      `\n<i>Faz parte. Próximo sinal está vindo.</i>`
    );
  }

  // CASHOUT
  return (
    `💵 <b>CASHOUT executado — Arena Trader Sports</b>\n\n` +
    `${matchLine}\n` +
    `${leagueLine}` +
    `📊 Placar: <b>${score}</b> • ${minute}\n` +
    `🎯 Mercado: <b>${p.market}</b> @ ${p.odd?.toFixed(2) ?? '—'}\n` +
    `💰 Resultado: <b>${pnlLine}</b>\n` +
    balanceLine
  );
}

// Grupo público dedicado a sinais ao vivo da Arena Live.
// O bot @oaraculomycroftfutebol_bot precisa ser membro/admin desse grupo.
const TRADER_SPORTS_LIVE_CHAT = '@oraculo_mycroft_live';

async function dispatchOne(
  text: string,
  meta: { match_id: string; market: string; verdict: string },
  channel: string,
  chat_id?: string | null,
): Promise<boolean> {
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-send-dedupe`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        text,
        match_id: meta.match_id,
        market: meta.market,
        verdict: meta.verdict,
        channel,
        chat_id: chat_id ?? undefined,
        source: 'notify-trader-event',
        // Sinais ao vivo da Arena Trader Sports SEMPRE devem ser enviados ao
        // grupo dedicado, independente da flag global TELEGRAM_ENABLED.
        enabled: true,
      }),
    });
    const j = await res.json().catch(() => ({}));
    return !!j?.telegram_sent;
  } catch (e) {
    console.error(`[notify-trader-event] dispatch (${channel}) failed:`, e);
    return false;
  }
}

async function sendTelegramDedup(
  text: string,
  meta: { match_id: string; market: string; verdict: string },
): Promise<boolean> {
  // Sinais ao vivo da Arena Trader Sports vão SOMENTE para o grupo dedicado
  // @oraculo_mycroft_trader. Não enviar para o chat principal (oraculo_mycroft).
  return await dispatchOne(text, meta, 'trader-sports-live', TRADER_SPORTS_LIVE_CHAT);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json()) as Payload;
    if (!payload.match_id || !payload.market || !payload.event_type) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🎯 Filtro de ruído: APROVADO/LABAREDA só vão ao grupo Telegram se forem de
    // ligas principais (Brasileirão, top-5 europeias, copas continentais, seleções).
    // Após expansão de ligas a quantidade de sinais explodiu — usuários se perdiam.
    // GREEN/RED/CASHOUT (eventos pessoais) seguem normalmente.
    if ((payload.event_type === 'APROVADO' || payload.event_type === 'LABAREDA') &&
        !isMainLeague(payload.league)) {
      console.log(`[notify-trader-event] 🎯 Liga não-principal — não enviado ao Telegram | league="${payload.league}" match=${payload.match_id} market=${payload.market}`);
      return new Response(JSON.stringify({ skipped: true, reason: 'non_main_league', league: payload.league ?? null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // 🛡️ Bloqueio anti-atraso: se o sinal é de 1º tempo e o jogo já passou da janela,
    // NÃO envia (evita Telegram chegando no 2º tempo com placar/minuto defasados).
    if ((payload.event_type === 'APROVADO' || payload.event_type === 'LABAREDA') &&
        isExpiredHtSignal({ market: payload.market, minute: payload.minute, period: payload.period, status: payload.status })) {
      console.warn(`[notify-trader-event] ⌛ Sinal HT expirado — não enviado | match=${payload.match_id} market=${payload.market} minute=${payload.minute} period=${payload.period}`);
      return new Response(JSON.stringify({ skipped: true, reason: 'ht_window_expired' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Dedupe: já notificado hoje?
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from('trader_notifications_sent')
      .select('id')
      .eq('match_id', payload.match_id)
      .eq('market', payload.market)
      .eq('event_type', payload.event_type)
      .eq('sent_date', today)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ skipped: true, reason: 'already_sent_today' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = buildTelegramMessage(payload);
    const telegramOk = await sendTelegramDedup(message, {
      match_id: payload.match_id,
      market: payload.market,
      verdict: payload.event_type,
    });
    await supabase.from('trader_notifications_sent').insert({
      match_id: payload.match_id,
      market: payload.market,
      event_type: payload.event_type,
      home_team: payload.home_team,
      away_team: payload.away_team,
      odd: payload.odd ?? null,
      confidence: payload.confidence ?? null,
      sent_date: today,
      telegram_sent: telegramOk,
      push_sent: true, // o cliente dispara o push localmente
    });

    // Marca telegram_worthy=true para que live-telegram-results envie o resultado (GREEN/RED)
    if (telegramOk && (payload.event_type === 'APROVADO' || payload.event_type === 'LABAREDA')) {
      await supabase
        .from('mycroft_analyses')
        .update({ telegram_worthy: true })
        .eq('match_id', payload.match_id)
        .eq('market', payload.market)
        .is('result', null);
    }

    if (telegramOk && (payload.event_type === 'APROVADO' || payload.event_type === 'LABAREDA')) {
      const { error: syncErr } = await supabase.rpc('sync_live_sinal_from_notification', {
        _match_id: payload.match_id,
        _market: payload.market,
        _event_type: payload.event_type,
        _home_team: payload.home_team,
        _away_team: payload.away_team,
        _odd: payload.odd ?? null,
        _confidence: payload.confidence ?? null,
        _sent_at: new Date().toISOString(),
      });

      if (syncErr) {
        console.error('[notify-trader-event] sync_live_sinal_from_notification error:', syncErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, telegram_sent: telegramOk, message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('notify-trader-event error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
