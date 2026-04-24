// Edge Function: send-web-push
// Envia Web Push notifications via VAPID para subscriptions registradas
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contato@oraculo-mycroft.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { user_ids, broadcast, payload } = await req.json() as {
      user_ids?: string[];
      broadcast?: boolean;
      payload: PushPayload;
    };

    if (!payload?.title || !payload?.body) {
      return new Response(JSON.stringify({ error: 'payload.title e payload.body são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let query = supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth');
    if (!broadcast && user_ids?.length) query = query.in('user_id', user_ids);

    const { data: subs, error } = await query;
    if (error) throw error;
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'Nenhuma subscription encontrada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const notificationPayload = JSON.stringify(payload);
    let sent = 0, failed = 0;
    const expiredIds: string[] = [];

    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notificationPayload
        );
        sent++;
      } catch (err: any) {
        failed++;
        if (err.statusCode === 404 || err.statusCode === 410) expiredIds.push(sub.id);
        console.warn('[send-web-push] falha:', err.statusCode, err.body);
      }
    }));

    if (expiredIds.length) {
      await supabase.from('push_subscriptions').delete().in('id', expiredIds);
    }

    return new Response(JSON.stringify({ sent, failed, expired_removed: expiredIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error('[send-web-push] erro:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
