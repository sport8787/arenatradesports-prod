---
name: A/B Lab
description: Página admin /admin/ab-lab para testar mudanças (provider, prompt, regra) em paralelo antes de promover ao global, com tabelas isoladas e RPC de métricas comparativas
type: feature
---

# A/B Lab — Testes controlados antes de promover ao global

Toda mudança candidata (provider de IA, prompt, regra de aprovação, threshold) roda em paralelo ao motor atual gravando decisões em tabela isolada. Promoção ao global é manual e só após evidência estatística.

## Backend (Fase 1 — concluída 18/05/2026)

**Tabelas** (RLS: somente admins via `has_role(auth.uid(),'admin')`):
- `ab_experiments`: name, hypothesis, scope (`punter|trader|chats|other`), variant_a_config jsonb, variant_b_config jsonb, status (`draft|running|paused|promoted|discarded`), started_at, ended_at, created_by, notes
- `ab_decisions`: experiment_id FK, match_id, market, variant (`A|B`), verdict, probability, edge, stake, raw jsonb, result (`GREEN|RED|VOID|null`), pnl, settled_at
- Unique: `(experiment_id, match_id, market, variant)` permite mesma partida analisada por A e B

**RPCs**:
- `ab_compute_metrics(_experiment_id uuid)` → jsonb por variante: total, approved, greens, reds, settled, green_pct, roi_pct, avg_stake, avg_prob, avg_edge + `chi_square` + `p_value_approx` (aprox: ≥6.63→0.01, ≥3.84→0.05, ≥2.71→0.10, senão 0.5) + `min_recommended_per_variant: 80`
- `ab_list_divergences(_experiment_id uuid)` → top 200 onde A.verdict ≠ B.verdict no mesmo match+market

## UI (Fase 3 — concluída 18/05/2026)

Rota: `/admin/ab-lab` (linkada no Hub Admin grupo Análise).
- Lista de experimentos com status e contagem
- Form Novo Experimento (nome, escopo, hipótese, JSONs A/B livres)
- Detalhe: cards lado-a-lado A vs B com métricas, χ² + p-value, tabela de divergências
- Botões: Rodar / Pausar / Promover B → Global / Descartar (apenas registra decisão; aplicar config ao motor real é trabalho explícito)

## Fase 2 — pendente (integração nas edges)

Cada edge candidata deverá aceitar `experiment_id` e `variant` opcionais no body:
- Se presentes → grava em `ab_decisions` em vez de `punter_analyses/punter_signals` (zero impacto no feed real)
- Se ausentes → comportamento atual inalterado

Integração entra edge por edge conforme cada mudança for testada (Groq vs Gemini, novos prompts, novos thresholds). Sem cron por enquanto — disparo manual via UI ou via curl direto à edge passando `experiment_id`.
