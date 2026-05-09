import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POSTHOG_KEY = 'phc_RnKvfx3XmL6ASJSDNrNf8WiVBUEEOM57pzru1KwhX2f';
const POSTHOG_HOST = 'https://us.i.posthog.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, referral_source, user_id } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user already redeemed a promo
    const { data: existing } = await supabase
      .from('promo_redemptions')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: 'already_redeemed', message: 'Você já utilizou um código promocional.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let promo = null;
    let partner_name = '';
    let trial_days = 30;

    // If code provided, validate it
    if (code) {
      const { data: promoData, error: promoError } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code.toUpperCase().trim())
        .eq('is_active', true)
        .maybeSingle();

      if (!promoData || promoError) {
        return new Response(JSON.stringify({ error: 'invalid_code', message: 'Código promocional inválido ou expirado.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check expiry
      if (promoData.expires_at && new Date(promoData.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'expired_code', message: 'Código promocional expirado.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check max uses
      if (promoData.max_uses && promoData.current_uses >= promoData.max_uses) {
        return new Response(JSON.stringify({ error: 'max_uses_reached', message: 'Código promocional atingiu o limite de uso.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      promo = promoData;
      partner_name = promoData.partner_name;
      trial_days = promoData.trial_days;

      // Increment usage
      await supabase
        .from('promo_codes')
        .update({ current_uses: promoData.current_uses + 1 })
        .eq('id', promoData.id);

    } else if (referral_source) {
      // UTM-based referral
      const sourceMap: Record<string, { partner: string; days: number }> = {
        'spinataque': { partner: 'SpinAtaque', days: 30 },
      };
      const source = sourceMap[referral_source.toLowerCase()];
      if (source) {
        partner_name = source.partner;
        trial_days = source.days;
      } else {
        // Unknown source, just track it with default trial
        partner_name = referral_source;
        trial_days = 7; // default trial
      }
    } else {
      return new Response(JSON.stringify({ error: 'no_code_or_source', message: 'Código ou referência necessária.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Record redemption
    await supabase.from('promo_redemptions').insert({
      user_id,
      promo_code_id: promo?.id || null,
      referral_source: referral_source || null,
      partner_name,
      trial_days_granted: trial_days,
    });

    // Extend trial in user_subscriptions
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trial_days);

    await supabase
      .from('user_subscriptions')
      .update({
        trial_ends_at: trialEnd.toISOString(),
        plan: 'trial',
        is_active: true,
      })
      .eq('user_id', user_id);

    // Track event in PostHog
    try {
      await fetch(`${POSTHOG_HOST}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: POSTHOG_KEY,
          event: 'promo_redeemed',
          distinct_id: user_id,
          properties: {
            promo_code: code || null,
            referral_source: referral_source || null,
            partner_name,
            trial_days,
            trial_ends_at: trialEnd.toISOString(),
          },
        }),
      });
    } catch (e) {
      console.warn('PostHog tracking failed:', e);
    }

    return new Response(JSON.stringify({
      success: true,
      partner_name,
      trial_days,
      trial_ends_at: trialEnd.toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Error in redeem-promo:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
