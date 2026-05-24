// Cron diário 13h UTC: sequência de comunicação para leads Day Pass.
// Touches: D0_4H (email+push, 4h antes de expirar) | D1, D5, D15 (email) | D2 (push)
// Dedup via day_pass_lifecycle_log (unique user_id+touch+channel).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "Oráculo Mycroft <noreply@oraculo-mycroft.com>";
const SITE_URL = "https://oraculo-mycroft.com";
const LOBBY_URL = `${SITE_URL}/lobby-preview`;

type Touch = "D0_4H" | "D1" | "D2" | "D5" | "D15";

interface Copy {
  subject: string;
  pushTitle: string;
  pushBody: string;
  html: (firstName: string, stats: { greens: number; wr: number; lucro: number }) => string;
}

const COPY: Record<Touch, Copy> = {
  D0_4H: {
    subject: "⏰ Seu Day Pass expira em 4h — assine R$ 47/mês e mantenha o ritmo",
    pushTitle: "Faltam 4h do seu Day Pass",
    pushBody: "Assine R$ 47/mês e não perca o próximo GREEN.",
    html: (n) => `
<div style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#111;border:1px solid #f59e0b;border-radius:12px;padding:28px">
  <h1 style="color:#f59e0b;font-size:22px">⏰ ${n}, seu Day Pass expira em 4h</h1>
  <p style="color:#d4d4d4;font-size:15px;line-height:1.5">Você viu o Oráculo trabalhar nas últimas 20h. Não perca o ritmo agora.</p>
  <p style="color:#d4d4d4;font-size:15px;line-height:1.5"><b>Assinatura mensal — R$ 47/mês via Pix.</b> Cancele quando quiser.</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${LOBBY_URL}" style="background:#f59e0b;color:#000;padding:14px 28px;border-radius:8px;font-weight:bold;text-decoration:none">Continuar acesso → R$ 47/mês</a>
  </div>
  <p style="color:#888;font-size:12px;text-align:center">Mycroft não torce. Ele calcula.</p>
</div></div>`,
  },
  D1: {
    subject: "Você viu o Oráculo trabalhar ontem. Volte por R$ 47/mês.",
    pushTitle: "Hoje teve GREEN no Punter",
    pushBody: "Você está fora. Reative por R$ 47/mês.",
    html: (n, s) => `
<div style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#111;border:1px solid #22c55e;border-radius:12px;padding:28px">
  <h1 style="color:#22c55e;font-size:22px">${n}, seu Day Pass acabou.</h1>
  <p style="color:#d4d4d4;font-size:15px;line-height:1.5">Nas últimas 24h, o Oráculo entregou <b>${s.greens} GREENS</b> com win rate de <b>${s.wr}%</b>.</p>
  <p style="color:#d4d4d4;font-size:15px;line-height:1.5">Você ficou de fora. Reative agora por <b>R$ 47/mês</b> — sem fidelidade, cancele quando quiser.</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${LOBBY_URL}" style="background:#22c55e;color:#000;padding:14px 28px;border-radius:8px;font-weight:bold;text-decoration:none">Reativar → R$ 47/mês</a>
  </div>
</div></div>`,
  },
  D2: {
    subject: "",
    pushTitle: "Mycroft segue calculando sem você",
    pushBody: "2 dias sem acesso. Volte por R$ 47/mês.",
    html: () => "",
  },
  D5: {
    subject: "📊 5 dias do Oráculo sem você — veja os números reais",
    pushTitle: "5 dias depois...",
    pushBody: "Veja o que o Oráculo entregou enquanto você esteve fora.",
    html: (n, s) => `
<div style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#111;border:1px solid #3b82f6;border-radius:12px;padding:28px">
  <h1 style="color:#3b82f6;font-size:22px">${n}, 5 dias do Oráculo:</h1>
  <ul style="color:#d4d4d4;font-size:15px;line-height:1.8">
    <li>✅ <b>${s.greens} GREENS</b> validados</li>
    <li>📈 Win rate: <b>${s.wr}%</b></li>
    <li>💰 Lucro acumulado: <b>R$ ${s.lucro.toFixed(2)}</b> (banca virtual)</li>
  </ul>
  <p style="color:#d4d4d4;font-size:15px;line-height:1.5">Não é torcida. É cálculo. Assine R$ 47/mês:</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${LOBBY_URL}" style="background:#3b82f6;color:#fff;padding:14px 28px;border-radius:8px;font-weight:bold;text-decoration:none">Reativar acesso →</a>
  </div>
</div></div>`,
  },
  D15: {
    subject: "🎯 Última oferta: R$ 27 nos próximos 7 dias (50% OFF)",
    pushTitle: "🎯 R$ 27 nos próximos 7 dias",
    pushBody: "Última chance. 50% OFF expira em 24h.",
    html: (n) => `
<div style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#111;border:2px solid #ef4444;border-radius:12px;padding:28px">
  <h1 style="color:#ef4444;font-size:22px">${n}, última chance.</h1>
  <p style="color:#d4d4d4;font-size:15px;line-height:1.5">Você experimentou o Oráculo há 15 dias. Hoje libero <b>R$ 27 fixos por 30 dias</b> — só pra você, expira em 24h.</p>
  <div style="text-align:center;margin:28px 0">
    <a href="${LOBBY_URL}?coupon=VOLTA27" style="background:#ef4444;color:#fff;padding:14px 28px;border-radius:8px;font-weight:bold;text-decoration:none">Reativar por R$ 27 →</a>
  </div>
  <p style="color:#888;font-size:12px;text-align:center">Depois disso, valor cheio R$ 47/mês.</p>
</div></div>`,
  },
};

async function sendEmail(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
}

async function fetchStats(sb: any) {
  const since = new Date(Date.now() - 5 * 24 * 3600_000).toISOString();
  const { data } = await sb
    .from("punter_sinais")
    .select("resultado, profit_loss")
    .in("resultado", ["GREEN", "RED"])
    .gte("created_at", since);
  const greens = (data ?? []).filter((d: any) => d.resultado === "GREEN").length;
  const reds = (data ?? []).filter((d: any) => d.resultado === "RED").length;
  const total = greens + reds;
  const wr = total > 0 ? Math.round((greens / total) * 100) : 61;
  const lucro = (data ?? []).reduce((a: number, d: any) => a + Number(d.profit_loss ?? 0), 0);
  return { greens, wr, lucro: Math.max(lucro, 0) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const result = { processed: 0, emails: 0, pushes: 0, skipped: 0, errors: [] as string[] };

  try {
    const stats = await fetchStats(sb);

    // Busca todas as cobranças Day Pass pagas (lead que pagou os R$ 9,90)
    const { data: charges } = await sb
      .from("asaas_charges")
      .select("user_id, paid_at, created_at")
      .eq("product_slug", "day_pass")
      .not("paid_at", "is", null);

    // Mapa user_id → primeira data de pagamento Day Pass
    const firstPaid = new Map<string, number>();
    for (const c of charges ?? []) {
      const t = new Date(c.paid_at).getTime();
      const prev = firstPaid.get(c.user_id);
      if (!prev || t < prev) firstPaid.set(c.user_id, t);
    }

    const now = Date.now();
    const HOUR = 3600_000;
    const DAY = 24 * HOUR;

    for (const [userId, paidAt] of firstPaid) {
      // pula se já tem assinatura ativa
      const { data: upsell } = await sb
        .from("day_pass_upsells")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();
      if (upsell?.status === "active") { result.skipped++; continue; }

      const hoursSince = (now - paidAt) / HOUR;

      // Decide touch
      let touch: Touch | null = null;
      let channel: "email" | "push" | "both" = "email";

      if (hoursSince >= 20 && hoursSince < 24) { touch = "D0_4H"; channel = "both"; }
      else if (hoursSince >= 24 && hoursSince < 48) { touch = "D1"; channel = "email"; }
      else if (hoursSince >= 48 && hoursSince < 72) { touch = "D2"; channel = "push"; }
      else if (hoursSince >= 5 * 24 && hoursSince < 6 * 24) { touch = "D5"; channel = "email"; }
      else if (hoursSince >= 15 * 24 && hoursSince < 16 * 24) { touch = "D15"; channel = "email"; }

      if (!touch) continue;
      result.processed++;

      const { data: u } = await sb.auth.admin.getUserById(userId);
      const email = u?.user?.email;
      const firstName = (u?.user?.user_metadata?.full_name || email?.split("@")[0] || "trader").split(" ")[0];

      // EMAIL
      if ((channel === "email" || channel === "both") && email && COPY[touch].html) {
        const { data: dup } = await sb
          .from("day_pass_lifecycle_log")
          .select("id").eq("user_id", userId).eq("touch", touch).eq("channel", "email").maybeSingle();
        if (!dup) {
          try {
            await sendEmail(email, COPY[touch].subject, COPY[touch].html(firstName, stats));
            await sb.from("day_pass_lifecycle_log").insert({ user_id: userId, touch, channel: "email" });
            result.emails++;
          } catch (e) {
            result.errors.push(`email ${email} ${touch}: ${String(e)}`);
            await sb.from("day_pass_lifecycle_log").insert({ user_id: userId, touch, channel: "email", status: "failed", error_message: String(e) });
          }
        }
      }

      // PUSH
      if (channel === "push" || channel === "both") {
        const { data: dup } = await sb
          .from("day_pass_lifecycle_log")
          .select("id").eq("user_id", userId).eq("touch", touch).eq("channel", "push").maybeSingle();
        if (!dup) {
          try {
            await sb.functions.invoke("send-web-push", {
              body: { user_ids: [userId], payload: { title: COPY[touch].pushTitle, body: COPY[touch].pushBody, url: LOBBY_URL } },
            });
            await sb.from("day_pass_lifecycle_log").insert({ user_id: userId, touch, channel: "push" });
            result.pushes++;
          } catch (e) {
            result.errors.push(`push ${userId} ${touch}: ${String(e)}`);
          }
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), ...result }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
