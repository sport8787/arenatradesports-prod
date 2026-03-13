import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BF_BR = 'https://api.betfair.bet.br/exchange/betting/rest/v1.0';
const BF_GLOBAL = 'https://api.betfair.com/exchange/betting/rest/v1.0';

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function bfPost(endpoint: string, body: any, token: string, appKey: string, useBr = true): Promise<any> {
  const url = `${useBr ? BF_BR : BF_GLOBAL}/${endpoint}/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Application': appKey, 'X-Authentication': token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (useBr) {
      console.log(`[BetfairSync] BR failed for ${endpoint}, trying global...`);
      return bfPost(endpoint, body, token, appKey, false);
    }
    // Check for expired/invalid session token
    if (res.status === 400 && (errorText.includes('DSC-0024') || errorText.includes('DSC-0018') || errorText.includes('ANGX-0004'))) {
      throw new Error('SSOID_EXPIRED');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('SSOID_EXPIRED');
    }
    throw new Error(`Betfair API error ${res.status}: ${errorText}`);
  }
  return res.json();
}

// Resolve marketIds to event names and selection names
async function resolveMarketInfo(marketIds: string[], token: string, appKey: string) {
  const info: Record<string, { eventName: string; runners: Record<string, string> }> = {};
  if (!marketIds.length) return info;

  // Batch in groups of 40
  for (let i = 0; i < marketIds.length; i += 40) {
    const batch = marketIds.slice(i, i + 40);
    try {
      const catalogue = await bfPost('listMarketCatalogue', {
        filter: { marketIds: batch },
        marketProjection: ['EVENT', 'RUNNER_DESCRIPTION'],
        maxResults: batch.length,
      }, token, appKey);

      for (const mkt of (catalogue || [])) {
        const runners: Record<string, string> = {};
        for (const r of (mkt.runners || [])) {
          runners[String(r.selectionId)] = r.runnerName || `Selection ${r.selectionId}`;
        }
        info[mkt.marketId] = {
          eventName: mkt.event?.name || mkt.marketName || mkt.marketId,
          runners,
        };
      }
    } catch (e) {
      console.log(`[BetfairSync] Failed to resolve market info batch: ${e.message}`);
    }
  }
  return info;
}

function mapOrder(order: any, userId: string, batchId: string, marketInfo: Record<string, any>): any {
  const isSettled = order.betOutcome != null;
  let result = 'pending', profitLoss = 0;

  if (isSettled) {
    // Always use profit field - it already accounts for cashouts/partial closes
    profitLoss = order.profit != null ? order.profit : 0;
    if (order.betOutcome === 'WON') { result = 'green'; }
    else if (order.betOutcome === 'LOST') { 
      // If profit is 0 or positive despite LOST outcome, it was a cashout
      result = profitLoss >= 0 ? 'green' : 'red'; 
    }
    else { result = 'void'; }
  }

  const mktId = order.marketId || '';
  const selId = String(order.selectionId || '');
  
  // Priority 1: itemDescription from includeItemDescription (works for settled markets)
  const itemDesc = order.itemDescription;
  // Priority 2: catalogue info (works for active markets)
  const mkt = marketInfo[mktId];
  
  let eventName = 'Unknown';
  let selectionName = `Selection ${selId}`;
  
  if (itemDesc) {
    eventName = itemDesc.eventDesc || itemDesc.marketDesc || mktId;
    selectionName = itemDesc.runnerDesc || `Selection ${selId}`;
  } else if (mkt) {
    eventName = mkt.eventName || mktId;
    selectionName = mkt.runners?.[selId] || `Selection ${selId}`;
  }
  
  const side = order.side === 'LAY' ? ' (LAY)' : '';

  return {
    user_id: userId,
    source: 'betfair',
    bookmaker: 'Betfair Exchange',
    event_name: eventName,
    market: order.marketType || order.orderType || 'Match Odds',
    selection: `${selectionName}${side}`,
    odd: order.priceMatched || order.price || 0,
    stake: order.sizeSettled || order.sizePlaced || order.size || 0,
    profit_loss: profitLoss,
    result,
    bet_date: order.placedDate ? new Date(order.placedDate).toISOString() : new Date().toISOString(),
    settle_date: order.settledDate ? new Date(order.settledDate).toISOString() : null,
    raw_data: order,
    import_batch_id: batchId,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = getSupabaseAdmin();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Parse request body for options
    let forceResync = false;
    try {
      const body = await req.json();
      forceResync = body?.forceResync === true;
    } catch {}

    const { data: { user }, error: authError } = await createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: connection, error: connErr } = await supabase
      .from('bookmaker_connections').select('*')
      .eq('user_id', user.id).eq('bookmaker', 'betfair').eq('is_active', true).single();

    if (connErr || !connection) return new Response(JSON.stringify({ error: 'Betfair não configurada. Configure nas configurações.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const sessionToken = connection.session_token;
    if (!sessionToken) return new Response(JSON.stringify({ error: 'SSOID não configurado. Atualize o token nas configurações.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // If force resync, delete old betfair imported bets and reset date
    if (forceResync) {
      console.log('[BetfairSync] Force resync: deleting old betfair bets...');
      await supabase.from('imported_bets').delete().eq('user_id', user.id).eq('source', 'betfair');
    }

    const batchId = crypto.randomUUID();
    const fromDate = forceResync
      ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      : (connection.last_sync_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    console.log('[BetfairSync] Fetching settled orders...');
    const settledData = await bfPost('listClearedOrders', {
      betStatus: 'SETTLED',
      settledDateRange: { from: fromDate },
      includeItemDescription: true,
      recordCount: 1000,
    }, sessionToken, connection.app_key);
    const settledOrders = settledData.clearedOrders || [];

    console.log('[BetfairSync] Fetching current orders...');
    const currentData = await bfPost('listCurrentOrders', {}, sessionToken, connection.app_key);
    const currentOrders = currentData.currentOrders || [];

    // Collect unique marketIds to resolve names
    const allRawOrders = [...settledOrders, ...currentOrders];
    const uniqueMarketIds = [...new Set(allRawOrders.map((o: any) => o.marketId).filter(Boolean))];

    console.log(`[BetfairSync] Resolving ${uniqueMarketIds.length} markets...`);
    const marketInfo = await resolveMarketInfo(uniqueMarketIds as string[], sessionToken, connection.app_key);

    const allOrders = allRawOrders.map((o: any) => mapOrder(o, user.id, batchId, marketInfo));

    if (allOrders.length > 0) {
      const { error: insertErr } = await supabase.from('imported_bets').upsert(allOrders, { onConflict: 'id' });
      if (insertErr) console.error('[BetfairSync] Insert error:', insertErr);
    }

    await supabase.from('bookmaker_connections').update({
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);

    console.log(`[BetfairSync] Synced ${allOrders.length} bets (${settledOrders.length} settled, ${currentOrders.length} pending)`);

    return new Response(JSON.stringify({
      success: true, synced: allOrders.length,
      settled: settledOrders.length, pending: currentOrders.length, batch_id: batchId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[BetfairSync] Error:', e);
    if (e.message === 'SSOID_EXPIRED') {
      return new Response(JSON.stringify({ 
        error: 'Seu SSOID expirou. Acesse a Betfair, copie um novo SSOID e atualize nas Configurações → Conexões → Betfair.' 
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
