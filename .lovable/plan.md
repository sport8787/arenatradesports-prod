# Plano — Qualidade dos Sinais AH Pré-Live (Arena Punter)

Objetivo: elevar ROI dos sinais Asian Handicap pré-live atacando os 4 vetores de maior impacto, na ordem do maior retorno por menor esforço.

## Visão geral das 4 frentes

```text
┌─────────────────────────────────────────────────────────────┐
│ #1 CLV TRACKER AH       → mata seleções com value negativo  │
│ #2 DISPERSÃO ENTRE CASAS → flag de incerteza + fade outliers│
│ #3 CALIBRAÇÃO POR BUCKET → corrige overconfidence em faixas │
│ #4 SHERLOCK OBRIGATÓRIO  → AH ≥ 2.00 ou |hcap| ≥ 1.5        │
└─────────────────────────────────────────────────────────────┘
```

---

## Frente 1 — CLV Tracker AH (maior impacto)

**O que faz:** mede quanto a odd da entrada AH bate o mercado no fechamento (Pinnacle/Futodds). CLV consistente positivo = edge real. CLV negativo = ilusão de lucro.

**Entrega:**
- Tabela `punter_clv_log` (signal_id, market, entry_odd, closing_odd, clv_pct, league, handicap, captured_at).
- Cron `punter-clv-capture` rodando 5min antes do kick-off de cada sinal AH aprovado, captura odd de fechamento via Futodds Exchange (fallback Pinnacle via The Odds API).
- View materializada `punter_clv_30d` com CLV médio agrupado por: liga, faixa de handicap, faixa de odd.
- **Quarentena automática:** se um bucket (liga × faixa) tiver ≥15 sinais nos últimos 30d com CLV médio < -1.5%, entra em `punter_quarantine` → engine bloqueia novos sinais AH naquele bucket por 14 dias.
- Painel `/admin/clv-monitor` mostrando CLV por liga/handicap, com badge vermelho nos buckets em quarentena.

---

## Frente 2 — Dispersão de Odds entre Casas

**O que faz:** AH varia muito entre casas. Quando há grande divergência, é sinal de mercado incerto. Quando estamos pegando a pior odd, vetar.

**Entrega:**
- Função `compareAHOddsAcrossBooks(matchId, market)` em `_shared/oddsComparison.ts`: busca odds AH em Bet365, Pinnacle, Betfair Exchange, Superbet (via The Odds API) + Futodds.
- Calcula `dispersion_pct = (max - min) / median`.
- Integra no `mycroft-punter-anthropic` antes de aprovar:
  - `dispersion > 7%` → flag `MERCADO_INCERTO`, reduz stake em 30%.
  - Nossa odd no bottom 25% das casas → veto direto (`linha pior que mercado`).
  - Nossa odd no top 25% → +3pp confidence (estamos pegando o melhor preço).
- Campo novo em `punter_signals.market_dispersion` para auditoria.

---

## Frente 3 — Calibração por Bucket (AH × faixa de odd)

**O que faz:** hoje `punter_calibration` é agregada. Sinais AH em faixa específica podem estar mal-calibrados sem aparecer na média geral.

**Entrega:**
- Migration: nova coluna `bucket_key` em `punter_calibration` no formato `{market}__{odd_bucket}` (ex: `AH__1.80-2.20`).
- Recalcular Brier Score e accuracy por bucket no cron diário existente `punter-calibration-update`.
- Engine consulta o bucket exato do sinal antes de aprovar:
  - Se `accuracy_observed - accuracy_expected < -8pp` no bucket → -10pp na confidence final.
  - Se bucket tem < 30 amostras → fallback para média do mercado AH inteiro.
- Painel `/admin/punter-calibration` ganha tab "Por Bucket AH" com heatmap odd × handicap.

---

## Frente 4 — Sherlock Obrigatório para AH de risco

**O que faz:** Sherlock já existe como camada estatística avançada. Tornar obrigatório (não opcional) nos AH onde mais erramos historicamente.

**Entrega:**
- No `mycroft-punter-anthropic`, após gerar sinal AH, se `entry_odd ≥ 2.00 OU |handicap| ≥ 1.5`, chamar `mycroft-punter-analytic` (Sherlock) inline antes de persistir.
- Se Sherlock retornar `veto = true` → sinal vai para `punter_vetoed_log` e NÃO é aprovado.
- Se Sherlock retornar `confidence_adjustment < -10` → downgrade automático de tier (ex: ⚡FORTE → ✅BOM).
- Badge visual "🔍 Sherlock validado" no card do Punter para sinais que passaram.

---

## Detalhes técnicos

**Arquivos novos/editados:**
- `supabase/migrations/<ts>_clv_tracker.sql` — tabela `punter_clv_log`, view `punter_clv_30d`, tabela `punter_quarantine`.
- `supabase/migrations/<ts>_calibration_bucket.sql` — coluna `bucket_key` em `punter_calibration` + índice.
- `supabase/functions/punter-clv-capture/index.ts` — cron 1min, captura odds próximas ao kick-off.
- `supabase/functions/_shared/oddsComparison.ts` — comparador multi-casa.
- `supabase/functions/_shared/calibrationLookup.ts` — lookup de bucket com fallback.
- `supabase/functions/mycroft-punter-anthropic/index.ts` — integra dispersão, calibração por bucket e chamada inline ao Sherlock para AH de risco.
- `supabase/functions/punter-calibration-update/index.ts` — recalcula por bucket.
- `src/pages/AdminPunterCalibration.tsx` — nova tab heatmap por bucket.
- `src/pages/AdminCLVMonitor.tsx` — nova página com CLV e quarentena.
- `src/components/punter/SherlockBadge.tsx` — badge visual.

**Cron novos:**
- `punter-clv-capture` a cada 1min (filtra apenas sinais AH com kick-off em ≤6min e CLV ainda não capturado).
- `punter-quarantine-refresh` diário 04:00 UTC (recalcula buckets em quarentena).

**Métricas de sucesso (revisão em 30 dias):**
- ROI sinais AH pré-live: meta de +3pp vs baseline atual.
- % de sinais AH com CLV positivo: meta ≥ 55%.
- Redução de aprovações em ligas/buckets ruins: esperado -20 a -30% no volume AH (qualidade > quantidade).

## Ordem de execução sugerida

1. **Frente 3 (Calibração por Bucket)** — base estatística para tudo. ~1 sessão.
2. **Frente 4 (Sherlock obrigatório)** — quick win, Sherlock já existe. ~1 sessão.
3. **Frente 2 (Dispersão entre Casas)** — depende de teste de quota The Odds API. ~1 sessão.
4. **Frente 1 (CLV Tracker)** — maior impacto mas requer 7-14 dias de coleta antes de ativar quarentena. Implementar primeiro como log-only, ativar quarentena depois. ~1-2 sessões.

Aprova o plano nessa ordem? Se quiser cortar algo ou priorizar diferente, me diz.
