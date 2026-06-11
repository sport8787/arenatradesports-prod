// Helpers compartilhados pela sequência de e-mails (D1, D3, D5, D7, EXPIRADO).
// Centraliza: configuração Resend, busca de usuários elegíveis, registro no log.
import { createClient } from "npm:@supabase/supabase-js@2";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SUPABASE_SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// Domínio verificado no Resend
export const FROM_EMAIL = "Oráculo Mycroft <mycroft@oraculo-mycroft.com>";
export const FROM_EMAIL_PESSOAL = "Israel Fideles <israel@oraculo-mycroft.com>";
export const REPLY_TO = "israel@oraculo-mycroft.com";

export const SITE_URL = "https://oraculo-mycroft.com";
export const ASSINAR_URL = "https://oraculo-mycroft.com/oferta-especial";
export const TELEGRAM_URL = "https://t.me/oraculo_mycroft_live";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

export type Sequencia = "D1" | "D3" | "D5" | "D7" | "EXPIRADO";

export interface UsuarioAlvo {
  user_id: string;
  email: string;
  full_name: string;
  primeiro_nome: string;
}

// Busca todos usuários do auth e filtra por janela de cadastro (em dias atrás).
// minDias <= idade < maxDias
// Ex.: D3 -> minDias=3, maxDias=4
export async function buscarUsuariosElegiveis(
  minDias: number,
  maxDias: number,
  sequencia: Sequencia,
  exigirNaoAssinante: boolean,
): Promise<UsuarioAlvo[]> {
  const now = Date.now();
  const minDate = new Date(now - maxDias * 24 * 3600 * 1000);
  const maxDate = new Date(now - minDias * 24 * 3600 * 1000);

  const alvos: UsuarioAlvo[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error(`[${sequencia}] Erro ao listar usuários:`, error);
      break;
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const u of users) {
      if (!u.email) continue;
      const created = new Date(u.created_at).getTime();
      if (created < minDate.getTime() || created >= maxDate.getTime()) continue;

      // Já enviado?
      const { data: jaEnviou } = await supabase
        .from("email_sequencia_log")
        .select("id")
        .eq("user_id", u.id)
        .eq("sequencia", sequencia)
        .maybeSingle();
      if (jaEnviou) continue;

      if (exigirNaoAssinante) {
        const { data: assinante } = await supabase
          .from("user_subscriptions")
          .select("id, plan, is_active")
          .eq("user_id", u.id)
          .maybeSingle();
        // Considera assinante quando is_active = true e plan != 'trial'
        if (assinante?.is_active && assinante?.plan && assinante.plan !== "trial") continue;
      }

      const fullName =
        (u.user_metadata as any)?.full_name ||
        (u.user_metadata as any)?.name ||
        u.email!.split("@")[0];

      alvos.push({
        user_id: u.id,
        email: u.email!,
        full_name: fullName,
        primeiro_nome: String(fullName).split(" ")[0],
      });
    }

    if (users.length < perPage) break;
    page++;
  }

  return alvos;
}

// Disparo manual / cron unificado para D1 (cobertura: usuários cadastrados nas últimas 24h).
export async function buscarUsuariosD1(): Promise<UsuarioAlvo[]> {
  return buscarUsuariosElegiveis(0, 1, "D1", false);
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  sequencia: Sequencia;
  userId: string;
  from?: string;
}

export async function enviarResend(p: EmailPayload): Promise<{ ok: boolean; id?: string; error?: any }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: p.from ?? FROM_EMAIL,
        reply_to: REPLY_TO,
        to: [p.to],
        subject: p.subject,
        html: p.html,
        text: p.text,
        tags: [
          { name: "sequencia", value: p.sequencia },
          { name: "user_id", value: p.userId },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[${p.sequencia}] Resend erro p/ ${p.to}:`, err);
      return { ok: false, error: err };
    }
    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (e) {
    console.error(`[${p.sequencia}] Exceção Resend p/ ${p.to}:`, e);
    return { ok: false, error: e };
  }
}

export async function registrarEnvio(
  userId: string,
  email: string,
  sequencia: Sequencia,
  resendId?: string,
  status: "sent" | "failed" | "skipped" = "sent",
  errorMessage?: string,
) {
  await supabase.from("email_sequencia_log").upsert(
    {
      user_id: userId,
      email,
      sequencia,
      resend_id: resendId,
      status,
      error_message: errorMessage ?? null,
      enviado_em: new Date().toISOString(),
    },
    { onConflict: "user_id,sequencia" },
  );
}

// Resumo de resultados reais do sistema (greens/reds dos últimos N dias).
export async function buscarResumoDias(dias: number) {
  const desde = new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("punter_sinais")
    .select("resultado, profit_loss, home_team, away_team, market")
    .in("resultado", ["GREEN", "RED"])
    .gte("created_at", desde)
    .order("settled_at", { ascending: false });

  const greens = (data ?? []).filter((d: any) => d.resultado === "GREEN");
  const reds = (data ?? []).filter((d: any) => d.resultado === "RED");
  const total = greens.length + reds.length;
  const wr = total > 0 ? Math.round((greens.length / total) * 100) : 61;
  const lucro = (data ?? []).reduce((acc: number, d: any) => acc + Number(d.profit_loss ?? 0), 0);

  return {
    greens,
    reds,
    total,
    wr,
    greensCount: greens.length,
    redsCount: reds.length,
    lucro: Math.max(lucro, 0),
  };
}
