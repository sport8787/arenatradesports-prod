// Edge function de cron: gera HTML SEO de uma rodada do Brasileirão e publica
// no bucket público `seo-static`, atualizando também o sitemap.xml.
//
// Servido via rewrite no vercel.json:
//   /blog/brasileirao-2026/rodada-N.html  ->  storage seo-static
//   /sitemap.xml                          ->  storage seo-static/sitemap.xml
//
// Modo: pode ser chamada sem params (auto-detecta próxima rodada com base
// nos sinais aprovados nos próximos 7 dias) ou com ?rodada=N&from=YYYY-MM-DD&to=YYYY-MM-DD.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SITE_ORIGIN = "https://oraculo-mycroft.com";
const BUCKET = "seo-static";
const CHAMPIONSHIP = "brasileirao-2026";

function todayIsoDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function detectNextRoundWindow(supabase: ReturnType<typeof createClient>) {
  // Janela: hoje até hoje+7d
  const from = todayIsoDate(0);
  const to = todayIsoDate(7);
  // Pega último número publicado e incrementa
  const { data: last } = await supabase
    .from("seo_rodadas_publicadas")
    .select("rodada")
    .eq("championship", CHAMPIONSHIP)
    .order("rodada", { ascending: false })
    .limit(1);
  const nextRodada = (last?.[0]?.rodada ?? 0) + 1;
  return { rodada: nextRodada, from, to };
}

async function fetchRodadaHtml(rodada: number, from: string, to: string): Promise<string> {
  const url = `${SUPABASE_URL}/functions/v1/seo-rodada-brasileirao?rodada=${rodada}&from=${from}&to=${to}`;
  const r = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`seo-rodada-brasileirao falhou [${r.status}]: ${await r.text()}`);
  return await r.text();
}

async function uploadHtml(supabase: ReturnType<typeof createClient>, path: string, html: string) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([html], { type: "text/html; charset=utf-8" }), {
      upsert: true,
      contentType: "text/html; charset=utf-8",
      cacheControl: "3600",
    });
  if (error) throw error;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function rebuildSitemap(supabase: ReturnType<typeof createClient>) {
  const { data: rodadas } = await supabase
    .from("seo_rodadas_publicadas")
    .select("rodada, updated_at")
    .eq("championship", CHAMPIONSHIP)
    .order("rodada", { ascending: true });

  const baseUrls: Array<{ loc: string; priority: string; changefreq: string; lastmod?: string }> = [
    { loc: `${SITE_ORIGIN}/`, priority: "1.0", changefreq: "daily" },
    { loc: `${SITE_ORIGIN}/landing.html`, priority: "0.95", changefreq: "weekly" },
    { loc: `${SITE_ORIGIN}/auth`, priority: "0.8", changefreq: "monthly" },
    { loc: `${SITE_ORIGIN}/paywall`, priority: "0.8", changefreq: "monthly" },
    { loc: `${SITE_ORIGIN}/oferta-especial`, priority: "0.85", changefreq: "weekly" },
    { loc: `${SITE_ORIGIN}/punter`, priority: "0.7", changefreq: "daily" },
    { loc: `${SITE_ORIGIN}/loja-bc`, priority: "0.7", changefreq: "weekly" },
    { loc: `${SITE_ORIGIN}/como-ganhar-bc`, priority: "0.6", changefreq: "monthly" },
    { loc: `${SITE_ORIGIN}/como-jogar`, priority: "0.6", changefreq: "monthly" },
    { loc: `${SITE_ORIGIN}/blog/`, priority: "0.9", changefreq: "weekly" },
    { loc: `${SITE_ORIGIN}/blog/ferramenta-analise-apostas-esportivas-ia.html`, priority: "0.85", changefreq: "monthly", lastmod: "2026-05-03" },
    { loc: `${SITE_ORIGIN}/blog/previsao-jogos-futebol-ia.html`, priority: "0.85", changefreq: "monthly", lastmod: "2026-05-03" },
    { loc: `${SITE_ORIGIN}/blog/edge-gain-apostas-esportivas.html`, priority: "0.85", changefreq: "monthly", lastmod: "2026-05-03" },
    { loc: `${SITE_ORIGIN}/blog/brasileirao-2026/`, priority: "0.9", changefreq: "weekly" },
  ];

  const dynamic = (rodadas ?? []).map((r) => ({
    loc: `${SITE_ORIGIN}/blog/brasileirao-2026/rodada-${r.rodada}.html`,
    priority: "0.85",
    changefreq: "weekly",
    lastmod: String(r.updated_at).slice(0, 10),
  }));

  const all = [...baseUrls, ...dynamic];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map((u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload("sitemap.xml", new Blob([xml], { type: "application/xml" }), {
      upsert: true,
      contentType: "application/xml; charset=utf-8",
      cacheControl: "600",
    });
  if (error) throw error;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/sitemap.xml`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Params opcionais
    const url = new URL(req.url);
    let rodada = Number(url.searchParams.get("rodada") ?? 0);
    let from = url.searchParams.get("from") ?? "";
    let to = url.searchParams.get("to") ?? "";

    if (!rodada || !from || !to) {
      const auto = await detectNextRoundWindow(supabase);
      rodada = rodada || auto.rodada;
      from = from || auto.from;
      to = to || auto.to;
    }

    console.log(`[seo-publish-rodada] gerando rodada=${rodada} ${from}→${to}`);

    // 1. Gera HTML
    const html = await fetchRodadaHtml(rodada, from, to);

    // Conta sinais (heurística: número de <tr> menos cabeçalho)
    const trMatches = html.match(/<tr>/g) ?? [];
    const signalsCount = Math.max(0, trMatches.length - 1);

    // 2. Sobe HTML
    const path = `${CHAMPIONSHIP}/rodada-${rodada}.html`;
    const publicUrl = await uploadHtml(supabase, path, html);

    // 3. Registra/atualiza no DB
    await supabase.from("seo_rodadas_publicadas").upsert(
      {
        championship: CHAMPIONSHIP,
        rodada,
        from_date: from,
        to_date: to,
        signals_count: signalsCount,
        storage_path: path,
        public_url: publicUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "championship,rodada" }
    );

    // 4. Reconstrói sitemap
    const sitemapUrl = await rebuildSitemap(supabase);

    console.log(`[seo-publish-rodada] OK rodada=${rodada} signals=${signalsCount}`);

    return new Response(
      JSON.stringify({
        ok: true,
        rodada,
        from,
        to,
        signals_count: signalsCount,
        public_url: publicUrl,
        sitemap_url: sitemapUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[seo-publish-rodada] error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
