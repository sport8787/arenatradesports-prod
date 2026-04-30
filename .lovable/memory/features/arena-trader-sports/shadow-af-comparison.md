---
name: Shadow AF — Comparação Sportmonks vs API-Football
description: Aba admin compara aprovações lado a lado. Inclui (A) painel agregado win-rate por provider/período, (B) liquidação automática shadow via trigger no live_matches, (C) diff de stats brutas via stats_snapshot.
type: feature
---

# Comparação Shadow AF

Objetivo: decidir se vale manter Sportmonks Pro (~R$6k) com base em dados reais.

## Componentes

- **Tabela primária:** `mycroft_analyses` (Sportmonks)
- **Tabela shadow:** `mycroft_analyses_shadow_af` (API-Football)
- **Edges:** `analyze-live-matches` (primária), `analyze-live-shadow-af` (paralela). Ambas seguem janela 5/5/1 min.
- **Cron primário:** `cron-live-matches-1min` · **Cron shadow:** `shadow-af-cron-1min` (toggle `cron_settings.shadow_af_cron`).

## A — Painel agregado

RPC `compare_providers_metrics(p_since)` retorna por provider: total_aprovados, liquidados, greens, reds, win_rate, pendentes.
RPC `compare_providers_divergences(p_since)` retorna: confirmados_ambas, so_sportmonks, so_api_football, mesma_partida_mercado_diferente.
UI tem seletor de período: **Ativação** (`SHADOW_AF_ACTIVATED_AT = 2026-04-30T15:00:00Z`), **7d**, **30d**.

## B — Liquidação automática

- `settle_mycroft_shadow_af(id, score_h, score_a, reason)` espelha `settle_mycroft_analysis` (Over/Under/BTTS).
- Trigger `auto_settle_shadow_af` em `live_matches` (AFTER UPDATE) liquida todos os sinais shadow do match quando status finalizado e minuto ≥ 88. Mesmo guard anti-falso-final da liquidação primária.

## C — Diff de stats

- Coluna `stats_snapshot JSONB` em ambas as tabelas. Gravada APENAS quando verdict ∈ APROVADO/APROVADO_SITUACIONAL/LABAREDA.
- Formato: `{ provider, minute, score_home, score_away, stats: {...} }`.
- Modal `StatsDiffModal` na UI lista métrica × Sportmonks × AF × Δ, destacando linhas com divergência.

## Onde mexer

- Componente: `src/components/dashboard/ShadowAfApprovedTab.tsx`
- Edge shadow: `supabase/functions/analyze-live-shadow-af/index.ts`
- Edge primária (snapshot): `supabase/functions/analyze-live-matches/index.ts` (variável `_isApprovedSm`)
