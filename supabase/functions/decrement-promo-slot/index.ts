import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ua = req.headers.get("user-agent") ?? null;
    const ipRaw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    let ipHash: string | null = null;
    if (ipRaw) {
      const data = new TextEncoder().encode(ipRaw);
      const buf = await crypto.subtle.digest("SHA-256", data);
      ipHash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
    }

    const { data, error } = await supabase.rpc("decrement_promo_slot", {
      p_promo_id: "launch_2025",
      p_event_type: "click",
      p_user_agent: ua,
      p_ip_hash: ipHash,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return new Response(
      JSON.stringify({
        slots_remaining: row?.slots_remaining ?? 0,
        slots_total: row?.slots_total ?? 200,
        is_active: row?.is_active ?? false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    console.error("decrement-promo-slot error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
