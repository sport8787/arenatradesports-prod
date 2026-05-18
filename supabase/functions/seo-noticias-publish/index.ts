// Edge function de cron: busca notícias da API Sportmonks (pré e pós-jogo),
// filtra ligas-alvo (Brasileirão + Top-5 Europa + Libertadores),
// reescreve com Gemini no tom Mycroft injetando contexto do fixture,
// publica HTML estático em seo-static/noticias/{slug}.html + index + sitemap.
//
// Servido via rewrite Vercel:
//   /blog/noticias/                -> seo-static/noticias/index.html
//   /blog/noticias/:slug.html      -> seo-static/noticias/:slug.html
//
// Trigger: cron 08h e 20h UTC (ver setup separado).

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SM_TOKEN = Deno.env.get("SPORTMONKS_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const SM_BASE = "https://api.sportmonks.com/v3";
const SITE_ORIGIN = "https://oraculo-mycroft.com";
const BUCKET = "seo-static";

// Whitelist de ligas (regex case-insensitive). Casado contra league.name vindo do Sportmonks.
const LEAGUE_WHITELIST: Array<{ re: RegExp; slug: string; label: string }> = [
  { re: /brasileir|serie a.*brazil|brazil.*serie a/i, slug: "brasileirao-2026", label: "Brasileirão" },
  { re: /premier league/i, slug: "premier-league", label: "Premier League" },
  { re: /laliga|la liga/i, slug: "laliga", label: "LaLiga" },
  { re: /bundesliga/i, slug: "bundesliga", label: "Bundesliga" },
  { re: /serie a$|serie a italy|italian serie a/i, slug: "serie-a-italia", label: "Serie A Itália" },
  { re: /ligue 1/i, slug: "ligue-1", label: "Ligue 1" },
  { re: /libertadores/i, slug: "libertadores", label: "Libertadores" },
  { re: /sul-?americana|sudamericana/i, slug: "sul-americana", label: "Sul-Americana" },
];

function matchLeague(name: string | null | undefined): { slug: string; label: string } | null {
  if (!name) return null;
  for (const l of LEAGUE_WHITELIST) if (l.re.test(name)) return { slug: l.slug, label: l.label };
  return null;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

const escape = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type SmNewsItem = {
  id: number;
  title?: string;
  text?: string;
  author?: string;
  url?: string;
  image_path?: string;
  fixture_id?: number;
  published_at?: string;
  type?: string;
  fixture?: {
    id: number;
    name?: string;
    starting_at?: string;
    league?: { id: number; name: string };
    participants?: Array<{ name: string; meta?: { location?: string } }>;
    scores?: Array<{ score?: { goals?: number; participant?: string } }>;
  };
};

async function fetchSportmonksNews(endpoint: "post-match" | "pre-match"): Promise<SmNewsItem[]> {
  if (!SM_TOKEN) {
    console.warn("[noticias] SPORTMONKS_API_KEY ausente");
    return [];
  }
  const url = `${SM_BASE}/football/news/${endpoint}?api_token=${SM_TOKEN}&include=fixture.league;fixture.participants;fixture.scores&per_page=50`;
  const r = await fetch(url);
  if (!r.ok) {
    console.warn(`[noticias] sportmonks ${endpoint} fail`, r.status, await r.text().catch(() => ""));
    return [];
  }
  const j = await r.json();
  return Array.isArray(j?.data) ? j.data : [];
}

function buildFixtureContext(item: SmNewsItem): string {
  const f = item.fixture;
  if (!f) return "";
  const teams = (f.participants ?? []).map((p) => p.name).join(" × ");
  const scores = (f.scores ?? [])
    .map((s) => s?.score?.goals)
    .filter((g) => typeof g === "number");
  const placar = scores.length === 2 ? `${scores[0]}-${scores[1]}` : "";
  const data = f.starting_at ? new Date(f.starting_at).toLocaleDateString("pt-BR") : "";
  return [teams, placar, data, f.league?.name].filter(Boolean).join(" · ");
}

async function rewriteWithMycroft(item: SmNewsItem, leagueLabel: string): Promise<{ title: string; summary: string; html: string }> {
  const originalTitle = item.title ?? "Análise de jogo";
  const originalText = item.text ?? "";
  const context = buildFixtureContext(item);
  const kind = item.type === "pre-match" ? "PRÉ-JOGO" : "PÓS-JOGO";

  if (!GEMINI_API_KEY) {
    // Fallback sem IA: copia o texto cru
    return {
      title: originalTitle,
      summary: originalText.slice(0, 180),
      html: `<p>${escape(originalText)}</p>`,
    };
  }

  const prompt = `Você é Mycroft Holmes, analista frio e dedutivo do Oráculo Mycroft. NÃO TORCE — CALCULA.
Reescreva a matéria abaixo em **português brasileiro**, no tom Mycroft: jornalístico-técnico, analítico, sem emoji, sem clichê, sem "torcida feliz".

CONTEXTO DO JOGO: ${context || "n/d"}
LIGA: ${leagueLabel}
TIPO: ${kind}
TÍTULO ORIGINAL: ${originalTitle}
MATÉRIA ORIGINAL:
${originalText.slice(0, 4000)}

REGRAS:
1. Gere conteúdo ORIGINAL (não copie frases). Mínimo 350 palavras, máximo 600.
2. Distribua naturalmente keywords SEO: "análise ${leagueLabel}", "${kind === "PRÉ-JOGO" ? "previsão" : "análise pós-jogo"}", "apostas esportivas", "edge", "valor positivo".
3. Estruture em 3-5 parágrafos, com **negrito** em dados-chave (números, mercados, jogadores).
4. Termine com 1 parágrafo "Leitura Mycroft" — sua dedução fria sobre o que esse jogo sinaliza para próximas operações.
5. NÃO invente estatísticas. Use só o que está na matéria original.

Retorne JSON puro (sem markdown fence):
{"title":"título reescrito até 70 chars","summary":"lead 1 parágrafo até 180 chars","content_html":"<p>...</p><p>...</p>"}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 2200, responseMimeType: "application/json" },
        }),
      }
    );
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const j = await r.json();
    const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(txt);
    return {
      title: String(parsed.title ?? originalTitle).slice(0, 110),
      summary: String(parsed.summary ?? "").slice(0, 220),
      html: String(parsed.content_html ?? `<p>${escape(originalText)}</p>`),
    };
  } catch (e) {
    console.warn("[noticias] gemini rewrite fail", e);
    return { title: originalTitle, summary: originalText.slice(0, 180), html: `<p>${escape(originalText)}</p>` };
  }
}

function buildPostHtml(post: {
  slug: string;
  title: string;
  summary: string;
  content_html: string;
  league: string;
  league_slug: string;
  kind: string;
  hero_image: string | null;
  source_url: string | null;
  source_title: string | null;
  published_at: string;
}): string {
  const canonical = `${SITE_ORIGIN}/blog/noticias/${post.slug}.html`;
  const date = post.published_at.slice(0, 10);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escape(post.title)} | Oráculo Mycroft</title>
<meta name="description" content="${escape(post.summary)}" />
<meta name="keywords" content="${escape(post.league)}, análise de apostas, ${escape(post.kind === "pre-match" ? "previsão" : "pós-jogo")}, oráculo mycroft" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="article" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:title" content="${escape(post.title)}" />
<meta property="og:description" content="${escape(post.summary)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${escape(post.hero_image || `${SITE_ORIGIN}/og-image.jpg`)}" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"NewsArticle","headline":${JSON.stringify(post.title)},"datePublished":"${date}","dateModified":"${date}","author":{"@type":"Organization","name":"Oráculo Mycroft"},"publisher":{"@type":"Organization","name":"Oráculo Mycroft","logo":{"@type":"ImageObject","url":"${SITE_ORIGIN}/favicon.png"}},"image":"${post.hero_image || SITE_ORIGIN + "/og-image.jpg"}","mainEntityOfPage":"${canonical}","articleSection":${JSON.stringify(post.league)}}
</script>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:0 auto;padding:2rem 1.25rem;line-height:1.7;color:#0f172a;background:#fff}
h1{font-size:2rem;line-height:1.25;margin:.5rem 0 1rem}
h2{font-size:1.25rem;margin:1.75rem 0 .5rem}
p{margin:.75rem 0}
a{color:#0369a1}
.muted{color:#64748b;font-size:.9rem}
.badge{display:inline-block;background:#0a1628;color:#fff;padding:.2rem .55rem;border-radius:4px;font-size:.75rem;margin-right:.4rem;text-transform:uppercase;letter-spacing:.05em}
.hero{width:100%;border-radius:8px;margin:1rem 0}
.cta{display:inline-block;margin:1.5rem 0;background:#0a1628;color:#fff;padding:.75rem 1.25rem;border-radius:6px;text-decoration:none}
.source{font-size:.85rem;color:#64748b;margin-top:2rem;padding-top:1rem;border-top:1px solid #e2e8f0}
nav a{margin-right:1rem}
</style>
</head>
<body>
<nav><a href="/">Home</a> <a href="/blog/">Blog</a> <a href="/blog/noticias/">Notícias</a></nav>
<p class="muted"><span class="badge">${escape(post.kind === "pre-match" ? "Pré-jogo" : "Pós-jogo")}</span><span class="badge">${escape(post.league)}</span> ${date}</p>
<h1>${escape(post.title)}</h1>
${post.hero_image ? `<img class="hero" src="${escape(post.hero_image)}" alt="${escape(post.title)}" loading="lazy" />` : ""}
<p><strong>${escape(post.summary)}</strong></p>
${post.content_html}
<a class="cta" href="${SITE_ORIGIN}/auth">Receber sinais ao vivo — 7 dias grátis</a>
${post.source_url ? `<p class="source">Fonte original: <a href="${escape(post.source_url)}" rel="nofollow noopener" target="_blank">${escape(post.source_title || post.source_url)}</a>. Texto reescrito e analisado por IA Mycroft.</p>` : `<p class="source">Texto reescrito e analisado por IA Mycroft a partir de feed Sportmonks.</p>`}
<p><a href="/blog/noticias/">← Voltar para todas as notícias</a></p>
</body>
</html>`;
}

function buildIndexHtml(posts: Array<{ slug: string; title: string; summary: string; league: string; published_at: string; hero_image: string | null }>): string {
  const items = posts
    .map(
      (p) => `<li>
  <a href="/blog/noticias/${p.slug}.html"><strong>${escape(p.title)}</strong></a>
  <div class="muted">${escape(p.league)} · ${p.published_at.slice(0, 10)}</div>
  <p>${escape(p.summary)}</p>
</li>`
    )
    .join("\n");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Notícias de Futebol Analisadas por IA | Oráculo Mycroft</title>
<meta name="description" content="Análises pré e pós-jogo de Brasileirão, Premier League, LaLiga, Bundesliga, Serie A, Ligue 1 e Libertadores reescritas pela IA Mycroft." />
<link rel="canonical" href="${SITE_ORIGIN}/blog/noticias/" />
<meta name="robots" content="index, follow" />
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:780px;margin:0 auto;padding:2rem 1.25rem;line-height:1.7;color:#0f172a;background:#fff}
h1{font-size:2rem;margin:0 0 1rem}
ul{list-style:none;padding:0}
li{padding:1rem 0;border-bottom:1px solid #e2e8f0}
.muted{color:#64748b;font-size:.85rem;margin:.25rem 0}
a{color:#0369a1;text-decoration:none}
a:hover{text-decoration:underline}
nav a{margin-right:1rem;font-size:.95rem}
</style>
</head>
<body>
<nav><a href="/">Home</a> <a href="/blog/">Blog</a></nav>
<h1>Notícias de Futebol — Análise IA Mycroft</h1>
<p>Cobertura pré e pós-jogo de <strong>Brasileirão, Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Libertadores e Sul-Americana</strong>. Todo conteúdo é reescrito pela IA Mycroft com tom analítico e foco em <em>edge</em> para apostas esportivas.</p>
<ul>${items || "<li>Nenhuma notícia publicada ainda.</li>"}</ul>
</body>
</html>`;
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
    .eq("championship", "brasileirao-2026")
    .order("rodada", { ascending: true });

  const { data: noticias } = await supabase
    .from("seo_news_posts")
    .select("slug, updated_at")
    .order("published_at", { ascending: false })
    .limit(500);

  const base = [
    { loc: `${SITE_ORIGIN}/`, p: "1.0", cf: "daily" },
    { loc: `${SITE_ORIGIN}/landing.html`, p: "0.95", cf: "weekly" },
    { loc: `${SITE_ORIGIN}/auth`, p: "0.8", cf: "monthly" },
    { loc: `${SITE_ORIGIN}/paywall`, p: "0.8", cf: "monthly" },
    { loc: `${SITE_ORIGIN}/oferta-especial`, p: "0.85", cf: "weekly" },
    { loc: `${SITE_ORIGIN}/punter`, p: "0.7", cf: "daily" },
    { loc: `${SITE_ORIGIN}/blog/`, p: "0.9", cf: "weekly" },
    { loc: `${SITE_ORIGIN}/blog/brasileirao-2026/`, p: "0.9", cf: "weekly" },
    { loc: `${SITE_ORIGIN}/blog/noticias/`, p: "0.9", cf: "daily" },
  ] as Array<{ loc: string; p: string; cf: string; lm?: string }>;

  const dynR = (rodadas ?? []).map((r) => ({
    loc: `${SITE_ORIGIN}/blog/brasileirao-2026/rodada-${r.rodada}.html`,
    p: "0.85", cf: "weekly", lm: String(r.updated_at).slice(0, 10),
  }));
  const dynN = (noticias ?? []).map((n) => ({
    loc: `${SITE_ORIGIN}/blog/noticias/${n.slug}.html`,
    p: "0.8", cf: "weekly", lm: String(n.updated_at).slice(0, 10),
  }));
  const all = [...base, ...dynR, ...dynN];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map((u) => `  <url>
    <loc>${u.loc}</loc>${u.lm ? `\n    <lastmod>${u.lm}</lastmod>` : ""}
    <changefreq>${u.cf}</changefreq>
    <priority>${u.p}</priority>
  </url>`).join("\n")}
</urlset>`;
  await supabase.storage
    .from(BUCKET)
    .upload("sitemap.xml", new Blob([xml], { type: "application/xml" }), {
      upsert: true,
      contentType: "application/xml; charset=utf-8",
      cacheControl: "600",
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const url = new URL(req.url);
    const maxPosts = Math.min(Number(url.searchParams.get("max") ?? 8), 20);

    // 1. Fetch nas duas categorias
    const [postMatch, preMatch] = await Promise.all([
      fetchSportmonksNews("post-match"),
      fetchSportmonksNews("pre-match"),
    ]);
    const raw = [
      ...postMatch.map((i) => ({ ...i, type: "post-match" as const })),
      ...preMatch.map((i) => ({ ...i, type: "pre-match" as const })),
    ];

    // 2. Filtra por whitelist de ligas
    const candidates: Array<{ item: SmNewsItem; league: { slug: string; label: string } }> = [];
    for (const it of raw) {
      const lg = matchLeague(it.fixture?.league?.name);
      if (lg) candidates.push({ item: it, league: lg });
    }
    console.log(`[noticias] raw=${raw.length} elegíveis=${candidates.length}`);

    // 3. Remove já publicados (por source_id)
    const sourceIds = candidates.map((c) => String(c.item.id));
    const { data: existing } = await supabase
      .from("seo_news_posts")
      .select("source_id")
      .in("source_id", sourceIds.length ? sourceIds : ["__none__"]);
    const existingSet = new Set((existing ?? []).map((e: { source_id: string }) => e.source_id));
    const toPublish = candidates.filter((c) => !existingSet.has(String(c.item.id))).slice(0, maxPosts);

    console.log(`[noticias] novos=${toPublish.length}`);

    const published: Array<{ slug: string; title: string }> = [];
    for (const { item, league } of toPublish) {
      try {
        const rewritten = await rewriteWithMycroft(item, league.label);
        const baseSlug = slugify(`${league.slug}-${rewritten.title}`) || `news-${item.id}`;
        const slug = `${baseSlug}-${item.id}`;
        const post = {
          slug,
          source_id: String(item.id),
          kind: item.type ?? "post-match",
          league: league.label,
          league_slug: league.slug,
          fixture_id: item.fixture?.id ?? item.fixture_id ?? null,
          home_team: item.fixture?.participants?.[0]?.name ?? null,
          away_team: item.fixture?.participants?.[1]?.name ?? null,
          title: rewritten.title,
          summary: rewritten.summary,
          content_html: rewritten.html,
          source_url: item.url ?? null,
          source_title: item.title ?? null,
          hero_image: item.image_path ?? null,
          published_at: item.published_at ?? new Date().toISOString(),
        };
        const html = buildPostHtml({
          ...post,
          hero_image: post.hero_image,
          source_url: post.source_url,
          source_title: post.source_title,
        });
        const path = `noticias/${slug}.html`;
        const publicUrl = await uploadHtml(supabase, path, html);

        await supabase.from("seo_news_posts").upsert(
          { ...post, storage_path: path, public_url: publicUrl, updated_at: new Date().toISOString() },
          { onConflict: "source_id" }
        );
        published.push({ slug, title: post.title });
      } catch (e) {
        console.warn(`[noticias] falha id=${item.id}`, e);
      }
    }

    // 4. Rebuild index
    const { data: latest } = await supabase
      .from("seo_news_posts")
      .select("slug,title,summary,league,published_at,hero_image")
      .order("published_at", { ascending: false })
      .limit(50);
    await uploadHtml(supabase, "noticias/index.html", buildIndexHtml(latest ?? []));

    // 5. Sitemap
    await rebuildSitemap(supabase);

    return new Response(
      JSON.stringify({ ok: true, scanned: raw.length, eligible: candidates.length, new_posts: published.length, published }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[seo-noticias-publish] error", err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
