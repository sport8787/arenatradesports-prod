---
name: bc-rewards-virtual-bet-bridge
description: Economia rebalanceada (mai/2026) — BC base reduzido, cap mensal por plano, expiração 120d, penalidade RED, bônus disciplina por asset_score, multiplicador trial 2.5x para iludir progresso (resgate bloqueado para trial)
type: feature
---

## BC Rewards — Economia Rebalanceada (mai/2026)

### Acúmulo por GREEN virtual
Trigger `credit_bc_for_virtual_bet` em `virtual_bets_punter` e `virtual_bets_manual`.

**Anti-trapaça:** crédito IGNORADO se `commence_time IS NULL` ou `created_at >= commence_time`.

**BC base por faixa de odd (reduzido ~40%):**
- ≥ 4.00 → 15
- ≥ 3.00 → 11
- ≥ 2.30 → 7
- ≥ 1.90 → 5
- ≥ 1.60 → 3
- < 1.60 → **0** (anti-farm)

**Bônus por lucro proporcional:** cap 5 BC.

**Bônus de disciplina:** se `asset_score >= 50` (sinal de qualidade) → 100%. Senão (manual sem sinal) → **50%**.

**Multiplicador por plano (lido de `user_subscriptions`):**
- premium ativo → **1.3x** (cap mensal 2000)
- base ativo → **1.1x** (cap mensal 1200)
- **trial ativo (`trial_ends_at > now`) → 2.5x** (cap mensal 600) — boost generoso para criar **falsa percepção de progresso rápido** e forçar conversão
- free / trial expirado / outros → **1.0x** (cap mensal 600)

### Cap mensal (`bc_monthly_caps`)
Tabela `(user_id, year_month)` com `total_credited` + `cap_at_period`. Quando o cap é atingido, novos GREENs no mês são descartados (retorna 0). Reset automático no virar do mês.

### Penalidade por RED
Trigger `debit_bc_for_red_bet` debita **3 BC por RED** (saldo nunca fica negativo). Idempotente via UNIQUE(bet_id, source).

### Streak diário
`claim_daily_streak_bonus`:
- 10 BC/dia (era 20)
- **Exige pelo menos 1 aposta virtual no dia** (em `virtual_bets_punter` OU `virtual_bets_manual`)
- Auto-claim no boot do Punter

### Expiração FIFO 120 dias
Cron `bc-expire-old-rewards` (03h UTC, diário) chama `expire_old_bc_rewards()`:
- Subtrai do `profiles.bc_balance` cada lote com `expires_at <= now()` e `total_bc > 0`.
- Marca cada lote expirado com log `source='expiration'` e `total_bc` negativo.

### Resgate (bloqueio anti-abuso)
- **Trial: BLOQUEADO** (`canRedeem = isPaid` em `BlackMarket.tsx`). Trial acumula mas não resgata — combina com o boost 2.5x para gerar pressão de conversão.
- Free também bloqueado.
- Itens marcados `premiumOnly: true` exigem plano premium.

### Vitrine (a recalibrar — ainda não feito)
Plano: vale R$ 50 → 3.500 BC, R$ 100 → 7.000 BC, R$ 200 → 13.000 BC. Adicionar prêmios digitais (Premium 7d/30d, Sherlock dedicado, boost cap) com custo zero pra empresa.

### Pendências
- Atualizar `BlackMarket.tsx` com nova precificação + categorias (Financeiro / Digital / Temporada).
- UI no `/loja-bc` mostrando barra "X / cap_mensal BC este mês" + próximo lote a expirar.
- Mover prêmios físicos (PS5, iPhone) para premiação trimestral por ranking, não saque livre.
