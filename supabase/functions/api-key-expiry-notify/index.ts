// Avisa admins sobre vencimentos próximos de chaves API (Futodds, Sportmonks, The Odds API, etc.)
// Janelas: 7, 3, 1 dia. Dispara push para todos os admins via send-web-push.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTIFY_WINDOWS = [7, 3, 1];

function buildPayload(displayName: string, daysLeft: number, planLabel: string | null, expiresAt: string) {
  const urgent = daysLeft <= 1;
  const title = urgent
    ? `🚨 ${displayName} vence ${daysLeft === 0 ? "HOJE" : "AMANHÃ"}`
    : `⚠️ ${displayName} vence em ${daysLeft} dias`;
  const body = `Chave API ${displayName}${planLabel ? ` (${planLabel})` : ""} expira em ${expiresAt}. Renove antes para não interromper análises.`;
  return { title, body, url: "/admin", tag: `api-expiry-${displayName}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const result = { processed: 0, push_sent: 0, skipped: 0, errors: [] as string[] };

  try {
    const { data: keys, error } = await admin
      .from("api_key_expirations")
      .select("api_name, display_name, expires_at, plan_label, enabled")
      .eq("enabled", true);
    if (error) throw error;

    // Today at 00:00 UTC para cálculo de dias inteiros
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    // Lista de admin user_ids (uma única vez)
    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = (admins || []).map((r) => r.user_id);
    if (adminIds.length === 0) {
      return new Response(JSON.stringify({ ...result, warning: "no admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const k of keys || []) {
      const [y, m, d] = k.expires_at.split("-").map(Number);
      const expMs = Date.UTC(y, m - 1, d);
      const daysLeft = Math.ceil((expMs - today) / 86400000);
      if (!NOTIFY_WINDOWS.includes(daysLeft)) {
        result.skipped++;
        continue;
      }
      result.processed++;

      // Idempotência por (api_name, expires_at, days_left)
      const { data: already } = await admin
        .from("api_key_expiry_notification_log")
        .select("id")
        .eq("api_name", k.api_name)
        .eq("expires_at", k.expires_at)
        .eq("days_left", daysLeft)
        .eq("channel", "push")
        .is("user_id", null)
        .maybeSingle();
      if (already) { result.skipped++; continue; }

      const payload = buildPayload(k.display_name, daysLeft, k.plan_label, k.expires_at);
      try {
        await admin.functions.invoke("send-web-push", {
          body: { user_ids: adminIds, payload },
        });
        await admin.from("api_key_expiry_notification_log").insert({
          api_name: k.api_name,
          expires_at: k.expires_at,
          days_left: daysLeft,
          channel: "push",
          user_id: null,
        });
        result.push_sent++;
      } catch (e) {
        result.errors.push(`${k.api_name}: ${String(e)}`);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), ...result }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
