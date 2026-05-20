---
name: Shadow AI — Gemini paralelo
description: Trader Sports — análise paralela pura de IA Gemini (Lovable AI Gateway) sobre live_matches; dedup por match_id+mercado (não empilha); aba admin "Aprovados (IA)"
type: feature
---

# Shadow AI (Gemini via Lovable AI)

## Objetivo
Rodar análise pura de IA em paralelo ao motor determinístico, sem empilhar sinais, para comparar performance.

## Componentes
- **Tabela** `mycroft_analyses_shadow_ai` (RLS admin-read). Campos extras vs shadow_af: `model`, `latency_ms`, `raw_response`. Default `provider='gemini-ai'`.
- **Edge** `supabase/functions/analyze-live-shadow-ai`:
  - Modelo `google/gemini-3-flash-preview` via gateway `https://ai.gateway.lovable.dev/v1/chat/completions` (header `Authorization: Bearer LOVABLE_API_KEY`).
  - Janela de reanálise: <25min → 5min · ≥25min → 1min (mesma do motor primário).
  - **Dedup por (match_id, normMarket)** — bloqueia inserir 2º APROVADO no mesmo mercado do mesmo jogo.
  - Prompt JSON pt-br pedindo verdict/market/confidence/odd/thesis/alerts.
  - Kill switch via `cron_settings.shadow_ai_cron` (default ON).
- **Cron**: chamado fire-and-forget em `cron-live-matches` após a análise primária (não atrasa o ciclo).
- **Liquidação**: `settle_mycroft_shadow_ai` + trigger `auto_settle_shadow_ai` em `live_matches` (mesma lógica do AF: Over/Under/BTTS/Próximo Gol).
- **UI Admin**:
  - Aba "Aprovados (IA)" em `/arena-trader-sports` (apenas admin) — componente `ShadowAiApprovedTab`.
  - Toggle `ShadowAiCronToggle` (violeta) ao lado do CronToggle do AF.
  - Métricas: aprovados / liquidados / GREEN·RED / win-rate.

## Não confundir com
- `mycroft_analyses_shadow_af` — provider API-Football, motor determinístico.
- `borderline_ai_validations` — camada 2 que só revisa sinais 55-65% do motor primário.
