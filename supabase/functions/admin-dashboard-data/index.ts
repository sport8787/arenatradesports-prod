import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'pabloescobar@gmail.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (userData.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Admin client
    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch all auth users (paginated)
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      allUsers.push(...data.users);
      if (data.users.length < perPage) break;
      page++;
      if (page > 50) break;
    }

    // Fetch subscriptions
    const { data: subs } = await admin.from('user_subscriptions').select('*');
    const subMap = new Map((subs || []).map((s: any) => [s.user_id, s]));

    // Fetch promo redemptions (com nome do cupom)
    const { data: redemptions } = await admin
      .from('promo_redemptions')
      .select('user_id, partner_name, referral_source, trial_days_granted, created_at, promo_codes(code)');
    const redemptionMap = new Map(
      (redemptions || []).map((r: any) => [
        r.user_id,
        {
          coupon_code: r.promo_codes?.code || null,
          partner_name: r.partner_name,
          referral_source: r.referral_source,
          trial_days_granted: r.trial_days_granted,
          redeemed_at: r.created_at,
        },
      ])
    );

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneDayMs = 24 * 60 * 60 * 1000;

    let activeToday = 0;
    let active3d = 0;
    let neverReturned = 0;
    let trialExpiringSoon = 0;
    let trialExpired = 0;
    let paidActive = 0;
    let trialActiveCount = 0;

    let d1Eligible = 0, d1Activated = 0;
    let d3Eligible = 0, d3Activated = 0;

    const enriched = allUsers.map((u: any) => {
      const sub = subMap.get(u.id);
      const createdAt = new Date(u.created_at);
      const lastSignIn = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null;
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / oneDayMs);

      // Trial days remaining
      let trialDaysLeft: number | null = null;
      if (sub?.plan === 'trial' && sub?.trial_ends_at) {
        const ends = new Date(sub.trial_ends_at);
        trialDaysLeft = Math.ceil((ends.getTime() - now.getTime()) / oneDayMs);
      }

      const isActiveToday = lastSignIn && lastSignIn >= today;
      const isActive3d = lastSignIn && lastSignIn >= threeDaysAgo;
      const neverBack = !lastSignIn || Math.abs(lastSignIn.getTime() - createdAt.getTime()) < 60_000;
      const isTrialExpiring = trialDaysLeft !== null && trialDaysLeft >= 1 && trialDaysLeft <= 2;
      const isTrialExpired = sub?.plan === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 0;
      const isPaid = sub?.plan === 'base' || sub?.plan === 'premium' || sub?.plan === 'starter' || sub?.plan === 'basic';
      const isPaidStillActive = isPaid && sub?.is_active === true && (!sub?.subscription_ends_at || new Date(sub.subscription_ends_at) > now);
      const isTrialActive = sub?.plan === 'trial' && (trialDaysLeft ?? 0) > 0;

      if (isActiveToday) activeToday++;
      if (isActive3d) active3d++;
      if (neverBack) neverReturned++;
      if (isTrialExpiring) trialExpiringSoon++;
      if (isTrialExpired) trialExpired++;
      if (isPaidStillActive) paidActive++;
      if (isTrialActive) trialActiveCount++;

      // D1 / D3 retention
      if (daysSinceCreation >= 1) {
        d1Eligible++;
        if (lastSignIn) {
          const d1End = new Date(createdAt.getTime() + 2 * oneDayMs);
          const d1Start = new Date(createdAt.getTime() + oneDayMs);
          if (lastSignIn >= d1Start && lastSignIn <= d1End) d1Activated++;
          else if (lastSignIn > d1End) d1Activated++;
        }
      }
      if (daysSinceCreation >= 3) {
        d3Eligible++;
        if (lastSignIn && lastSignIn.getTime() - createdAt.getTime() >= 3 * oneDayMs - oneDayMs) {
          d3Activated++;
        }
      }

      // Prioridade: Pago > Trial expirado (ACESSO BLOQUEADO) > Trial expirando > Ativo hoje > Ativo recente > Inativo
      let status = 'Inativo';
      if (isPaidStillActive) status = 'Pago';
      else if (isTrialExpired) status = 'Trial expirado';
      else if (isTrialExpiring) status = 'Trial expirando';
      else if (isActiveToday) status = 'Ativo hoje';
      else if (isActive3d) status = 'Ativo recente';

      const promo = redemptionMap.get(u.id) || null;
      return {
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        plan: sub?.plan || null,
        trial_ends_at: sub?.trial_ends_at || null,
        trial_days_left: trialDaysLeft,
        status,
        coupon_code: promo?.coupon_code || null,
        coupon_partner: promo?.partner_name || null,
      };
    });

    // Recent activity feed
    const feed: any[] = [];
    enriched
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .forEach((u) => feed.push({ type: 'signup', email: u.email, timestamp: u.created_at }));
    enriched
      .filter((u) => u.status === 'Trial expirando')
      .slice(0, 5)
      .forEach((u) => feed.push({ type: 'trial_expiring', email: u.email, timestamp: u.trial_ends_at }));
    enriched
      .filter((u) => u.plan === 'base' || u.plan === 'premium')
      .slice(0, 5)
      .forEach((u) => feed.push({ type: 'converted', email: u.email, timestamp: u.created_at }));
    feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const overview = {
      total: allUsers.length,
      activeToday,
      active3d,
      neverReturned,
      trialExpiringSoon,
      trialExpired,
      paidActive,
    };

    const conversion = {
      d1Rate: d1Eligible > 0 ? (d1Activated / d1Eligible) * 100 : 0,
      d3Rate: d3Eligible > 0 ? (d3Activated / d3Eligible) * 100 : 0,
      trialActive: trialActiveCount,
      paidTotal: paidActive,
      trialToPaidRate: (trialActiveCount + paidActive) > 0
        ? (paidActive / (trialActiveCount + paidActive)) * 100
        : 0,
    };

    return new Response(
      JSON.stringify({ overview, conversion, users: enriched, feed: feed.slice(0, 20) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('admin-dashboard-data error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
