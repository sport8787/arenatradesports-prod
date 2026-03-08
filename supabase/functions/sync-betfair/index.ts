import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BETFAIR_LOGIN_URL = 'https://identitysso.betfair.com/api/login';
const BETFAIR_API_URL = 'https://api.betfair.com/exchange/betting/rest/v1.0';

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function loginBetfair(appKey: string, username: string, password: string): Promise<string> {
  const res = await fetch(BETFAIR_LOGIN_URL, {
    method: 'POST',
    headers: {
      'X-Application': appKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });

  const data = await res.json();
  if (data.status !== 'SUCCESS' || !data.token) {
    throw new Error(data.error || 'Betfair login failed');
  }
  return data.token;
}

async function fetchBetfairOrders(sessionToken: string, appKey: string, settled: boolean, fromDate?: string) {
  const endpoint = settled ? 'listClearedOrders' : 'listCurrentOrders';
  const body: any = {};

  if (settled) {
    body.betStatus = 'SETTLED';
    body.settledDateRange = {
      from: fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    body.recordCount = 1000;
  }

  const res = await fetch(`${BETFAIR_API_URL}/${endpoint}/`, {
    method: 'POST',
    headers: {
      'X-Application': appKey,
      'X-Authentication': sessionToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Betfair API error ${res.status}: ${errText}`);
  }

  return await res.json();
}

function mapBetfairToImport(order: any, userId: string, batchId: string): any {
  const isSettled = order.betOutcome != null;
  let result = 'pending';
  let profitLoss = 0;

  if (isSettled) {
    if (order.betOutcome === 'WON') {
      result = 'green';
      profitLoss = (order.profit || 0);
    } else if (order.betOutcome === 'LOST') {
      result = 'red';
      profitLoss = -(order.sizeSettled || order.size || 0);
    } else {
      result = 'void';
      profitLoss = 0;
    }
  }

  return {
    user_id: userId,
    source: 'betfair',
    bookmaker: 'Betfair Exchange',
    event_name: order.eventName || order.marketId || 'Unknown',
    market: order.marketType || order.orderType || 'Unknown',
    selection: order.selectionName || `Selection ${order.selectionId}`,
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's Betfair connection
    const { data: connection, error: connErr } = await supabase
      .from('bookmaker_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('bookmaker', 'betfair')
      .eq('is_active', true)
      .single();

    if (connErr || !connection) {
      return new Response(
        JSON.stringify({ error: 'Betfair não configurada. Configure nas configurações.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Login to Betfair
    console.log('[BetfairSync] Logging in...');
    let sessionToken: string;
    try {
      sessionToken = await loginBetfair(
        connection.app_key,
        connection.username,
        connection.encrypted_password // In production, this should be decrypted
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ error: `Login Betfair falhou: ${e.message}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save session token
    await supabase
      .from('bookmaker_connections')
      .update({
        session_token: sessionToken,
        token_expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    const batchId = crypto.randomUUID();
    const fromDate = connection.last_sync_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch settled orders
    console.log('[BetfairSync] Fetching settled orders...');
    const settledData = await fetchBetfairOrders(sessionToken, connection.app_key, true, fromDate);
    const settledOrders = settledData.clearedOrders || [];

    // Fetch current (pending) orders
    console.log('[BetfairSync] Fetching current orders...');
    const currentData = await fetchBetfairOrders(sessionToken, connection.app_key, false);
    const currentOrders = currentData.currentOrders || [];

    // Map and insert
    const allOrders = [
      ...settledOrders.map((o: any) => mapBetfairToImport(o, user.id, batchId)),
      ...currentOrders.map((o: any) => mapBetfairToImport(o, user.id, batchId)),
    ];

    if (allOrders.length > 0) {
      const { error: insertErr } = await supabase
        .from('imported_bets')
        .upsert(allOrders, { onConflict: 'id' });

      if (insertErr) {
        console.error('[BetfairSync] Insert error:', insertErr);
      }
    }

    // Update last sync
    await supabase
      .from('bookmaker_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log(`[BetfairSync] Synced ${allOrders.length} bets (${settledOrders.length} settled, ${currentOrders.length} pending)`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: allOrders.length,
        settled: settledOrders.length,
        pending: currentOrders.length,
        batch_id: batchId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[BetfairSync] Error:', e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
