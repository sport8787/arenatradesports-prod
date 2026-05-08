---
name: Camada 2 — AI Borderline Validator
description: Trader Sports — validador Gemini para sinais ao vivo com confidence 55-65; CONFIRMA/VETA com fail-open; logs em borderline_ai_validations; kill switch borderline_ai_validator
type: feature
---

# Camada 2 — Validador IA para sinais borderline

## Quando dispara
Em `analyze-live-matches`, após calibrationFloor e antes do insert de `mycroft_analyses`:
- verdict ∈ APROVADO / APROVADO_SITUACIONAL / LABAREDA
- confidence ∈ [55, 65]
- kill switch `cron_settings.borderline_ai_validator` ON (default ON)

## Modelo
`gemini-2.5-flash-lite` direto via v1beta (`GEMINI_API_KEY`), 200 tokens, 15s timeout, JSON forçado.

## Decisões
- **CONFIRMA**: mantém verdict, ajusta confidence em +N (0..+10).
- **VETA**: rebaixa para AGUARDAR, prefixa thesis com `[IA-VETO] {reason}`.
- **ERROR/SKIP**: mantém original (fail-open).

## Persistência
Tabela `borderline_ai_validations` (RLS admin-read) com original/final verdict, ajuste, motivo, latência, stats_snapshot, outcome (preenchido depois).

## UI
`/admin/borderline-ai` (linkada no AdminHub > Mycroft): toggle kill switch + métricas (Total/Confirma/Veta/Erro/% Veto/Latência média) + tabela das últimas 200.

## Helper
`supabase/functions/_shared/borderlineAIValidator.ts` — exporta `isBorderline`, `validateBorderline`, `BORDERLINE_MIN=55`, `BORDERLINE_MAX=65`.
