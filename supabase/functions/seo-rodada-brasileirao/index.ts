// Edge function pública: gera HTML SEO-friendly de uma rodada do Brasileirão
// puxando sinais APROVADOS reais do banco (punter_analyses).
//
// Uso:
//   GET /functions/v1/seo-rodada-brasileirao?rodada=2&from=2026-05-10&to=2026-05-13
//
// Retorna: text/html com Article Schema, canonical, OG tags e tabela de sinais.
// Sem auth (apikey anon basta) — pensado para ser indexado por crawlers via proxy
// ou copiado para /public/blog/brasileirao-2026/rodada-N.html.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

async function generateSeoSummary(rodada: string, signals: any[]): Promise<string> {
  if (!GEMINI_API_KEY || !signals.length) return "";
  try {
    const top = signals.slice(0, 8).map((s) => `${s.home_team} x ${s.away_team} - ${s.market} @${Number(s.odd ?? 0).toFixed(2)} (edge ${Number(s.value_percentage ?? 0).toFixed(1)}%)`).join("; ");
    const prompt = `Você é um analista de apostas SEO. Escreva 2 parágrafos (máximo 180 palavras totais) sobre os palpites da ${rodada}ª rodada do Brasileirão 2026 analisados por IA.
DENSIDADE DE KEYWORDS obrigatória — distribua naturalmente: "palpites Brasileirão 2026", "previsão de jogos de futebol", "análise de apostas com IA", "Oráculo Mycroft", "edge", "valor positivo", "${rodada}ª rodada".
Estilo: jornalístico-técnico, sem floreio, sem bullet, sem emoji, sem repetir o título.
Sinais detectados: ${top}.`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 500 } }),
    });
    if (!r.ok) { console.warn("[seo-summary] gemini fail", r.status); return ""; }
    const j = await r.json();
    return j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  } catch (e) { console.warn("[seo-summary] error", e); return ""; }
}

const escape = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const rodada = url.searchParams.get("rodada") ?? "1";
    const from = url.searchParams.get("from"); // YYYY-MM-DD
    const to = url.searchParams.get("to");
    if (!from || !to) {
      return new Response("Missing 'from' or 'to' (YYYY-MM-DD)", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data, error } = await supabase
      .from("punter_analyses")
      .select("home_team,away_team,league,commence_time,market,odd,fair_odd,value_percentage,verdict,confidence")
      .or("league.ilike.%Brazil%,league.ilike.%Brasileir%")
      .gte("commence_time", `${from}T00:00:00Z`)
      .lte("commence_time", `${to}T23:59:59Z`)
      .in("verdict", ["APROVADO", "APROVADO SITUACIONAL", "LABAREDA"])
      .order("commence_time", { ascending: true })
      .limit(50);

    if (error) throw error;

    const rows = (data ?? []).map((s) => `
      <tr>
        <td>${escape(s.home_team)} × ${escape(s.away_team)}</td>
        <td>${escape(s.market)}</td>
        <td>${Number(s.fair_odd ?? s.odd ?? 0).toFixed(2)}</td>
        <td>${Number(s.odd ?? 0).toFixed(2)}</td>
        <td>${Number(s.value_percentage ?? 0).toFixed(1)}%</td>
        <td class="green">${escape(s.verdict)}</td>
      </tr>`).join("");

    const totalSignals = data?.length ?? 0;
    const canonical = `https://oraculo-mycroft.com/blog/brasileirao-2026/rodada-${rodada}.html`;
    const dateNow = new Date().toISOString().slice(0, 10);
    const aiSummary = await generateSeoSummary(rodada, data ?? []);

    // Notícias recentes do Brasileirão (link cruzado)
    const { data: noticias } = await supabase
      .from("seo_news_posts")
      .select("slug,title,summary,published_at")
      .eq("league_slug", "brasileirao-2026")
      .order("published_at", { ascending: false })
      .limit(5);
    const noticiasHtml = noticias && noticias.length
      ? `<h2>📰 Notícias da rodada</h2><ul>${noticias.map((n: { slug: string; title: string; summary: string; published_at: string }) =>
          `<li><a href="/blog/noticias/${escape(n.slug)}.html"><strong>${escape(n.title)}</strong></a><br/><span class="muted">${String(n.published_at).slice(0,10)} — ${escape(n.summary ?? "")}</span></li>`
        ).join("")}</ul>`
      : "";

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Palpites Brasileirão 2026 — ${escape(rodada)}ª Rodada por IA | Oráculo Mycroft</title>
<meta name="description" content="Palpites da ${escape(rodada)}ª rodada do Brasileirão 2026 gerados por IA. ${totalSignals} sinais aprovados com odd justa, edge e plano estratégico." />
<meta name="keywords" content="palpites Brasileirão 2026 ${escape(rodada)}ª rodada, palpites Brasileirão 2026 IA, previsão de jogos de futebol, análise de apostas esportivas, dicas de apostas esportivas, oráculo mycroft" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:title" content="Palpites Brasileirão 2026 — ${escape(rodada)}ª Rodada por IA" />
<meta property="og:description" content="${totalSignals} sinais aprovados pela IA Mycroft para a ${escape(rodada)}ª rodada." />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="https://oraculo-mycroft.com/og-image.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":"Palpites Brasileirão 2026 — ${escape(rodada)}ª Rodada por IA","author":{"@type":"Organization","name":"Oráculo Mycroft"},"publisher":{"@type":"Organization","name":"Oráculo Mycroft","logo":{"@type":"ImageObject","url":"https://oraculo-mycroft.com/favicon.png"}},"datePublished":"${dateNow}","dateModified":"${dateNow}","image":"https://oraculo-mycroft.com/og-image.jpg","mainEntityOfPage":"${canonical}"}
</script>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:2rem 1.25rem;line-height:1.7;color:#0f172a;background:#fff}
h1{font-size:2rem;line-height:1.25;margin:0 0 1rem}
h2{font-size:1.35rem;margin:2rem 0 .5rem;border-bottom:1px solid #e2e8f0;padding-bottom:.25rem}
a{color:#0369a1}
.muted{color:#64748b;font-size:.9rem}
.cta{display:inline-block;margin:1.5rem 0;background:#0a1628;color:#fff;padding:.75rem 1.25rem;border-radius:6px;text-decoration:none}
table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.95rem}
th,td{padding:.55rem;border:1px solid #e2e8f0;text-align:left}
th{background:#f8fafc}
.green{color:#166534;font-weight:600}
.summary{background:#f8fafc;border-left:3px solid #0a1628;padding:1rem 1.25rem;margin:1.25rem 0;border-radius:4px}
.summary p{margin:.5rem 0}
nav a{margin-right:1rem}
</style>
</head>
<body>
<nav><a href="/">Home</a> <a href="/blog/">Blog</a> <a href="/blog/brasileirao-2026/">Brasileirão 2026</a></nav>
<h1>Palpites Brasileirão 2026 — ${escape(rodada)}ª Rodada por IA</h1>
<p class="muted">Atualizado em ${dateNow} · Análise por Oráculo Mycroft · ${totalSignals} sinais aprovados</p>

${aiSummary ? `<div class="summary">${aiSummary.split("\n").filter(Boolean).map((p) => `<p>${escape(p)}</p>`).join("")}</div>` : `<p>Confira os <strong>palpites da ${escape(rodada)}ª rodada do Brasileirão 2026</strong> aprovados pela IA Mycroft. Cada análise traz <strong>previsão de jogo de futebol</strong>, mercado recomendado, odd justa e edge percentual.</p>`}

<h2>Sinais Aprovados</h2>
${totalSignals === 0
  ? `<p class="muted">Nenhum sinal aprovado encontrado entre ${escape(from)} e ${escape(to)}. Volte em breve.</p>`
  : `<table><tr><th>Jogo</th><th>Mercado</th><th>Odd Justa</th><th>Odd</th><th>Edge</th><th>Veredicto</th></tr>${rows}</table>`}

<a class="cta" href="https://oraculo-mycroft.com/auth">Receber sinais ao vivo — 7 dias grátis</a>

${noticiasHtml}

<h2>Próximas rodadas</h2>
<p><a href="/blog/brasileirao-2026/">Voltar ao hub do Brasileirão 2026</a> · <a href="/blog/noticias/">Todas as notícias</a></p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("seo-rodada error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(`Error: ${msg}`, { status: 500, headers: corsHeaders });
  }
});
