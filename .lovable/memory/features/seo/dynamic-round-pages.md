---
name: SEO Dynamic Rounds
description: Pipeline auto de páginas SEO de rodadas do Brasileirão (edge geradora + cron publicador + bucket público + rewrites Vercel)
type: feature
---

## Pipeline
1. **Edge `seo-rodada-brasileirao`** — gera HTML SEO-friendly de uma rodada (Article schema, OG, tabela de sinais APROVADOS reais de `punter_analyses`).
2. **Edge `seo-publish-rodada`** — chama a edge geradora, faz upload do HTML em `storage://seo-static/brasileirao-2026/rodada-N.html`, registra em `seo_rodadas_publicadas` e reconstrói `storage://seo-static/sitemap.xml`.
3. **Cron `seo-publish-rodada-daily`** — diário 06h UTC. Auto-detecta próxima rodada (último publicado +1) com janela hoje→hoje+7d.
4. **`vercel.json`** — rewrites:
   - `/sitemap.xml` → bucket
   - `/blog/brasileirao-2026/rodada-:n.html` → bucket

## Tabelas
- `seo_rodadas_publicadas(championship, rodada UNIQUE, from_date, to_date, signals_count, storage_path, public_url, updated_at)` — RLS: read público, write admin.

## Bucket
- `seo-static` (público). Policies: SELECT pública, INSERT/UPDATE service role.

## Override manual
`POST /functions/v1/seo-publish-rodada?rodada=N&from=YYYY-MM-DD&to=YYYY-MM-DD`

## Não esquecer
- O HTML estático antigo `public/blog/brasileirao-2026/rodada-1.html` continua no repo como fallback de build, mas em produção o rewrite do Vercel sempre serve a versão fresca do bucket.
