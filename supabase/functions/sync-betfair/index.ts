import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BF_BR = 'https://api.betfair.bet.br/exchange';
const BF_GLOBAL = 'https://api.betfair.com/exchange';

function getSupabaseAdmin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function bfPost(basePath: string, endpoint: string, body: any, token: string, appKey: string, useBr = true): Promise<any> {
  const base = useBr ? BF_BR : BF_GLOBAL;
  const url = `${base}/${basePath}/rest/v1.0/${endpoint}/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Application': appKey, 'X-Authentication': token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorText = await res.text();
    if (useBr) {
      console.log(`[BetfairSync] BR failed for ${endpoint}, trying global...`);
      return bfPost(basePath, endpoint, body, token, appKey, false);
    }
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

// Shortcut for betting API
function bfBetting(endpoint: string, body: any, token: string, appKey: string) {
  return bfPost('betting', endpoint, body, token, appKey);
}

// Shortcut for account API
function bfAccount(endpoint: string, body: any, token: string, appKey: string) {
  return bfPost('account', endpoint, body, token, appKey);
}

// Resolve marketIds to event names and selection names
async function resolveMarketInfo(marketIds: string[], token: string, appKey: string) {
  const info: Record<string, { eventName: string; runners: Record<string, string> }> = {};
  if (!marketIds.length) return info;

  for (let i = 0; i < marketIds.length; i += 40) {
    const batch = marketIds.slice(i, i + 40);
    try {
      const catalogue = await bfBetting('listMarketCatalogue', {
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

function mapExchangeOrder(order: any, userId: string, batchId: string, marketInfo: Record<string, any>): any {
  const isSettled = order.betOutcome != null;
  let result = 'pending', profitLoss = 0;

  if (isSettled) {
    profitLoss = order.profit != null ? order.profit : 0;
    if (order.betOutcome === 'WON') { result = 'green'; }
    else if (order.betOutcome === 'LOST') { 
      result = profitLoss >= 0 ? 'green' : 'red'; 
    }
    else { result = 'void'; }
  }

  const mktId = order.marketId || '';
  const selId = String(order.selectionId || '');
  const itemDesc = order.itemDescription;
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

// Parse getAccountStatement items to extract Sportsbook bets
function parseSportsbookFromStatement(items: any[], userId: string, batchId: string, existingRefIds: Set<string>): any[] {
  const bets: any[] = [];
  
  for (const item of items) {
    // Skip exchange items (already handled), deposits/withdrawals, and unknown
    const itemClass = item.itemClass;
    if (!itemClass || itemClass === 'UNKNOWN') continue;
    
    // Parse the itemClassData which contains bet details
    const data = item.itemClassData || {};
    const unknownItem = data.unknownStatementItem;
    
    // Try to parse the unknown statement item JSON string
    let parsed: any = null;
    if (unknownItem && typeof unknownItem === 'string') {
      try { parsed = JSON.parse(unknownItem); } catch {}
    }
    
    // Use parsed data or raw itemClassData
    const betData = parsed || data;
    
    // Skip if no meaningful bet data or if it's an exchange bet
    const betCategoryType = betData.betCategoryType;
    if (betCategoryType === 'E') continue; // E = Exchange
    
    // Sportsbook bets typically have betCategoryType 'S' or 'M' (multiples)
    // Also catch anything that isn't Exchange
    const transactionType = betData.transactionType || '';
    if (!['ACCOUNT_DEBIT', 'ACCOUNT_CREDIT'].includes(transactionType) && 
        !betData.betSize && !betData.avgPrice) continue;
    
    // Build a unique ref for dedup
    const refId = item.refId || `${item.itemDate}_${item.amount}`;
    if (existingRefIds.has(refId)) continue;
    existingRefIds.add(refId);
    
    const amount = item.amount || 0;
    const betSize = betData.betSize || Math.abs(amount) || 0;
    const avgPrice = betData.avgPrice || betData.avgPriceRaw || 0;
    const winLose = betData.winLose || '';
    const eventName = betData.fullMarketName || betData.eventDesc || 'Betfair Sportsbook';
    const selectionName = betData.selectionName || 'Sportsbook Bet';
    
    let result = 'pending';
    let profitLoss = amount;
    
    if (winLose === 'WON' || winLose === 'RESULT_WON') {
      result = 'green';
    } else if (winLose === 'LOST' || winLose === 'RESULT_LOST') {
      result = 'red';
      profitLoss = amount < 0 ? amount : -betSize;
    } else if (winLose === 'RESULT_NOT_APPLICABLE') {
      // Could be a void, cashout, or non-bet transaction - skip
      continue;
    }
    
    // Skip zero-amount non-bet entries
    if (betSize === 0 && avgPrice === 0) continue;
    
    bets.push({
      user_id: userId,
      source: 'betfair-sportsbook',
      bookmaker: 'Betfair Sportsbook',
      event_name: eventName,
      market: betData.marketDesc || 'Sportsbook',
      selection: selectionName,
      odd: avgPrice,
      stake: betSize,
      profit_loss: Math.round(profitLoss * 100) / 100,
      result,
      bet_date: item.itemDate ? new Date(item.itemDate).toISOString() : new Date().toISOString(),
      settle_date: item.itemDate ? new Date(item.itemDate).toISOString() : null,
      raw_data: { statementItem: item, parsed: betData },
      import_batch_id: batchId,
    });
  }
  
  return bets;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = getSupabaseAdmin();
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

    if (forceResync) {
      console.log('[BetfairSync] Force resync: deleting old betfair bets...');
      await supabase.from('imported_bets').delete().eq('user_id', user.id).eq('source', 'betfair');
      await supabase.from('imported_bets').delete().eq('user_id', user.id).eq('source', 'betfair-sportsbook');
    }

    const batchId = crypto.randomUUID();
    const fromDate = forceResync
      ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      : (connection.last_sync_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // ── Exchange: settled + current orders ──
    console.log('[BetfairSync] Fetching Exchange settled orders...');
    const settledData = await bfBetting('listClearedOrders', {
      betStatus: 'SETTLED',
      settledDateRange: { from: fromDate },
      includeItemDescription: true,
      recordCount: 1000,
    }, sessionToken, connection.app_key);
    const settledOrders = settledData.clearedOrders || [];

    console.log('[BetfairSync] Fetching Exchange current orders...');
    const currentData = await bfBetting('listCurrentOrders', {}, sessionToken, connection.app_key);
    const currentOrders = currentData.currentOrders || [];

    const allRawOrders = [...settledOrders, ...currentOrders];
    const uniqueMarketIds = [...new Set(allRawOrders.map((o: any) => o.marketId).filter(Boolean))];

    console.log(`[BetfairSync] Resolving ${uniqueMarketIds.length} markets...`);
    const marketInfo = await resolveMarketInfo(uniqueMarketIds as string[], sessionToken, connection.app_key);
    const exchangeBets = allRawOrders.map((o: any) => mapExchangeOrder(o, user.id, batchId, marketInfo));

    // ── Sportsbook: via Account Statement ──
    let sportsbookBets: any[] = [];
    try {
      console.log('[BetfairSync] Fetching Account Statement for Sportsbook bets...');
      const statementData = await bfAccount('getAccountStatement', {
        itemDateRange: { from: fromDate },
        includeItem: 'ALL',
        recordCount: 1000,
      }, sessionToken, connection.app_key);

      const statementItems = statementData.accountStatement || [];
      console.log(`[BetfairSync] Account statement returned ${statementItems.length} items`);

      // Build set of existing exchange refIds to avoid duplicates
      const exchangeRefIds = new Set(settledOrders.map((o: any) => o.betId).filter(Boolean));
      sportsbookBets = parseSportsbookFromStatement(statementItems, user.id, batchId, exchangeRefIds);
      console.log(`[BetfairSync] Extracted ${sportsbookBets.length} Sportsbook bets from statement`);
    } catch (e) {
      console.log(`[BetfairSync] Account Statement fetch failed (non-fatal): ${e.message}`);
      // Non-fatal: sportsbook extraction is best-effort
    }

    const allBets = [...exchangeBets, ...sportsbookBets];

    if (allBets.length > 0) {
      const { error: insertErr } = await supabase.from('imported_bets').upsert(allBets, { onConflict: 'id' });
      if (insertErr) console.error('[BetfairSync] Insert error:', insertErr);
    }

    await supabase.from('bookmaker_connections').update({
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);

    console.log(`[BetfairSync] Synced ${allBets.length} total bets (${exchangeBets.length} exchange, ${sportsbookBets.length} sportsbook)`);

    return new Response(JSON.stringify({
      success: true, 
      synced: allBets.length,
      exchange: exchangeBets.length,
      sportsbook: sportsbookBets.length,
      settled: settledOrders.length, 
      pending: currentOrders.length, 
      batch_id: batchId,
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
