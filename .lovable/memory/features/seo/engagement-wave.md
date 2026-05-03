---
name: SEO Engagement Wave
description: Wave 2 do SEO/engajamento — resumo IA Gemini nas rodadas, push automático em nova rodada, email semanal Liga Mycroft, A/B test do H1 da landing
type: feature
---

## 1. Resumo IA SEO-denso na rodada
- `seo-rodada-brasileirao` chama Gemini direto (`gemini-2.5-flash`, GEMINI_API_KEY) e injeta 2 parágrafos com keywords obrigatórias ("palpites Brasileirão 2026", "previsão de jogos de futebol", "análise de apostas com IA", "Oráculo Mycroft", "edge", "Nª rodada") dentro de `<div class="summary">`.
- Fallback: se Gemini falhar ou não houver sinais, mantém o parágrafo estático antigo.

## 2. Push automático de nova rodada
- `seo-publish-rodada` detecta via `seo_rodadas_publicadas.published_at == updated_at (±5s)` se é primeira publicação.
- Se sim e `signalsCount > 0`, dispara `send-web-push` em **broadcast** com tag `seo-rodada-N`, link para `/blog/brasileirao-2026/rodada-N.html`.

## 3. Email semanal Liga Mycroft
- Edge `liga-mycroft-weekly-recap` + cron `0 14 * * 0` (domingo 14h UTC / 11h BRT, jobid 56).
- Para cada usuário com assinatura ativa que teve atividade na semana (BC ganho OU bet resolvida): envia HTML com posição no ranking (`liga_mycroft_leaderboard`), ROI%, BC da semana + total, melhor mercado da semana (filtro stake>=50), CTA `/loja-bc`.
- Provider: Resend direto (mesma config do `email-daily-recap`). Throttle 120ms/email.

## 4. A/B test do H1 da landing
- `src/lib/landingAbTest.ts` — split 50/50, persiste em `localStorage.om_h1_variant`.
- Variantes:
  - **A**: "A IA QUE ENCONTRA / APOSTAS LUCRATIVAS / ANTES DAS CASAS AJUSTAREM AS ODDS" (controle)
  - **B**: "AUMENTE SEU / ROI EM APOSTAS / COM ANÁLISE DE IA EM TEMPO REAL" (ROI-first)
- PostHog: super-property `landing_h1_variant` registrada na atribuição + evento `landing_h1_assigned`. Helper `trackH1Conversion(eventName)` adiciona variante a qualquer evento de conversão.
- Análise: `posthog → Trends → eventos de conversão → breakdown by landing_h1_variant`.
