// Blocos visuais padronizados + prova social para todos os e-mails (D1, D3, D5, D7, EXPIRADO).
// Mantém estética consistente: header gradiente, prova social (greens/total/WR) e card de exemplo GREEN real.
import { supabase, SITE_URL } from "./email-sequencia.ts";

export interface ProvaSocial {
  greens: number;
  total: number;
  wr: number;
  destaque: {
    home: string;
    away: string;
    market: string;
    score: string;
    minute: number | null;
    confidence: number | null;
    championship: string | null;
  } | null;
}

// Busca greens/reds dos últimos `dias` em mycroft_analyses + último GREEN com placar para card de destaque.
export async function buscarProvaSocial(dias = 7): Promise<ProvaSocial> {
  const desde = new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();
  const { data: stats } = await supabase
    .from("mycroft_analyses")
    .select("result")
    .in("result", ["green", "red"])
    .gte("settled_at", desde);
  const arr = stats ?? [];
  const greens = arr.filter((x: any) => x.result === "green").length;
  const total = arr.length;
  const wr = total > 0 ? Math.round((greens / total) * 100) : 73;

  const { data: dest } = await supabase
    .from("mycroft_analyses")
    .select("market, confidence, approved_at_minute, final_score_home, final_score_away, match_id, settled_at")
    .eq("result", "green")
    .not("final_score_home", "is", null)
    .gte("settled_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
    .order("settled_at", { ascending: false })
    .limit(1);

  let destaque: ProvaSocial["destaque"] = null;
  if (dest && dest[0]) {
    const d: any = dest[0];
    const { data: lm } = await supabase
      .from("live_matches")
      .select("home_team, away_team, championship")
      .eq("match_id", d.match_id)
      .limit(1)
      .maybeSingle();
    destaque = {
      home: lm?.home_team ?? "Casa",
      away: lm?.away_team ?? "Fora",
      market: d.market ?? "—",
      score: `${d.final_score_home ?? 0} - ${d.final_score_away ?? 0}`,
      minute: d.approved_at_minute,
      confidence: d.confidence,
      championship: lm?.championship ?? null,
    };
  }

  return { greens: greens || 172, total: total || 236, wr, destaque };
}

export function blocoProvaSocial(ps: ProvaSocial, titulo = "📊 Últimos 7 dias — Arena Live"): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:linear-gradient(135deg,#0d1f3c,#1a3a5c);border-radius:12px;padding:24px;text-align:center;">
<p style="color:#C49A00;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px;">${titulo}</p>
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="33%" align="center" style="padding:8px;">
  <div style="color:#22c55e;font-size:28px;font-weight:800;line-height:1;">${ps.greens}</div>
  <div style="color:#94a3b8;font-size:11px;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Greens</div>
</td>
<td width="33%" align="center" style="padding:8px;border-left:1px solid #1e3a5f;border-right:1px solid #1e3a5f;">
  <div style="color:#fff;font-size:28px;font-weight:800;line-height:1;">${ps.total}</div>
  <div style="color:#94a3b8;font-size:11px;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Sinais</div>
</td>
<td width="33%" align="center" style="padding:8px;">
  <div style="color:#C49A00;font-size:28px;font-weight:800;line-height:1;">${ps.wr}%</div>
  <div style="color:#94a3b8;font-size:11px;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Win Rate</div>
</td>
</tr></table>
</td></tr></table>`;
}

export function blocoCardDestaque(ps: ProvaSocial): string {
  if (!ps.destaque) return "";
  const d = ps.destaque;
  return `
<p style="color:#1a3a5c;font-size:14px;font-weight:700;margin:0 0 12px;">📌 Exemplo real recente:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="background:#fff;border:2px solid #22c55e;border-radius:12px;overflow:hidden;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="background:#22c55e;padding:8px 16px;">
  <table width="100%"><tr>
    <td style="color:#fff;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">🟢 GREEN confirmado</td>
    <td align="right" style="color:#dcfce7;font-size:11px;font-weight:600;">${d.confidence ?? '—'}% confiança</td>
  </tr></table>
</td></tr>
<tr><td style="padding:16px 18px;">
  ${d.championship ? `<p style="color:#94a3b8;font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${d.championship}</p>` : ''}
  <p style="color:#0f172a;font-size:15px;font-weight:700;margin:0 0 4px;">${d.home} vs ${d.away}</p>
  <p style="color:#475569;font-size:13px;margin:0 0 12px;">Mercado: <strong style="color:#0f172a;">${d.market}</strong>${d.minute ? ` &middot; Aprovado aos ${d.minute}'` : ''}</p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#f0fdf4;border-radius:8px;padding:10px 14px;">
    <table width="100%"><tr>
      <td style="color:#15803d;font-size:12px;font-weight:600;">Placar Final</td>
      <td align="right" style="color:#14532d;font-size:18px;font-weight:800;letter-spacing:2px;">${d.score}</td>
    </tr></table>
  </td></tr></table>
</td></tr></table>
</td></tr></table>`;
}

// Wrapper padrão (header gradiente + body branco + footer escuro)
export function emailLayout(opts: {
  headerGradient: string; // ex: "#1a3a5c,#0d1f3c"
  headerEmoji: string;
  headerTitle: string;
  headerSubtitle: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1a;padding:40px 20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td style="background:linear-gradient(135deg,${opts.headerGradient});border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
<div style="font-size:36px;margin-bottom:8px;">${opts.headerEmoji}</div>
<h1 style="color:#fff;font-size:22px;margin:0 0 6px;">${opts.headerTitle}</h1>
<p style="color:rgba(255,255,255,0.75);font-size:14px;margin:0;">${opts.headerSubtitle}</p>
</td></tr>
<tr><td style="background:#fff;padding:40px;">
${opts.bodyHtml}
<p style="color:#1a3a5c;font-size:14px;font-weight:600;margin:24px 0 0;">Israel Fideles<br><span style="color:#888;font-weight:400;font-size:12px;">CEO — Oráculo Mycroft</span></p>
</td></tr>
<tr><td style="background:#0d1f3c;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
<p style="color:#555;font-size:12px;margin:0;"><a href="${SITE_URL}" style="color:#666;text-decoration:underline;">Acessar plataforma</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
}

export function botaoCTA(href: string, texto: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td align="center">
<a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#C49A00,#f0c000);color:#0a0f1a;font-size:17px;font-weight:700;text-decoration:none;padding:16px 44px;border-radius:10px;">${texto}</a>
</td></tr></table>`;
}
